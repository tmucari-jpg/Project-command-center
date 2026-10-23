-- PCC final delivery hardening.
-- Closes the remaining gaps between approved scope changes, external assets,
-- security transfer and the G5 closure gate.

alter table public.projects
  add column if not exists security_transfer_status text not null default 'pending',
  add column if not exists financial_close_status text not null default 'pending';

alter table public.projects
  drop constraint if exists projects_security_transfer_status_check,
  add constraint projects_security_transfer_status_check
    check (security_transfer_status in ('not_required','pending','completed'));

alter table public.projects
  drop constraint if exists projects_financial_close_status_check,
  add constraint projects_financial_close_status_check
    check (financial_close_status in ('not_required','pending','completed'));

alter table public.projects
  alter column handover_status set default 'pending',
  alter column continuity_status set default 'pending';

-- Active/open work must be explicitly assessed before G5. Historical completed
-- projects stay untouched.
update public.projects
set
  handover_status = case when handover_status = 'not_required' then 'pending' else handover_status end,
  continuity_status = case when continuity_status = 'not_required' then 'pending' else continuity_status end
where status not in ('completed','cancelled');

alter table public.project_change_requests
  add column if not exists incorporated_baseline_id uuid
    references public.project_commitment_baselines(id) on delete restrict;

create index if not exists idx_project_change_requests_baseline_id
  on public.project_change_requests(baseline_id)
  where baseline_id is not null;
create index if not exists idx_project_change_requests_incorporated_baseline_id
  on public.project_change_requests(incorporated_baseline_id)
  where incorporated_baseline_id is not null;
create index if not exists idx_project_change_requests_user_id
  on public.project_change_requests(user_id);
create index if not exists idx_project_change_requests_created_by
  on public.project_change_requests(created_by)
  where created_by is not null;
create index if not exists idx_project_commitment_baselines_user_id
  on public.project_commitment_baselines(user_id);
create index if not exists idx_project_commitment_baselines_created_by
  on public.project_commitment_baselines(created_by)
  where created_by is not null;

create table if not exists public.project_assets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  deliverable_id uuid references public.deliverables(id) on delete set null,
  asset_type text not null
    check (asset_type in ('domain','website','hosting','license','account','api','dataset','advertising','supplier_service','other')),
  title text not null,
  provider text,
  ownership_target text not null default 'client'
    check (ownership_target in ('client','pcc','third_party')),
  cost_treatment text not null default 'client_direct'
    check (cost_treatment in ('pcc_internal','client_direct','reimbursable_external','additional_scope')),
  cost_frequency text not null default 'one_off'
    check (cost_frequency in ('one_off','monthly','annual','usage')),
  estimated_cost numeric check (estimated_cost is null or estimated_cost >= 0),
  currency text,
  renewal_date date,
  transfer_status text not null default 'pending'
    check (transfer_status in ('pending','ready','transferred','revoked','not_required')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_project_assets_project_id
  on public.project_assets(project_id, transfer_status);
create index if not exists idx_project_assets_user_id
  on public.project_assets(user_id);
create index if not exists idx_project_assets_deliverable_id
  on public.project_assets(deliverable_id)
  where deliverable_id is not null;

alter table public.project_assets enable row level security;

drop policy if exists "Users can view own project assets" on public.project_assets;
create policy "Users can view own project assets"
on public.project_assets for select to authenticated
using ((user_id = (select auth.uid())) or (select private.is_global_admin()));

drop policy if exists "Users can create own project assets" on public.project_assets;
create policy "Users can create own project assets"
on public.project_assets for insert to authenticated
with check ((user_id = (select auth.uid())) or (select private.is_global_admin()));

drop policy if exists "Users can update own project assets" on public.project_assets;
create policy "Users can update own project assets"
on public.project_assets for update to authenticated
using ((user_id = (select auth.uid())) or (select private.is_global_admin()))
with check ((user_id = (select auth.uid())) or (select private.is_global_admin()));

create or replace function public.enforce_project_asset_owner()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.projects p
    where p.id = new.project_id and p.user_id = new.user_id
  ) then
    raise exception 'Project asset must belong to the same user';
  end if;

  if new.deliverable_id is not null and not exists (
    select 1 from public.deliverables d
    where d.id = new.deliverable_id
      and d.project_id = new.project_id
      and d.user_id = new.user_id
  ) then
    raise exception 'Project asset deliverable must belong to the same project and user';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_project_asset_owner_trigger on public.project_assets;
create trigger enforce_project_asset_owner_trigger
before insert or update on public.project_assets
for each row execute function public.enforce_project_asset_owner();

drop trigger if exists update_project_assets_updated_at on public.project_assets;
create trigger update_project_assets_updated_at
before update on public.project_assets
for each row execute function public.update_updated_at_column();

