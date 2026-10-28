-- GIE360 client identities never acquire PCC management roles or direct case access.
create table public.pcc_products (
  code text primary key, name text not null, description text not null,
  status text not null check(status in ('proposed','active','retired')), version text not null,
  modules text[] not null default '{}'
);
create table public.pcc_product_packages (
  code text primary key, product_code text not null references public.pcc_products(code),
  name text not null, modules text[] not null, limits jsonb not null default '{}',
  export_rights text[] not null default '{}', support_terms text, duration_days integer,
  price_mzn numeric check(price_mzn >= 0), commercial_status text not null default 'to_define'
    check(commercial_status in ('to_define','approved')), version text not null
);
insert into public.pcc_products values ('gie360','GIE360°','Gestão Inteligente Empresarial','proposed','1.4',
  array['data','sales','crm','billing','accounting','treasury','operations','strategy','ai','plans','exports']);
insert into public.pcc_product_packages(code,product_code,name,modules,export_rights,version) values
 ('gie360-essential','gie360','Essencial',array['data','plans'],array['pdf'],'1.4'),
 ('gie360-professional','gie360','Profissional',array['data','plans','sales','crm','billing','exports'],array['pdf','docx','xlsx','csv'],'1.4'),
 ('gie360-complete','gie360','Completo',array['data','plans','sales','crm','billing','exports','accounting','treasury','operations'],array['pdf','docx','xlsx','csv'],'1.4'),
 ('gie360-enterprise','gie360','Empresarial',array['data','plans','sales','crm','billing','exports','accounting','treasury','operations','strategy','ai'],array['pdf','docx','xlsx','csv','zip'],'1.4');
