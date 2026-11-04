-- PCC: issue a replacement diagnostic link transactionally.
-- Keeps both existing questionnaire variants and the existing human-review flow.
-- Prepared for controlled migration in the single authorized release; NOT applied here.
CREATE OR REPLACE FUNCTION public.issue_client_diagnostic_request_atomic(
  p_owner_id uuid,
  p_case_id uuid,
  p_token_hash text,
  p_questionnaire_version text,
  p_client_name text,
  p_client_organization text,
  p_public_context text,
  p_expires_at timestamptz
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_case_id uuid;
  v_request_id uuid;
BEGIN
  -- The user remains subject to existing RLS. Admin delegation is allowed
  -- only under the pre-existing global-admin policy.
  IF auth.uid() IS NULL
    OR (auth.uid() <> p_owner_id AND NOT (SELECT private.is_global_admin()))
  THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED' USING ERRCODE = '42501';
  END IF;

  IF p_questionnaire_version NOT IN ('executive-v3', 'executive-v3-gie360')
     OR p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$'
     OR p_expires_at IS NULL OR p_expires_at <= now()
     OR p_expires_at > now() + interval '8 days'
     OR length(coalesce(p_client_name, '')) > 200
     OR length(coalesce(p_client_organization, '')) > 300
     OR length(coalesce(p_public_context, '')) > 2000
  THEN
    RAISE EXCEPTION 'INVALID_DIAGNOSTIC_REQUEST' USING ERRCODE = '22023';
  END IF;

  -- Serialise simultaneous renewals for the same PCC case.
  SELECT id INTO v_case_id
  FROM public.project_factory_cases
  WHERE id = p_case_id AND user_id = p_owner_id
  FOR UPDATE;

  IF v_case_id IS NULL THEN
    RAISE EXCEPTION 'CASE_NOT_FOUND' USING ERRCODE = '42501';
  END IF;

  -- These two operations are in one database transaction. Any insertion
  -- error rolls back the revocation; submitted/reviewed cases are untouched.
  UPDATE public.client_diagnostic_requests
  SET status = 'revoked'
  WHERE factory_case_id = v_case_id
    AND user_id = p_owner_id
    AND status IN ('active', 'opened');

  INSERT INTO public.client_diagnostic_requests (
    user_id, factory_case_id, token_hash, questionnaire_version,
    client_name, client_organization, public_context, status, expires_at
  ) VALUES (
    p_owner_id, v_case_id, p_token_hash, p_questionnaire_version,
    NULLIF(p_client_name, ''), NULLIF(p_client_organization, ''),
    NULLIF(p_public_context, ''), 'active', p_expires_at
  ) RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.issue_client_diagnostic_request_atomic(
  uuid, uuid, text, text, text, text, text, timestamptz
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_client_diagnostic_request_atomic(
  uuid, uuid, text, text, text, text, text, timestamptz
) TO authenticated;
