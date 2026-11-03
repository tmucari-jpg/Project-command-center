-- QA only: harden the diagnostic lookup so expired tokens cannot return client data.
-- Apply after staging review, never automatically to production.
CREATE OR REPLACE FUNCTION public.client_diagnostic_lookup(p_token_hash text)
RETURNS TABLE(request_id uuid, client_name text, client_organization text, public_context text, questionnaire_version text, status text, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_request_id uuid;
BEGIN
 IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN RETURN; END IF;
 SELECT r.id INTO v_request_id FROM public.client_diagnostic_requests r
 WHERE r.token_hash = p_token_hash AND r.status <> 'revoked' LIMIT 1;
 IF v_request_id IS NULL THEN RETURN; END IF;
 IF NOT private.consume_client_diagnostic_rate_limit(v_request_id, 'lookup', 60, 600) THEN RETURN; END IF;
 UPDATE public.client_diagnostic_requests r SET status = 'expired', updated_at = now()
 WHERE r.id = v_request_id AND r.status IN ('active','opened') AND r.expires_at <= now();
 UPDATE public.client_diagnostic_requests r SET status = 'opened', opened_at = coalesce(r.opened_at, now()), updated_at = now()
 WHERE r.id = v_request_id AND r.status = 'active' AND r.expires_at > now();
 RETURN QUERY SELECT r.id,r.client_name,r.client_organization,r.public_context,r.questionnaire_version,r.status,r.expires_at
 FROM public.client_diagnostic_requests r WHERE r.id = v_request_id AND r.status <> 'revoked' AND r.expires_at > now() LIMIT 1;
END $$;