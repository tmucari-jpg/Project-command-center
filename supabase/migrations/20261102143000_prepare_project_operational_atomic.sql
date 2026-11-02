-- PCC — transactional preparation, additive migration; do not run on production
-- No SECURITY DEFINER; function executes with caller's RLS permissions.
create or replace function public.prepare_project_operational_atomic(
  p_project_id uuid,
  p_workspace_user_id uuid
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_project public.projects%rowtype;
  v_objective_id uuid;
  v_deliverable_id uuid;
  v_deliverable public.deliverables%rowtype;
  v_title text;
begin
  -- Prevent arbitrary workspace impersonation. Admin access remains bound by RLS.
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if p_workspace_user_id <> auth.uid() and not exists (
    select 1 from public.user_roles r
    where r.user_id=auth.uid() and r.scope_type='global'
      and r.role in ('owner','admin')
  ) then raise exception 'WORKSPACE_FORBIDDEN' using errcode='42501'; end if;

  select * into v_project from public.projects
    where id=p_project_id and user_id=p_workspace_user_id for update;
  if not found then raise exception 'PROJECT_NOT_FOUND_OR_FORBIDDEN' using errcode='42501'; end if;

  v_objective_id := v_project.objective_id;
  if v_objective_id is null then
    insert into public.objectives
      (user_id,title,description,expected_result,priority,status,start_date,due_date,progress,notes)
    values
      (p_workspace_user_id,v_project.title,v_project.description,v_project.expected_result,
       v_project.priority,'draft',v_project.start_date,v_project.due_date,v_project.progress,v_project.notes)
    returning id into v_objective_id;
    update public.projects set objective_id=v_objective_id
      where id=p_project_id and user_id=p_workspace_user_id;
  end if;

  select id into v_deliverable_id from public.deliverables
    where project_id=p_project_id and user_id=p_workspace_user_id
    order by created_at,id limit 1;

  if v_deliverable_id is null and nullif(btrim(coalesce(v_project.expected_result,'')),'') is not null then
    insert into public.deliverables
      (user_id,project_id,title,description,priority,status,due_date,progress,completion_criteria)
    values
      (p_workspace_user_id,p_project_id,'Resultado de '||v_project.title,
       btrim(v_project.expected_result),v_project.priority,'pending',v_project.due_date,0,
       btrim(v_project.expected_result))
    returning id into v_deliverable_id;
  end if;

  for v_deliverable in
    select * from public.deliverables
      where project_id=p_project_id and user_id=p_workspace_user_id
        and status not in ('completed','cancelled')
  loop
    v_title := 'Preparar e validar: '||v_deliverable.title;
    if not exists (
      select 1 from public.actions a
      where a.user_id=p_workspace_user_id and a.project_id=p_project_id
        and a.deliverable_id=v_deliverable.id
        and lower(btrim(a.title))=lower(btrim(v_title))
    ) then
      insert into public.actions
        (user_id,project_id,deliverable_id,title,description,completion_criteria,priority,status,is_next_action)
      values
        (p_workspace_user_id,p_project_id,v_deliverable.id,v_title,
         coalesce(nullif(v_deliverable.description,''),v_project.description,v_project.expected_result),
         coalesce(nullif(v_deliverable.completion_criteria,''),v_project.expected_result,'Resultado sujeito à validação do responsável'),
         v_project.priority,'pending',false);
    end if;
  end loop;

  if not exists (select 1 from public.metrics
    where user_id=p_workspace_user_id and project_id=p_project_id)
    and nullif(btrim(coalesce(v_project.expected_result,'')),'') is not null then
    insert into public.metrics
      (user_id,objective_id,project_id,name,description,metric_type,unit,baseline_value,target_value,current_value)
    values
      (p_workspace_user_id,v_objective_id,p_project_id,'Progresso de '||v_project.title,
       'Mede o avanço do projecto face ao resultado esperado: '||btrim(v_project.expected_result),
       'custom','%',0,100,v_project.progress);
  end if;
  return jsonb_build_object('objective_id',v_objective_id,'deliverable_id',v_deliverable_id);
end; $$;

revoke all on function public.prepare_project_operational_atomic(uuid,uuid) from public, anon;
grant execute on function public.prepare_project_operational_atomic(uuid,uuid) to authenticated;
