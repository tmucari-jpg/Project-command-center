-- Creates the G3 deliverable as part of the existing approval RPC's transaction.
-- Trigger is invoker-security and uses existing RLS. No production migration executed here.
create or replace function public.create_g3_deliverable_on_internal_approval()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare v_project_title text;
begin
  if new.status <> 'internal_approved' or old.status = 'internal_approved' then return new; end if;
  select title into v_project_title from public.projects
   where id = new.project_id and user_id = new.user_id for update;
  if v_project_title is null then raise exception 'G3_PROJECT_UNAVAILABLE'; end if;
  if not exists (
    select 1 from public.deliverables
    where project_id=new.project_id and user_id=new.user_id
      and title='Carta de Compromisso - '||v_project_title
  ) then
    insert into public.deliverables
      (user_id,project_id,title,description,priority,status,progress,completion_criteria,artifact_type)
    values
      (new.user_id,new.project_id,'Carta de Compromisso - '||v_project_title,
       'Carta G3: minuta sujeita a revisão jurídica, aceitação expressa e arquivo.',
       'high','pending',0,'Carta aprovada, aceite e arquivada.','document');
  end if;
  return new;
end;
$$;
revoke all on function public.create_g3_deliverable_on_internal_approval() from public,anon;
drop trigger if exists g3_deliverable_internal_approval on public.project_commitment_baselines;
create trigger g3_deliverable_internal_approval
after update of status on public.project_commitment_baselines
for each row when (new.status='internal_approved' and old.status is distinct from new.status)
execute function public.create_g3_deliverable_on_internal_approval();
