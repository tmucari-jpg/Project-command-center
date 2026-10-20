-- PCC functional governance dependencies.
-- Creates only dependencies provable from current records; no historical decision is invented.

create unique index if not exists uq_project_governance_dependency_missing_key
  on public.project_governance_dependencies(project_id, missing_key)
  where project_id is not null and missing_key is not null;

create or replace function public.sync_project_core_governance_dependencies()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.owner_id is null then
    insert into public.project_governance_dependencies (
      user_id, project_id, gate, kind, owner_role, required_item,
      description, status, missing_key, blocks_progress
    )
    values (
      new.user_id, new.id, new.governance_gate, 'confirmation', 'project_owner',
      'Confirmar responsável pelo projecto',
      'O PCC não encontrou um responsável válido no registo do projecto.',
      'pending', 'owner_id', true
    )
    on conflict (project_id, missing_key) where project_id is not null and missing_key is not null
    do update set
      gate = excluded.gate,
      status = case
        when project_governance_dependencies.status in ('resolved','confirmed') then 'pending'
        else project_governance_dependencies.status
      end,
      resolved_at = null,
      updated_at = now();
  else
    update public.project_governance_dependencies
      set status = 'resolved', resolved_at = coalesce(resolved_at, now()), updated_at = now()
    where project_id = new.id
      and missing_key = 'owner_id'
      and status in ('pending','resolving');
  end if;

  if new.review_cadence_days is null then
    insert into public.project_governance_dependencies (
      user_id, project_id, gate, kind, owner_role, required_item,
      description, status, missing_key, blocks_progress
    )
    values (
      new.user_id, new.id, new.governance_gate, 'confirmation', 'project_owner',
      'Definir cadência de revisão',
      'Existe uma próxima revisão registada ou por definir, mas ainda não existe uma regra de cadência. O PCC não deve inventar a frequência.',
      'pending', 'review_cadence_days', false
    )
    on conflict (project_id, missing_key) where project_id is not null and missing_key is not null
    do update set
      gate = excluded.gate,
      status = case
        when project_governance_dependencies.status in ('resolved','confirmed') then 'pending'
        else project_governance_dependencies.status
      end,
      resolved_at = null,
      updated_at = now();
  else
    update public.project_governance_dependencies
      set status = 'resolved', resolved_at = coalesce(resolved_at, now()), updated_at = now()
    where project_id = new.id
      and missing_key = 'review_cadence_days'
      and status in ('pending','resolving');
  end if;

  return new;
end;
$$;

drop trigger if exists sync_project_core_governance_dependencies_trigger on public.projects;
create trigger sync_project_core_governance_dependencies_trigger
after insert or update of owner_id, review_cadence_days, governance_gate
on public.projects
for each row execute function public.sync_project_core_governance_dependencies();

-- Current-state backfill for objective, provable missing inputs.
insert into public.project_governance_dependencies (
  user_id, project_id, gate, kind, owner_role, required_item,
  description, status, missing_key, blocks_progress
)
select
  p.user_id, p.id, p.governance_gate, 'confirmation', 'project_owner',
  'Definir cadência de revisão',
  'O projecto não tem cadência parametrizada. A próxima revisão existente é preservada, mas a frequência futura precisa de regra explícita.',
  'pending', 'review_cadence_days', false
from public.projects p
where p.review_cadence_days is null
on conflict (project_id, missing_key) where project_id is not null and missing_key is not null
do nothing;

insert into public.project_governance_dependencies (
  user_id, project_id, gate, kind, owner_role, required_item,
  description, status, source_reference, missing_key, blocks_progress
)
select
  p.user_id, p.id, p.governance_gate, 'validation', 'pcc',
  'Validar monetização e retorno real',
  'O caso histórico ainda não contém uma classificação fundamentada de monetização e/ou retorno principal. O PCC deve recolher e cruzar evidência antes de concluir.',
  'pending', 'factory_validations', 'value_return_assessment',
  (p.governance_gate = 'g3_planning')
from public.projects p
join public.project_factory_cases f on f.project_id = p.id and f.user_id = p.user_id
left join public.factory_validations v on v.factory_case_id = f.id and v.user_id = p.user_id
where f.project_type = 'commercial'
  and (v.monetization_status is null or v.primary_return_type is null)
on conflict (project_id, missing_key) where project_id is not null and missing_key is not null
do nothing;
