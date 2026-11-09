-- Attach an already-confirmed separate client account to an existing GIE360
-- organization. Never create a second organization or provision an account
-- on behalf of a person. Reuse existing RLS, tenant membership and client login.
CREATE OR REPLACE FUNCTION private.gie360_link_existing_client(
  p_organization_id uuid,
  p_client_email text
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_client_id uuid;
BEGIN
  IF auth.uid() IS NULL
     OR p_client_email IS NULL
     OR length(trim(p_client_email)) < 5
     OR length(trim(p_client_email)) > 320
     OR p_client_email NOT LIKE '%@%'
  THEN RAISE EXCEPTION 'GIE360_INVALID_CLIENT_INVITATION'; END IF;

  PERFORM 1 FROM public.gie360_organizations
    WHERE id = p_organization_id AND manager_user_id = auth.uid()
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'GIE360_MANAGER_REQUIRED'; END IF;

  SELECT id INTO v_client_id FROM auth.users
    WHERE lower(email) = lower(trim(p_client_email))
      AND email_confirmed_at IS NOT NULL LIMIT 1;
  IF v_client_id IS NULL THEN RETURN false; END IF;

  IF v_client_id = auth.uid()
     OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_client_id)
     OR EXISTS (SELECT 1 FROM public.projects WHERE user_id = v_client_id)
     OR EXISTS (SELECT 1 FROM public.project_factory_cases WHERE user_id = v_client_id)
     OR EXISTS (SELECT 1 FROM public.gie360_organizations WHERE manager_user_id = v_client_id)
  THEN RAISE EXCEPTION 'GIE360_DISTINCT_CLIENT_ACCOUNT_REQUIRED'; END IF;

  INSERT INTO public.gie360_memberships (organization_id,client_user_id)
  VALUES (p_organization_id,v_client_id)
  ON CONFLICT (organization_id,client_user_id) DO NOTHING;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION private.gie360_link_existing_client(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.gie360_link_existing_client(uuid,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.gie360_link_existing_client(
  p_organization_id uuid,
  p_client_email text
)
RETURNS boolean
LANGUAGE sql SET search_path = ''
AS $$ SELECT private.gie360_link_existing_client(p_organization_id,p_client_email); $$;
REVOKE ALL ON FUNCTION public.gie360_link_existing_client(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gie360_link_existing_client(uuid,text) TO authenticated;
