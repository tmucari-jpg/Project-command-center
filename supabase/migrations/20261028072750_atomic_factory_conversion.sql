-- Atomically reserve and link the project before optional downstream preparation.
create or replace function public.convert_factory_case_atomic(p_case_id uuid,p_rationale text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare c public.project_factory_cases%rowtype; pid uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into c from public.project_factory_cases where id=p_case_id for update;
 if not found or not(c.user_id=auth.uid() or private.is_global_admin()) then raise exception 'Case inaccessible'; end if;
 if c.project_id is not null then
   if not exists(select 1 from public.projects p where p.id=c.project_id and p.user_id=c.user_id) then raise exception 'Linked project inaccessible'; end if;
   return c.project_id;
 end if;
 if nullif(btrim(p_rationale),'') is null then raise exception 'Decision rationale required'; end if;
 if not exists(select 1 from public.factory_validations v where v.factory_case_id=c.id and v.user_id=c.user_id and v.viability_status is not null and v.viability_status<>'insufficient') then raise exception 'Viability required'; end if;
 if exists(select 1 from public.project_governance_risks r where r.factory_case_id=c.id and r.user_id=c.user_id and r.gate='g2_viability' and r.blocks_progress and r.status not in ('mitigated','accepted','resolved')) then raise exception 'Blocking governance risk'; end if;
 if not exists(select 1 from public.factory_reports r where r.factory_case_id=c.id and r.user_id=c.user_id) then raise exception 'Decision report required'; end if;
 insert into public.projects(user_id,title,description,expected_result,priority,status,progress,notes,owner_id,currency,governance_gate,governance_gate_status)
 values(c.user_id,c.title,c.description,c.expected_value,'medium','planning',0,'Criado pela Project Factory. Origem: '||coalesce(c.source,'não indicada'),auth.uid(),'MZN','g3_planning','in_progress') returning id into pid;
 update public.factory_reports set status='decided',final_decision='go',decision_rationale=p_rationale,decided_at=now() where factory_case_id=c.id and user_id=c.user_id;
 update public.project_factory_cases set project_id=pid,stage='converted_to_project',governance_gate='g2_viability',governance_gate_status='approved',g2_completed_at=now() where id=c.id;
 return pid;
end; $$;
revoke all on function public.convert_factory_case_atomic(uuid,text) from public,anon;
grant execute on function public.convert_factory_case_atomic(uuid,text) to authenticated;
