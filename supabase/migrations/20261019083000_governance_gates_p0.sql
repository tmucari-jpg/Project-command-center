-- ============================================================
-- PCC GOVERNANCE GATES P0
-- Formaliza G1-G5 sem confundir o gate com a decisão humana.
-- Casos existentes da Factory ficam em G2; projectos existentes ficam em G4.
-- Novos projectos aprovados pela Factory entram explicitamente em G3.
-- ============================================================

alter table public.project_factory_cases
  add column if not exists governance_gate text,
  add column if not exists governance_gate_status text,
  add column if not exists g1_completed_at timestamptz,
  add column if not exists g2_completed_at timestamptz;

update public.project_factory_cases
set governance_gate = 'g2_viability'
where governance_gate is null;

update public.project_factory_cases
set governance_gate_status =
  case
    when stage in ('killed') then 'completed'
    when stage in ('on_hold') then 'blocked'
    when stage in ('decision','factory_report') then 'ready'
    else 'in_progress'
  end
where governance_gate_status is null;

alter table public.project_factory_cases
  alter column governance_gate set default 'g1_triage',
  alter column governance_gate set not null,
  alter column governance_gate_status set default 'in_progress',
  alter column governance_gate_status set not null;

alter table public.project_factory_cases
  drop constraint if exists project_factory_cases_governance_gate_check,
  add constraint project_factory_cases_governance_gate_check
    check (governance_gate in ('g1_triage','g2_viability'));

alter table public.project_factory_cases
  drop constraint if exists project_factory_cases_governance_gate_status_check,
  add constraint project_factory_cases_governance_gate_status_check
    check (governance_gate_status in ('in_progress','ready','approved','blocked','completed'));

alter table public.projects
  add column if not exists governance_gate text,
  add column if not exists governance_gate_status text;

update public.projects
set governance_gate = 'g4_execution'
where governance_gate is null;

update public.projects
set governance_gate_status =
  case
    when status in ('completed','cancelled','archived') then 'completed'
    when status in ('blocked','on_hold') then 'blocked'
    else 'in_progress'
  end
where governance_gate_status is null;

alter table public.projects
  alter column governance_gate set default 'g3_planning',
  alter column governance_gate set not null,
  alter column governance_gate_status set default 'in_progress',
  alter column governance_gate_status set not null;

alter table public.projects
  drop constraint if exists projects_governance_gate_check,
  add constraint projects_governance_gate_check
    check (governance_gate in ('g3_planning','g4_execution','g5_closure'));

alter table public.projects
  drop constraint if exists projects_governance_gate_status_check,
  add constraint projects_governance_gate_status_check
    check (governance_gate_status in ('in_progress','ready','approved','blocked','completed'));

create table if not exists public.project_gate_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  factory_case_id uuid references public.project_factory_cases(id) on delete cascade,
  gate text not null check (gate in ('g1_triage','g2_viability','g3_planning','g4_execution','g5_closure')),
  event_type text not null check (event_type in ('entered','ready','approved','blocked','reopened','completed')),
  decision text check (decision is null or decision in ('go','modify','hold','kill')),
  rationale text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (project_id is not null or factory_case_id is not null)
);

create index if not exists idx_project_gate_events_user_id
  on public.project_gate_events(user_id);
create index if not exists idx_project_gate_events_project_id
  on public.project_gate_events(project_id);
create index if not exists idx_project_gate_events_factory_case_id
  on public.project_gate_events(factory_case_id);
create index if not exists idx_project_gate_events_created_at
  on public.project_gate_events(created_at desc);

alter table public.project_gate_events enable row level security;

drop policy if exists "Users can view own gate events" on public.project_gate_events;
create policy "Users can view own gate events"
on public.project_gate_events for select to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can create own gate events" on public.project_gate_events;
create policy "Users can create own gate events"
on public.project_gate_events for insert to authenticated
with check (user_id = auth.uid());

comment on column public.project_factory_cases.governance_gate is
  'Gate de governança do PCC. Factory cobre G1 Triagem e G2 Viabilidade.';
comment on column public.projects.governance_gate is
  'Gate de governança do PCC. Projectos aprovados cobrem G3 Planeamento, G4 Execução e G5 Encerramento.';
comment on table public.project_gate_events is
  'Histórico imutável de progressão e decisões dos Gates de Governança do PCC.';
