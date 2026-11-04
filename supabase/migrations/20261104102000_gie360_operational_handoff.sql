-- GIE360° operational handoff. Append-only: existing PCC tables/functions remain unchanged.
-- The case is the immutable provenance; the GIE project owns specialist execution.
CREATE TABLE IF NOT EXISTS public.gie360_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.gie360_organizations(id),
  factory_case_id uuid NOT NULL REFERENCES public.project_factory_cases(id),
  source_request_id uuid NOT NULL REFERENCES public.client_diagnostic_requests(id),
  manager_user_id uuid NOT NULL REFERENCES public.profiles(id),
  diagnostic_summary jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(diagnostic_summary) = 'object'),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 2 AND 240),
  status text NOT NULL DEFAULT 'awaiting_scope'
    CHECK (status IN ('awaiting_scope','active','paused','completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (factory_case_id),
  UNIQUE (organization_id, factory_case_id)
);
ALTER TABLE public.gie360_projects ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.gie360_projects FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.gie360_projects TO authenticated;

DROP POLICY IF EXISTS gie360_projects_read ON public.gie360_projects;
CREATE POLICY gie360_projects_read ON public.gie360_projects
  FOR SELECT TO authenticated
  USING (private.gie360_can_access(organization_id));

CREATE OR REPLACE FUNCTION private.gie360_transfer_approved_case(
  p_case_id uuid, p_organization_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE
  v_request uuid;
  v_answers jsonb;
  v_review_status text;
  v_title text;
  v_existing public.gie360_projects%rowtype;
  v_result uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'GIE360_AUTH_REQUIRED';
  END IF;
  SELECT c.title INTO v_title
    FROM public.project_factory_cases c
    WHERE c.id=p_case_id AND c.user_id=auth.uid()
    FOR UPDATE;
  IF v_title IS NULL THEN RAISE EXCEPTION 'GIE360_CASE_NOT_OWNED'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.gie360_organizations o
    JOIN public.gie360_assessments a
      ON a.organization_id=o.id AND a.factory_case_id=p_case_id
    WHERE o.id=p_organization_id AND o.manager_user_id=auth.uid()
  ) THEN
    RAISE EXCEPTION 'GIE360_ORGANIZATION_CASE_MISMATCH';
  END IF;

  SELECT r.id, a.answers, v.review_status INTO v_request, v_answers, v_review_status
    FROM public.client_diagnostic_requests r
    JOIN public.client_diagnostic_reviews v ON v.request_id=r.id
    JOIN public.client_diagnostic_responses a ON a.request_id=r.id
    WHERE r.factory_case_id=p_case_id
      AND r.user_id=auth.uid()
      AND r.questionnaire_version IN ('executive-v3','executive-v3-gie360')
      AND r.status IN ('reviewed','incorporated')
      AND r.submitted_at IS NOT NULL
      AND v.user_id=auth.uid()
      AND v.review_status IN ('accepted','partially_accepted')
    ORDER BY r.reviewed_at DESC NULLS LAST, r.created_at DESC
    LIMIT 1;
  IF v_request IS NULL THEN
    RAISE EXCEPTION 'GIE360_ACCEPTED_DIAGNOSTIC_REQUIRED';
  END IF;

  SELECT * INTO v_existing
    FROM public.gie360_projects
    WHERE factory_case_id=p_case_id FOR UPDATE;
  IF v_existing.id IS NOT NULL THEN
    IF v_existing.organization_id <> p_organization_id THEN
      RAISE EXCEPTION 'GIE360_CASE_ALREADY_TRANSFERRED';
    END IF;
    RETURN v_existing.id;
  END IF;

  INSERT INTO public.gie360_projects
    (organization_id,factory_case_id,source_request_id,manager_user_id,diagnostic_summary,title,status)
  VALUES
    (p_organization_id,p_case_id,v_request,auth.uid(),
      jsonb_strip_nulls(jsonb_build_object(
        'source','pcc_approved_diagnostic',
        'validation_status','declared',
        'review_status',v_review_status,
        'context',v_answers->'context',
        'focus',v_answers->'focus',
        'desired_result',v_answers->'desired_result',
        'conditions',v_answers->'conditions',
        'deadline_urgency',v_answers->'deadline_urgency',
        'success_criteria',v_answers->'success_criteria'
      )),
      v_title,'awaiting_scope')
  ON CONFLICT (factory_case_id) DO NOTHING
  RETURNING id INTO v_result;

  -- A parallel request must reuse the same project instead of creating a
  -- duplicate or returning an avoidable unique-key error.
  IF v_result IS NULL THEN
    SELECT * INTO v_existing FROM public.gie360_projects
      WHERE factory_case_id=p_case_id;
    IF v_existing.id IS NULL OR v_existing.organization_id <> p_organization_id THEN
      RAISE EXCEPTION 'GIE360_CASE_ALREADY_TRANSFERRED';
    END IF;
    RETURN v_existing.id;
  END IF;
  RETURN v_result;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.gie360_transfer_approved_case(
  p_case_id uuid, p_organization_id uuid
) RETURNS uuid LANGUAGE sql SET search_path TO ''
AS $fn$ SELECT private.gie360_transfer_approved_case(p_case_id,p_organization_id); $fn$;
REVOKE ALL ON FUNCTION private.gie360_transfer_approved_case(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gie360_transfer_approved_case(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gie360_transfer_approved_case(uuid,uuid) TO authenticated;

-- An explicit manager approval activates the GIE project after the contract
-- and approved module scope exist. No automatic activation on handoff.
CREATE OR REPLACE FUNCTION private.gie360_activate_project(p_project_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE v_project public.gie360_projects%rowtype;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'GIE360_AUTH_REQUIRED'; END IF;
  SELECT p.* INTO v_project FROM public.gie360_projects p
    JOIN public.gie360_organizations o ON o.id=p.organization_id
    WHERE p.id=p_project_id AND p.manager_user_id=auth.uid()
      AND o.manager_user_id=auth.uid()
      AND o.contract_approved AND o.package_code IS NOT NULL
      AND cardinality(o.approved_modules)>0
    FOR UPDATE OF p;
  IF v_project.id IS NULL THEN RAISE EXCEPTION 'GIE360_SCOPE_NOT_APPROVED'; END IF;
  IF v_project.status NOT IN ('awaiting_scope','active') THEN
    RAISE EXCEPTION 'GIE360_PROJECT_NOT_ACTIVATABLE';
  END IF;
  UPDATE public.gie360_projects SET status='active',updated_at=now()
    WHERE id=v_project.id AND status='awaiting_scope';
  RETURN v_project.id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.gie360_activate_project(p_project_id uuid)
RETURNS uuid LANGUAGE sql SET search_path TO ''
AS $fn$ SELECT private.gie360_activate_project(p_project_id); $fn$;
REVOKE ALL ON FUNCTION private.gie360_activate_project(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gie360_activate_project(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gie360_activate_project(uuid) TO authenticated;

-- Log the actual outcome of a reserved GIE360° AI request without making
-- the provider registry or PCC administrative data accessible to clients.
CREATE OR REPLACE FUNCTION private.gie360_finish_ai_request(
  p_request_id uuid, p_status text, p_provider text DEFAULT NULL, p_error_code text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR p_status NOT IN ('completed','failed') OR
     length(coalesce(p_provider,''))>80 OR length(coalesce(p_error_code,''))>120 THEN
    RAISE EXCEPTION 'GIE360_INVALID_AI_RESULT';
  END IF;
  UPDATE public.gie360_ai_requests r
    SET status=p_status,
        provider=nullif(trim(p_provider),''),
        error_code=nullif(trim(p_error_code),'')
    WHERE r.id=p_request_id
      AND r.user_id=auth.uid()
      AND r.status='reserved'
      AND private.gie360_can_access(r.organization_id)
    RETURNING r.id INTO v_id;
  RETURN v_id IS NOT NULL;
END;
$fn$;
CREATE OR REPLACE FUNCTION public.gie360_finish_ai_request(
  p_request_id uuid, p_status text, p_provider text DEFAULT NULL, p_error_code text DEFAULT NULL
) RETURNS boolean LANGUAGE sql SET search_path TO ''
AS $fn$ SELECT private.gie360_finish_ai_request(p_request_id,p_status,p_provider,p_error_code); $fn$;
REVOKE ALL ON FUNCTION private.gie360_finish_ai_request(uuid,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gie360_finish_ai_request(uuid,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gie360_finish_ai_request(uuid,text,text,text) TO authenticated;

-- Specialist execution items exist ONLY in GIE360°, not PCC Project Factory.
CREATE TABLE IF NOT EXISTS public.gie360_work_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.gie360_organizations(id),
  project_id uuid NOT NULL REFERENCES public.gie360_projects(id),
  module_code text NOT NULL,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 5 AND 240),
  completion_criterion text NOT NULL CHECK (length(trim(completion_criterion)) BETWEEN 5 AND 1000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','blocked','completed')),
  evidence_reference text,
  manager_user_id uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gie360_work_items_project_idx ON public.gie360_work_items(project_id);
ALTER TABLE public.gie360_work_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.gie360_work_items FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.gie360_work_items TO authenticated;
DROP POLICY IF EXISTS gie360_work_items_read ON public.gie360_work_items;
CREATE POLICY gie360_work_items_read ON public.gie360_work_items
  FOR SELECT TO authenticated
  USING (private.gie360_can_access(organization_id));

CREATE OR REPLACE FUNCTION private.gie360_create_work_item(
  p_project_id uuid, p_module text, p_title text, p_completion_criterion text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE v_id uuid; v_org uuid;
BEGIN
  IF auth.uid() IS NULL OR length(trim(coalesce(p_title,''))) NOT BETWEEN 5 AND 240
     OR length(trim(coalesce(p_completion_criterion,''))) NOT BETWEEN 5 AND 1000 THEN
    RAISE EXCEPTION 'GIE360_INVALID_WORK_ITEM';
  END IF;
  SELECT p.organization_id INTO v_org FROM public.gie360_projects p
    JOIN public.gie360_organizations o ON o.id=p.organization_id
    WHERE p.id=p_project_id AND p.status='active'
      AND p.manager_user_id=auth.uid() AND o.manager_user_id=auth.uid()
      AND o.contract_approved AND p_module=ANY(o.approved_modules);
  IF v_org IS NULL THEN RAISE EXCEPTION 'GIE360_MODULE_OR_PROJECT_NOT_APPROVED'; END IF;
  INSERT INTO public.gie360_work_items
    (organization_id,project_id,module_code,title,completion_criterion,manager_user_id)
  VALUES (v_org,p_project_id,p_module,trim(p_title),trim(p_completion_criterion),auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$fn$;
CREATE OR REPLACE FUNCTION public.gie360_create_work_item(
  p_project_id uuid,p_module text,p_title text,p_completion_criterion text
) RETURNS uuid LANGUAGE sql SET search_path TO ''
AS $fn$ SELECT private.gie360_create_work_item(p_project_id,p_module,p_title,p_completion_criterion); $fn$;
REVOKE ALL ON FUNCTION private.gie360_create_work_item(uuid,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gie360_create_work_item(uuid,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gie360_create_work_item(uuid,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION private.gie360_progress_work_item(
  p_work_item_id uuid,p_status text,p_evidence_reference text DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE v_item public.gie360_work_items%rowtype;
BEGIN
  IF auth.uid() IS NULL OR p_status NOT IN ('in_progress','blocked','completed') THEN
    RAISE EXCEPTION 'GIE360_INVALID_WORK_ITEM_STATUS';
  END IF;
  SELECT w.* INTO v_item FROM public.gie360_work_items w
    JOIN public.gie360_projects p ON p.id=w.project_id
    JOIN public.gie360_organizations o ON o.id=w.organization_id
    WHERE w.id=p_work_item_id AND w.manager_user_id=auth.uid()
      AND p.status='active' AND o.manager_user_id=auth.uid()
    FOR UPDATE OF w;
  IF v_item.id IS NULL THEN RAISE EXCEPTION 'GIE360_WORK_ITEM_NOT_AUTHORIZED'; END IF;
  IF p_status='completed' AND length(trim(coalesce(p_evidence_reference,'')))<5 THEN
    RAISE EXCEPTION 'GIE360_EVIDENCE_REFERENCE_REQUIRED';
  END IF;
  IF p_status='completed' AND length(trim(coalesce(p_evidence_reference,'')))>1000 THEN
    RAISE EXCEPTION 'GIE360_EVIDENCE_TOO_LONG';
  END IF;
  UPDATE public.gie360_work_items SET status=p_status,
    evidence_reference=CASE WHEN p_status='completed' THEN trim(p_evidence_reference) ELSE evidence_reference END,
    updated_at=now() WHERE id=v_item.id;
  RETURN true;
END;
$fn$;
CREATE OR REPLACE FUNCTION public.gie360_progress_work_item(
  p_work_item_id uuid,p_status text,p_evidence_reference text DEFAULT NULL
) RETURNS boolean LANGUAGE sql SET search_path TO ''
AS $fn$ SELECT private.gie360_progress_work_item(p_work_item_id,p_status,p_evidence_reference); $fn$;
REVOKE ALL ON FUNCTION private.gie360_progress_work_item(uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gie360_progress_work_item(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gie360_progress_work_item(uuid,text,text) TO authenticated;
