\set ON_ERROR_STOP on
CREATE SCHEMA auth;
CREATE SCHEMA private;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
 AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth,private,public TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz);
CREATE TABLE public.gie360_organizations(id uuid PRIMARY KEY,manager_user_id uuid);
CREATE TABLE public.gie360_memberships(
 organization_id uuid REFERENCES public.gie360_organizations(id),
 client_user_id uuid REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,client_user_id)
);
CREATE TABLE public.project_factory_cases(id uuid,user_id uuid);
CREATE TABLE public.projects(id uuid,user_id uuid);
CREATE TABLE public.user_roles(user_id uuid);
INSERT INTO public.gie360_organizations(id,manager_user_id) VALUES
 ('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111'),
 ('33333333-3333-4333-8333-333333333333','99999999-9999-4999-8999-999999999999');
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
 ('77777777-7777-4777-8777-777777777777','client@example.invalid',now()),
 ('66666666-6666-4666-8666-666666666666','pending@example.invalid',null),
 ('11111111-1111-4111-8111-111111111111','manager@example.invalid',now());
