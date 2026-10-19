-- ============================================================
-- PCC GOVERNANCE RISKS
-- Integra risco/segurança nos Gates sem criar uma etapa paralela.
-- Um risco crítico e bloqueante impede avanço do Gate.
-- ============================================================

create table if not exists public.project_governance_risks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  factory_case_id uuid references public.project_factory_cases(id) on delete cascade,

  gate text not null
    check (gate in ('g1_triage','g2_viability','g3_planning','g4_execution','g5_closure')),
  category text not null
    check (category in ('security','privacy','compliance','market','financial','operational','technology','third_party','other')),
  title text not null,
  description text,
  severity text not null
    check (severity in ('low','medium','high','critical')),
  status text not null default 'open'
    check (status in ('open','mitigating','mitigated','accepted','resolved')),
  blocks_progress boolean not null default false,
  mitigation_plan text,
  evidence text,
  owner_id uuid references auth.users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (project_id is not null or factory_case_id is not null),
  check (
    severity <> 'critical'
    or status in ('mitigated','accepted','resolved')
    or blocks_progress = true
  )
);

create index if not exists idx_project_governance_risks_user_id
  on public.project_governance_risks(user_id);
create index if not exists idx_project_governance_risks_project_id
  on public.project_governance_risks(project_id);
create index if not exists idx_project_governance_risks_factory_case_id
  on public.project_governance_risks(factory_case_id);
create index if not exists idx_project_governance_risks_gate_status
  on public.project_governance_risks(gate,status);
create index if not exists idx_project_governance_risks_blocking
  on public.project_governance_risks(blocks_progress,severity,status);

alter table public.project_governance_risks enable row level security;

drop policy if exists "Users can view own governance risks"
  on public.project_governance_risks;
create policy "Users can view own governance risks"
  on public.project_governance_risks
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can create own governance risks"
  on public.project_governance_risks;
create policy "Users can create own governance risks"
  on public.project_governance_risks
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can update own governance risks"
  on public.project_governance_risks;
create policy "Users can update own governance risks"
  on public.project_governance_risks
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can delete own governance risks"
  on public.project_governance_risks;
create policy "Users can delete own governance risks"
  on public.project_governance_risks
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

drop trigger if exists update_project_governance_risks_updated_at
  on public.project_governance_risks;
create trigger update_project_governance_risks_updated_at
  before update on public.project_governance_risks
  for each row
  execute function public.update_updated_at_column();

create or replace function public.enforce_governance_risk_ownership()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.project_id is not null and not exists (
    select 1
    from public.projects p
    where p.id = new.project_id
      and p.user_id = new.user_id
  ) then
    raise exception 'Governance risk project must belong to the same user';
  end if;

  if new.factory_case_id is not null and not exists (
    select 1
    from public.project_factory_cases f
    where f.id = new.factory_case_id
      and f.user_id = new.user_id
  ) then
    raise exception 'Governance risk factory case must belong to the same user';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_governance_risk_ownership_trigger
  on public.project_governance_risks;
create trigger enforce_governance_risk_ownership_trigger
  before insert or update on public.project_governance_risks
  for each row
  execute function public.enforce_governance_risk_ownership();

comment on table public.project_governance_risks is
  'Registo único de riscos de governança do PCC. Segurança, privacidade e compliance são categorias do mesmo modelo de Gate.';
comment on column public.project_governance_risks.blocks_progress is
  'Quando true e o risco continua aberto, o Gate não pode avançar.';