-- G5 must also hold at database level. This prevents a direct status update from
-- bypassing the application closure workflow.
create or replace function private.enforce_project_safe_closure()
returns trigger
language plpgsql
set search_path = ''
as $pcc$
begin
  if new.status = 'completed'
     and (
       tg_op = 'INSERT'
       or (tg_op = 'UPDATE' and old.status is distinct from 'completed')
     )
  then
    if not exists (
      select 1
      from public.project_commitment_baselines b
      where b.project_id = new.id
        and b.user_id = new.user_id
        and b.status = 'client_approved'
    ) then
      raise exception 'G5 bloqueado: falta Baseline de Compromisso validada.'
        using errcode = '23514';
    end if;

    if not exists (
      select 1 from public.deliverables d
      where d.project_id = new.id and d.user_id = new.user_id
    ) then
      raise exception 'G5 bloqueado: o projecto não tem entregáveis.'
        using errcode = '23514';
    end if;

    if exists (
      select 1 from public.deliverables d
      where d.project_id = new.id
        and d.user_id = new.user_id
        and (
          d.status <> 'completed'
          or d.locked_at is null
          or d.qa_status not in ('passed','not_required')
          or d.acceptance_status not in ('accepted','accepted_with_reservations','not_required')
        )
    ) then
      raise exception 'G5 bloqueado: existem entregáveis por concluir, validar, aceitar ou arquivar.'
        using errcode = '23514';
    end if;

    if exists (
      select 1 from public.blockers b
      where b.project_id = new.id
        and b.user_id = new.user_id
        and b.status in ('open','investigating','waiting')
    ) then
      raise exception 'G5 bloqueado: existem bloqueios activos.'
        using errcode = '23514';
    end if;

    if exists (
      select 1 from public.project_governance_risks r
      where r.project_id = new.id
        and r.user_id = new.user_id
        and r.blocks_progress = true
        and r.status in ('open','mitigating')
    ) then
      raise exception 'G5 bloqueado: existem riscos de governação bloqueantes.'
        using errcode = '23514';
    end if;

    if exists (
      select 1 from public.project_governance_dependencies d
      where d.project_id = new.id
        and d.user_id = new.user_id
        and d.blocks_progress = true
        and d.status in ('pending','resolving')
    ) then
      raise exception 'G5 bloqueado: existem dependências críticas pendentes.'
        using errcode = '23514';
    end if;

    if exists (
      select 1
      from public.project_change_requests c
      where c.project_id = new.id
        and c.user_id = new.user_id
        and (
          c.decision = 'pending'
          or (c.decision = 'approved' and c.incorporated_baseline_id is null)
        )
    ) then
      raise exception 'G5 bloqueado: existem alterações pendentes ou aprovadas ainda não incorporadas em nova baseline.'
        using errcode = '23514';
    end if;

    if exists (
      select 1 from public.project_assets a
      where a.project_id = new.id
        and a.user_id = new.user_id
        and a.transfer_status not in ('transferred','revoked','not_required')
    ) then
      raise exception 'G5 bloqueado: existem activos, contas ou acessos por transferir/revogar.'
        using errcode = '23514';
    end if;

    if new.value_status = 'not_assessed' then
      raise exception 'G5 bloqueado: o valor do projecto ainda não foi avaliado.'
        using errcode = '23514';
    end if;
    if new.handover_status = 'pending' then
      raise exception 'G5 bloqueado: handover pendente.'
        using errcode = '23514';
    end if;
    if new.security_transfer_status = 'pending' then
      raise exception 'G5 bloqueado: transferência/revogação de segurança pendente.'
        using errcode = '23514';
    end if;
    if new.financial_close_status = 'pending' then
      raise exception 'G5 bloqueado: fecho financeiro pendente.'
        using errcode = '23514';
    end if;
    if new.continuity_status = 'pending' then
      raise exception 'G5 bloqueado: continuidade/recuperação pendente.'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$pcc$;

drop trigger if exists enforce_project_safe_closure on public.projects;
create trigger enforce_project_safe_closure
before insert or update of status on public.projects
for each row execute function private.enforce_project_safe_closure();

comment on column public.projects.security_transfer_status is
  'Confirma transferência de propriedade/acessos e revogação dos acessos temporários antes do G5.';
comment on column public.projects.financial_close_status is
  'Confirma que custos, receitas, externos e pendências financeiras foram avaliados antes do G5.';
comment on column public.project_change_requests.incorporated_baseline_id is
  'Nova baseline validada que incorporou uma alteração aprovada.';
comment on table public.project_assets is
  'Activos/custos externos do projecto, incluindo domínio, website, hosting, licenças, contas, publicidade e fornecedores, com propriedade, renovação e transferência controladas.';
