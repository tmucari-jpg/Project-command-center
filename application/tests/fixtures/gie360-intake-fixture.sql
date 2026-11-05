\set ON_ERROR_STOP on
CREATE SCHEMA auth;
CREATE SCHEMA private;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth,private TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;

CREATE TABLE public.project_factory_cases (id uuid PRIMARY KEY,user_id uuid NOT NULL,title text);
CREATE TABLE public.client_diagnostic_requests (
 id uuid PRIMARY KEY, factory_case_id uuid,user_id uuid,
 questionnaire_version text,status text,submitted_at timestamptz,
 reviewed_at timestamptz,created_at timestamptz,
 client_organization text,client_name text
);
CREATE TABLE public.client_diagnostic_responses (
 request_id uuid PRIMARY KEY,answers jsonb,respondent_name text,respondent_email text
);
CREATE TABLE public.client_diagnostic_reviews (
 request_id uuid PRIMARY KEY,user_id uuid,review_status text
);
CREATE TABLE public.gie360_organizations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),manager_user_id uuid,name text,company_profile jsonb
);
CREATE TABLE public.gie360_assessments (
 organization_id uuid,factory_case_id uuid UNIQUE,request_id uuid,
 questionnaire_version text,answers jsonb
);
CREATE TABLE public.gie360_projects (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid,
 factory_case_id uuid UNIQUE,manager_user_id uuid,source_request_id uuid,status text
);
CREATE FUNCTION private.gie360_transfer_approved_case(p_case_id uuid,p_organization_id uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_project uuid;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.gie360_assessments
       WHERE factory_case_id=p_case_id AND organization_id=p_organization_id)
  THEN RAISE EXCEPTION 'ASSESSMENT_REQUIRED'; END IF;
  SELECT id INTO v_project FROM public.gie360_projects WHERE factory_case_id=p_case_id;
  IF v_project IS NOT NULL THEN RETURN v_project; END IF;
  INSERT INTO public.gie360_projects(organization_id,factory_case_id,manager_user_id,status)
   VALUES(p_organization_id,p_case_id,auth.uid(),'awaiting_scope') RETURNING id INTO v_project;
  RETURN v_project;
END $$;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.project_factory_cases TO authenticated;

INSERT INTO public.project_factory_cases(id,user_id,title) VALUES
('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','Caso realista sem email'),
('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','Caso sem revisão');
INSERT INTO public.client_diagnostic_requests(id,factory_case_id,user_id,questionnaire_version,status,submitted_at,reviewed_at,created_at,client_organization,client_name)
VALUES('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','executive-v3-gie360','reviewed',now(),now(),now(),'Empresa Teste','Pessoa Teste');
INSERT INTO public.client_diagnostic_responses(request_id,answers,respondent_name,respondent_email)
VALUES('44444444-4444-4444-8444-444444444444','{"organization":"Empresa Teste","contact_phone":"+258000000000","focus":"Planeamento"}','Pessoa Teste',null);
INSERT INTO public.client_diagnostic_reviews(request_id,user_id,review_status)
VALUES('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','accepted');
