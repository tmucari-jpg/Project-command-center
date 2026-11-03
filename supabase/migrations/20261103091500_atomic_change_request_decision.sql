-- Approval of a requested change, draft revision, and project status in one transaction.
-- Staging-only migration. Do not execute in production before authorized GO.
create or replace function public.decide_project_change_request_atomic(
 p_project_id uuid, p_request_id uuid, p_decision text, p_rationale text
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
 p public.projects%rowtype;
 r public.project_change_requests%rowtype;
 b public.project_commitment_baselines%rowtype;
 next_version integer;
 created_baseline_id uuid;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_decision not in ('approved','rejected','deferred')
    or length(btrim(coalesce(p_rationale,''))) < 2
    or length(p_rationale) > 6000 then raise exception 'INVALID_DECISION'; end if;

 select * into p from public.projects where id=p_project_id for update;
 if not found or not (p.user_id=auth.uid() or private.is_global_admin()) then
    raise exception 'PROJECT_NOT_ACCESSIBLE'; end if;

 select * into r from public.project_change_requests
  where id=p_request_id and project_id=p.id and user_id=p.user_id for update;
 if not found then raise exception 'CHANGE_REQUEST_NOT_FOUND'; end if;
 if r.decision <> 'pending' then raise exception 'CHANGE_REQUEST_ALREADY_DECIDED'; end if;

 if p_decision = 'approved' then
   select * into b from public.project_commitment_baselines
     where project_id=p.id and user_id=p.user_id and status='client_approved'
     order by version desc limit 1;
   if not found then raise exception 'APPROVED_BASELINE_REQUIRED'; end if;
   if exists(select 1 from public.project_commitment_baselines
      where project_id=p.id and user_id=p.user_id and status='draft') then
      raise exception 'REVISION_ALREADY_PENDING'; end if;
   select coalesce(max(version),0)+1 into next_version
     from public.project_commitment_baselines where project_id=p.id and user_id=p.user_id;
   insert into public.project_commitment_baselines(
      user_id,project_id,version,information_classification,expected_result,scope,exclusions,
      deliverables_summary,pcc_responsibilities,client_responsibilities,external_costs_terms,
      acceptance_terms,security_conditions,capacity_summary,cost_summary,status,created_by
   ) values(
      p.user_id,p.id,next_version,b.information_classification,b.expected_result,b.scope,b.exclusions,
      b.deliverables_summary,b.pcc_responsibilities,b.client_responsibilities,b.external_costs_terms,
      b.acceptance_terms,b.security_conditions,b.capacity_summary,b.cost_summary,'draft',auth.uid()
   ) returning id into created_baseline_id;
   update public.projects set governance_gate='g3_planning',governance_gate_status='in_progress',
      status='on_hold' where id=p.id and user_id=p.user_id;
 end if;
 update public.project_change_requests
    set decision=p_decision,decision_rationale=btrim(p_rationale),decided_at=now()
    where id=r.id and project_id=p.id and user_id=p.user_id;
 return created_baseline_id;
end; $$;
revoke all on function public.decide_project_change_request_atomic(uuid,uuid,text,text) from public,anon;
grant execute on function public.decide_project_change_request_atomic(uuid,uuid,text,text) to authenticated;
