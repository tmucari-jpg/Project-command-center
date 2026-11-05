-- GIE360: create an internal intake only after an accepted PCC diagnostic.
-- The client's portal identity remains independent and optional at this stage.
CREATE OR REPLACE FUNCTION public.gie360_intake_from_diagnostic(p_case_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_owner uuid := auth.uid();
  v_request uuid;
  v_organization uuid;
  v_project uuid;
  v_name text;
  v_answers jsonb;
  v_email text;
BEGIN
  IF v_owner IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.project_factory_cases
    WHERE id=p_case_id AND user_id=v_owner
  ) THEN RAISE EXCEPTION 'NOT_AUTHORIZED'; END IF;
  PERFORM 1 FROM public.project_factory_cases
    WHERE id=p_case_id AND user_id=v_owner FOR UPDATE;
  SELECT r.id, a.answers, a.respondent_email,
    left(coalesce(nullif(trim(r.client_organization),''),
                  nullif(trim(a.answers->>'organization'),''),
                  nullif(trim(r.client_name),''),
                  nullif(trim(a.respondent_name),''),'Cliente GIE360'),200)
  INTO v_request,v_answers,v_email,v_name
  FROM public.client_diagnostic_requests r
  JOIN public.client_diagnostic_responses a ON a.request_id=r.id
  JOIN public.client_diagnostic_reviews rv ON rv.request_id=r.id AND rv.user_id=v_owner
  WHERE r.factory_case_id=p_case_id AND r.user_id=v_owner
    AND r.questionnaire_version='executive-v3-gie360'
    AND r.submitted_at IS NOT NULL
    AND r.status IN ('reviewed','incorporated')
    AND rv.review_status IN ('accepted','partially_accepted')
  ORDER BY r.reviewed_at DESC NULLS LAST,r.created_at DESC LIMIT 1;
  IF v_request IS NULL THEN RAISE EXCEPTION 'APPROVED_GIE_DIAGNOSTIC_REQUIRED'; END IF;
  SELECT organization_id,id INTO v_organization,v_project
    FROM public.gie360_projects WHERE factory_case_id=p_case_id;
  IF v_project IS NOT NULL THEN RETURN v_project; END IF;
  SELECT organization_id INTO v_organization FROM public.gie360_assessments
    WHERE factory_case_id=p_case_id LIMIT 1;
  IF v_organization IS NULL THEN
    INSERT INTO public.gie360_organizations(manager_user_id,name,company_profile)
    VALUES(v_owner,v_name,jsonb_strip_nulls(jsonb_build_object(
      'source','pcc_diagnostic','contact_email',nullif(v_email,''),
      'contact_phone',nullif(coalesce(v_answers->>'contact_phone',v_answers->>'phone',v_answers->>'telephone'),''),
      'source_request_id',v_request,
      'organization',nullif(v_answers->>'organization',''))))
    RETURNING id INTO v_organization;
    INSERT INTO public.gie360_assessments(
      organization_id,factory_case_id,request_id,questionnaire_version,answers
    ) VALUES(v_organization,p_case_id,v_request,'executive-v3-gie360',v_answers);
  END IF;
  RETURN private.gie360_transfer_approved_case(p_case_id,v_organization);
END;
$$;
REVOKE ALL ON FUNCTION public.gie360_intake_from_diagnostic(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gie360_intake_from_diagnostic(uuid) TO authenticated;
