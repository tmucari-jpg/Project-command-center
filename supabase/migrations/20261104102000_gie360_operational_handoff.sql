-- GIE360° operational handoff. Append-only: existing PCC tables/functions remain unchanged.
-- The case is the immutable provenance; the GIE project owns specialist execution.
CREATE TABLE IF NOT EXISTS public.gie360_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.gie360_organizations(id),
  factory_case_id uuid NOT NULL REFERENCES public.project_factory_cases(id),
  source_request_id uuid NOT NULL REFERENCES public.client_diagnostic_requests(id),
  manager_user_id uuid NOT NULL REFERENCES public.profiles(id),
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

  SELECT r.id INTO v_request
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
    (organization_id,factory_case_id,source_request_id,manager_user_id,title,status)
  VALUES
    (p_organization_id,p_case_id,v_request,auth.uid(),v_title,'awaiting_scope')
  RETURNING id INTO v_result;

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