create table public.gie360_organizations (
  id uuid primary key default gen_random_uuid(), manager_user_id uuid not null references public.profiles(id),
  name text not null check(length(trim(name)) between 2 and 200),
  package_code text references public.pcc_product_packages(code),
  approved_modules text[] not null default '{}', ai_cloud_authorized boolean not null default false,
  company_profile jsonb not null default '{}', created_at timestamptz not null default now()
);
create table public.gie360_memberships (
  organization_id uuid not null references public.gie360_organizations(id),
  client_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(), primary key(organization_id,client_user_id)
);
create index gie360_memberships_client on public.gie360_memberships(client_user_id);
create table public.gie360_assessments (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.gie360_organizations(id),
  factory_case_id uuid not null references public.project_factory_cases(id),
  request_id uuid not null unique references public.client_diagnostic_requests(id),
  questionnaire_version text not null default 'gie360-v1', answers jsonb not null default '{}',
  revision integer not null default 0, status text not null default 'draft' check(status in ('draft','submitted')),
  submitted_at timestamptz, updated_at timestamptz not null default now(),
  unique(organization_id,factory_case_id), check(jsonb_typeof(answers)='object')
);
create table public.gie360_submissions (
  id uuid primary key default gen_random_uuid(), assessment_id uuid not null unique references public.gie360_assessments(id),
  organization_id uuid not null references public.gie360_organizations(id), request_key uuid not null unique,
  submitted_by uuid not null references auth.users(id), revision integer not null,
  answers jsonb not null, information_gaps text[] not null default '{}',
  validation_status text not null default 'declared' check(validation_status='declared'),
  created_at timestamptz not null default now()
);
create schema if not exists private;
create or replace function private.gie360_can_access(p_organization_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select auth.uid() is not null and exists(select 1 from public.gie360_organizations o
    where o.id=p_organization_id and (o.manager_user_id=auth.uid() or exists(
      select 1 from public.gie360_memberships m where m.organization_id=o.id and m.client_user_id=auth.uid())))
$$;
create or replace function private.gie360_can_manage(p_organization_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select auth.uid() is not null and exists(select 1 from public.gie360_organizations
    where id=p_organization_id and manager_user_id=auth.uid())
$$;
revoke all on function private.gie360_can_access(uuid),private.gie360_can_manage(uuid) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.gie360_can_access(uuid),private.gie360_can_manage(uuid) to authenticated;
alter table public.pcc_products enable row level security;
alter table public.pcc_product_packages enable row level security;
alter table public.gie360_organizations enable row level security;
alter table public.gie360_memberships enable row level security;
alter table public.gie360_assessments enable row level security;
alter table public.gie360_submissions enable row level security;
grant select on public.pcc_products,public.pcc_product_packages,public.gie360_organizations,public.gie360_memberships,public.gie360_assessments,public.gie360_submissions to authenticated;
revoke all on public.pcc_products,public.pcc_product_packages,public.gie360_organizations,public.gie360_memberships,public.gie360_assessments,public.gie360_submissions from anon;
create policy products_read on public.pcc_products for select to authenticated using(true);
create policy packages_read on public.pcc_product_packages for select to authenticated using(true);
create policy organization_read on public.gie360_organizations for select to authenticated using(private.gie360_can_access(id));
create policy memberships_read on public.gie360_memberships for select to authenticated using(client_user_id=auth.uid() or private.gie360_can_manage(organization_id));
create policy assessments_read on public.gie360_assessments for select to authenticated using(private.gie360_can_access(organization_id));
create policy submissions_read on public.gie360_submissions for select to authenticated using(private.gie360_can_access(organization_id));

-- Narrow privileged bridge: case owner provisions a client; no public membership insertion.
create or replace function private.gie360_provision(p_case_id uuid,p_client_email text,p_name text,p_profile jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_org uuid; v_request uuid; v_existing uuid; p_client_user_id uuid;
begin
 if auth.uid() is null or exists(select 1 from public.gie360_memberships where client_user_id=auth.uid()) or not exists(select 1 from public.project_factory_cases where id=p_case_id and user_id=auth.uid()) then
   raise exception 'PCC case owner required'; end if;
 select id into p_client_user_id from auth.users where lower(email)=lower(trim(p_client_email)) and email_confirmed_at is not null;
 if p_client_user_id is null or p_client_user_id=auth.uid() or not exists(select 1 from auth.users where id=p_client_user_id) then
   raise exception 'A separate existing client account is required'; end if;
 if exists(select 1 from public.project_factory_cases where user_id=p_client_user_id) or
    exists(select 1 from public.projects where user_id=p_client_user_id) or
    exists(select 1 from public.user_roles where user_id=p_client_user_id) then
   raise exception 'Client must not have PCC management ownership'; end if;
 if length(trim(coalesce(p_name,''))) not between 2 and 200 or
    jsonb_typeof(p_profile) is distinct from 'object' or octet_length(p_profile::text)>16000 then raise exception 'Invalid company profile'; end if;
 perform 1 from public.project_factory_cases where id=p_case_id for update;
 if exists(select 1 from jsonb_each(p_profile) where key in ('sector','size','age','systems') and (jsonb_typeof(value)<>'string' or length(value#>>'{}')>2000)) then raise exception 'Invalid company profile'; end if;
 select a.organization_id into v_existing from public.gie360_assessments a
   join public.gie360_memberships m on m.organization_id=a.organization_id
   where a.factory_case_id=p_case_id and m.client_user_id=p_client_user_id;
 if v_existing is not null then return v_existing; end if;
 insert into public.gie360_organizations(manager_user_id,name,company_profile) values(auth.uid(),trim(p_name),p_profile) returning id into v_org;
 insert into public.gie360_memberships values(v_org,p_client_user_id,now());
 insert into public.client_diagnostic_requests(user_id,factory_case_id,token_hash,questionnaire_version,client_organization,status,expires_at)
 values(auth.uid(),p_case_id,replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''),'gie360-v1',trim(p_name),'active',now()+interval '90 days') returning id into v_request;
 insert into public.gie360_assessments(organization_id,factory_case_id,request_id,answers)
 values(v_org,p_case_id,v_request,jsonb_strip_nulls(jsonb_build_object('sector',p_profile->'sector','size',p_profile->'size','age',p_profile->'age','systems',p_profile->'systems')));
 return v_org;
end; $$;
revoke all on function private.gie360_provision(uuid,text,text,jsonb) from public,anon;
grant execute on function private.gie360_provision(uuid,text,text,jsonb) to authenticated;
create function public.gie360_provision(p_case_id uuid,p_client_email text,p_name text,p_profile jsonb default '{}'::jsonb)
returns uuid language sql security invoker set search_path=public,pg_temp as $$select private.gie360_provision(p_case_id,p_client_email,p_name,p_profile)$$;
revoke all on function public.gie360_provision(uuid,text,text,jsonb) from public,anon;
grant execute on function public.gie360_provision(uuid,text,text,jsonb) to authenticated;

create or replace function private.gie360_save_assessment(p_assessment_id uuid,p_expected_revision integer,p_answers jsonb,p_submit boolean,p_request_key uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_a public.gie360_assessments%rowtype; v_org public.gie360_organizations%rowtype;
 v_gaps text[] := '{}'; v_key text; v_request public.client_diagnostic_requests%rowtype; v_previous public.gie360_submissions%rowtype;
 v_allowed text[] := array['sector','size','age','systems','problems','proposals','collections','costs','accounting','documents','desired_result','horizon'];
begin
 select * into v_a from public.gie360_assessments where id=p_assessment_id for update;
 if v_a.id is null or not private.gie360_can_access(v_a.organization_id) then raise exception 'Assessment inaccessible'; end if;
 select * into v_previous from public.gie360_submissions where assessment_id=v_a.id;
 if v_previous.id is not null then
  if p_submit and v_previous.request_key=p_request_key then return jsonb_build_object('id',v_a.id,'revision',v_a.revision,'status','submitted','information_gaps',v_previous.information_gaps); end if;
  raise exception 'Assessment already submitted';
 end if;
 if p_expected_revision is null or p_expected_revision<0 or v_a.revision<>p_expected_revision then raise exception 'Revision conflict: reload before saving'; end if;
 if p_submit is null then raise exception 'Submission intent required'; end if;
 if jsonb_typeof(p_answers) is distinct from 'object' or octet_length(p_answers::text)>32000 then raise exception 'Invalid answers'; end if;
 for v_key in select jsonb_object_keys(p_answers) loop
   if not(v_key=any(v_allowed)) or jsonb_typeof(p_answers->v_key)<>'string' or length(p_answers->>v_key)>2000 then raise exception 'Invalid question answer'; end if;
 end loop;
 if p_submit then
  if p_request_key is null then raise exception 'Idempotency key required'; end if;
  select * into v_request from public.client_diagnostic_requests where id=v_a.request_id for update;
  if v_request.status not in ('active','opened') or v_request.expires_at<=now() then raise exception 'Questionnaire revoked, expired or unavailable'; end if;
  foreach v_key in array v_allowed loop
   if length(trim(coalesce(p_answers->>v_key,'')))=0 or lower(trim(p_answers->>v_key)) in ('não sei','nao sei','não disponível','nao disponivel') then
    v_gaps:=array_append(v_gaps,v_key);
   end if;
  end loop;
  select * into v_org from public.gie360_organizations where id=v_a.organization_id;
  insert into public.gie360_submissions(assessment_id,organization_id,request_key,submitted_by,revision,answers,information_gaps)
  values(v_a.id,v_a.organization_id,p_request_key,auth.uid(),v_a.revision+1,p_answers,v_gaps);
  insert into public.client_diagnostic_responses(request_id,respondent_name,answers)
  values(v_a.request_id,v_org.name,p_answers||jsonb_build_object('organization',v_org.name,'context',p_answers->>'problems','focus',p_answers->>'problems','deadline_urgency',p_answers->>'horizon','validation_status','declared','information_gaps',to_jsonb(v_gaps)));
  update public.client_diagnostic_requests set status='analyzing',submitted_at=now(),triaged_at=now(),triage_missing_information=array(select case gap when 'sector' then 'Sector de actividade' when 'size' then 'Dimensão da empresa' when 'age' then 'Antiguidade' when 'systems' then 'Sistemas de gestão' when 'problems' then 'Problemas a resolver' when 'proposals' then 'Gestão de propostas' when 'collections' then 'Atrasos de cobranças' when 'costs' then 'Conhecimento de custos' when 'accounting' then 'Organização contabilística' when 'documents' then 'Documentos disponíveis' when 'desired_result' then 'Resultado pretendido' when 'horizon' then 'Horizonte pretendido' else gap end from unnest(v_gaps) as gap),triage_points_to_confirm=array['Respostas declaradas pelo cliente; validação documental pendente.'],updated_at=now() where id=v_a.request_id;
  insert into public.notifications(user_id,type,title,message,priority,related_entity_type,related_entity_id)
  values(v_org.manager_user_id,'gie360_submission','Diagnóstico GIE360° recebido',v_org.name||': '||cardinality(v_gaps)||' campos por confirmar. Respostas declaradas, não validadas.','high','project_factory_case',v_a.factory_case_id);
 end if;
 update public.gie360_assessments set answers=p_answers,revision=revision+1,status=case when p_submit then 'submitted' else 'draft' end,submitted_at=case when p_submit then now() else null end,updated_at=now() where id=v_a.id;
 return jsonb_build_object('id',v_a.id,'revision',v_a.revision+1,'status',case when p_submit then 'submitted' else 'draft' end,'information_gaps',v_gaps);
end; $$;
revoke all on function private.gie360_save_assessment(uuid,integer,jsonb,boolean,uuid) from public,anon;
grant execute on function private.gie360_save_assessment(uuid,integer,jsonb,boolean,uuid) to authenticated;
create function public.gie360_save_assessment(p_assessment_id uuid,p_expected_revision integer,p_answers jsonb,p_submit boolean default false,p_request_key uuid default null)
returns jsonb language sql security invoker set search_path=public,pg_temp as $$select private.gie360_save_assessment(p_assessment_id,p_expected_revision,p_answers,p_submit,p_request_key)$$;
revoke all on function public.gie360_save_assessment(uuid,integer,jsonb,boolean,uuid) from public,anon;
grant execute on function public.gie360_save_assessment(uuid,integer,jsonb,boolean,uuid) to authenticated;

alter table public.gie360_organizations add column contract_reference text,
 add column contract_approved boolean not null default false;
create table public.gie360_scope_events (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.gie360_organizations(id),
 actor_id uuid not null references auth.users(id), package_code text not null,
 approved_modules text[] not null, ai_cloud_authorized boolean not null,
 contract_reference text not null, created_at timestamptz not null default now()
);
alter table public.gie360_scope_events enable row level security;
grant select on public.gie360_scope_events to authenticated;
revoke all on public.gie360_scope_events from anon;
create policy scope_events_read on public.gie360_scope_events for select to authenticated using(private.gie360_can_access(organization_id));
create function private.gie360_configure_organization(p_organization_id uuid,p_package_code text,p_approved_modules text[],p_ai_cloud_authorized boolean,p_contract_reference text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare v_modules text[];
begin
 if not private.gie360_can_manage(p_organization_id) or exists(select 1 from public.gie360_memberships where client_user_id=auth.uid()) then raise exception 'Organization manager required'; end if;
 select modules into v_modules from public.pcc_product_packages where code=p_package_code and product_code='gie360';
 if v_modules is null or p_approved_modules is null or not(p_approved_modules<@v_modules) then raise exception 'Invalid package scope'; end if;
 if p_ai_cloud_authorized is null or (p_ai_cloud_authorized and not('ai'=any(p_approved_modules))) then raise exception 'AI requires contracted and approved scope'; end if;
 if length(trim(coalesce(p_contract_reference,''))) not between 3 and 500 then raise exception 'Agreement reference required'; end if;
 update public.gie360_organizations set package_code=p_package_code,approved_modules=p_approved_modules,ai_cloud_authorized=p_ai_cloud_authorized,contract_reference=trim(p_contract_reference),contract_approved=true where id=p_organization_id;
 insert into public.gie360_scope_events(organization_id,actor_id,package_code,approved_modules,ai_cloud_authorized,contract_reference) values(p_organization_id,auth.uid(),p_package_code,p_approved_modules,p_ai_cloud_authorized,trim(p_contract_reference));
 return true;
end; $$;
revoke all on function private.gie360_configure_organization(uuid,text,text[],boolean,text) from public,anon;
grant execute on function private.gie360_configure_organization(uuid,text,text[],boolean,text) to authenticated;
create function public.gie360_configure_organization(p_organization_id uuid,p_package_code text,p_approved_modules text[],p_ai_cloud_authorized boolean,p_contract_reference text)
returns boolean language sql security invoker set search_path=public,pg_temp as $$select private.gie360_configure_organization(p_organization_id,p_package_code,p_approved_modules,p_ai_cloud_authorized,p_contract_reference)$$;
revoke all on function public.gie360_configure_organization(uuid,text,text[],boolean,text) from public,anon;
grant execute on function public.gie360_configure_organization(uuid,text,text[],boolean,text) to authenticated;
