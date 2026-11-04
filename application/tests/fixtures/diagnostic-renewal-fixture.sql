\set ON_ERROR_STOP on

-- Disposable PostgreSQL fixture. No project secrets and no production data.
CREATE ROLE authenticated;
CREATE ROLE anon;
CREATE SCHEMA auth;
CREATE SCHEMA private;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION private.is_global_admin() RETURNS boolean LANGUAGE sql STABLE
  AS $$ SELECT false $$;
GRANT USAGE ON SCHEMA auth, private TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_global_admin() TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

CREATE TABLE public.project_factory_cases (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL
);
CREATE TABLE public.client_diagnostic_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  factory_case_id uuid NOT NULL REFERENCES public.project_factory_cases(id),
  token_hash text NOT NULL UNIQUE,
  questionnaire_version text NOT NULL,
  client_name text,
  client_organization text,
  public_context text,
  status text NOT NULL CHECK (status IN ('active','opened','submitted','analyzing','clarification_needed','reviewed','incorporated','revoked','expired')),
  expires_at timestamptz NOT NULL
);
ALTER TABLE public.project_factory_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_diagnostic_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY factory_owner ON public.project_factory_cases
  TO authenticated USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());
CREATE POLICY diagnostic_owner ON public.client_diagnostic_requests
  TO authenticated USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());
GRANT SELECT, INSERT, UPDATE ON public.project_factory_cases TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.client_diagnostic_requests TO authenticated;

INSERT INTO public.project_factory_cases (id,user_id) VALUES
 ('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111');
-- Previously submitted answers must survive renewal unchanged.
INSERT INTO public.client_diagnostic_requests (
  user_id,factory_case_id,token_hash,questionnaire_version,status,expires_at
) VALUES (
 '11111111-1111-4111-8111-111111111111',
 '22222222-2222-4222-8222-222222222222',
 repeat('9',64),'executive-v3','submitted',now()+interval '7 days'
);
