-- Additive staging-only migration. No production application is performed by QA.
-- Locks serialize approvals; all state changes and audit events commit together.
create or replace function public.approve_commitment_atomic(
 p_project_id uuid, p_baseline_id uuid, p_client boolean default false, p_reference text default null
) returns void language plpgsql security invoker set search_path = '' as $$
declare p public.projects%rowtype; b public.project_commitment_baselines%rowtype;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into p from public.projects where id=p_project_id for update;
 if not found or not (p.user_id=auth.uid() or private.is_global_admin()) then raise exception 'Project inaccessible'; end if;
 select * into b from public.project_commitment_baselines where id=p_baseline_id and project_id=p.id and user_id=p.user_id for update;
 if not found then raise exception 'Baseline inaccessible'; end if;
 if p_client then
   if b.status<>'internal_approved' then raise exception 'Internal approval required'; end if;
   if length(btrim(coalesce(p_reference,'')))<2 or length(p_reference)>2000 then raise exception 'Explicit client reference required'; end if;
 else
   if b.status<>'draft' then raise exception 'Draft baseline required'; end if;
   if nullif(btrim(b.capacity_summary),'') is null or nullif(btrim(b.cost_summary),'') is null or nullif(btrim(b.security_conditions),'') is null then raise exception 'Capacity, cost and security required'; end if;
   if exists(select 1 from public.project_governance_risks r where r.project_id=p.id and r.user_id=p.user_id and r.gate='g3_planning' and r.blocks_progress and r.status not in ('mitigated','accepted','resolved'))
     or exists(select 1 from public.project_governance_dependencies d where d.project_id=p.id and d.user_id=p.user_id and d.gate='g3_planning' and d.blocks_progress and d.status in ('pending','resolving')) then raise exception 'Blocking G3 risk or dependency'; end if;
 end if;
 if p_client then
   update public.project_commitment_baselines set status='client_approved',client_validation_reference=btrim(p_reference),client_approved_at=now() where id=b.id;
   update public.project_commitment_baselines set status='superseded' where project_id=p.id and user_id=p.user_id and status='client_approved' and version<b.version;
   update public.projects set governance_gate='g4_execution',governance_gate_status='in_progress',status='active' where id=p.id;
 else
   update public.project_commitment_baselines set status='internal_approved',internal_approved_at=now() where id=b.id;
   update public.projects set governance_gate_status='ready' where id=p.id;
 end if;
 insert into public.project_gate_events(user_id,project_id,gate,event_type,decision,rationale,created_by)
 values(p.user_id,p.id,'g3_planning',case when p_client then 'approved' else 'ready' end,
 case when p_client then 'go' else null end,
 case when p_client then 'Validação explícita da baseline v'||b.version||': '||btrim(p_reference)
 else 'Capacidade, custos, segurança, riscos e dependências validados internamente.' end,auth.uid());
end; $$;
revoke all on function public.approve_commitment_atomic(uuid,uuid,boolean,text) from public,anon;
grant execute on function public.approve_commitment_atomic(uuid,uuid,boolean,text) to authenticated;

-- The reviewed flag represents the explicit UI action, never a system approval.
-- The existing link is revoked only if creation AND approval history both succeed.
create or replace function public.issue_reviewed_diagnostic_atomic(
 p_case_id uuid,p_token_hash text,p_name text,p_organization text,p_context text,
 p_expires_at timestamptz,p_content_sha256 text,p_reviewed boolean
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare c public.project_factory_cases%rowtype; rid uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_reviewed is distinct from true then raise exception 'Explicit internal review required'; end if;
 select * into c from public.project_factory_cases where id=p_case_id for update;
 -- Approval RLS requires the actual reviewer to own this case.
 if not found or c.user_id<>auth.uid() then raise exception 'Case owner required'; end if;
 if nullif(btrim(p_name),'') is null or nullif(btrim(p_organization),'') is null
   or length(p_name)>200 or length(p_organization)>300 or length(coalesce(p_context,''))>2000
   or p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$'
   or p_content_sha256 is null or p_content_sha256 !~ '^[a-f0-9]{64}$'
   or p_expires_at is null or p_expires_at<=now() or p_expires_at>now()+interval '8 days' then raise exception 'Invalid diagnostic approval'; end if;
 update public.client_diagnostic_requests set status='revoked' where factory_case_id=c.id and user_id=c.user_id and status in ('active','opened');
 insert into public.client_diagnostic_requests(user_id,factory_case_id,token_hash,questionnaire_version,client_name,client_organization,public_context,status,expires_at)
 values(c.user_id,c.id,p_token_hash,'executive-v3',btrim(p_name),btrim(p_organization),coalesce(p_context,''),'active',p_expires_at) returning id into rid;
 insert into public.pcc_external_share_approvals(request_id,factory_case_id,manager_user_id,audience_name,audience_organization,public_context,content_sha256,expires_at)
 values(rid,c.id,auth.uid(),btrim(p_name),btrim(p_organization),coalesce(p_context,''),p_content_sha256,p_expires_at);
 return rid;
end; $$;
revoke all on function public.issue_reviewed_diagnostic_atomic(uuid,text,text,text,text,timestamptz,text,boolean) from public,anon;
grant execute on function public.issue_reviewed_diagnostic_atomic(uuid,text,text,text,text,timestamptz,text,boolean) to authenticated;
