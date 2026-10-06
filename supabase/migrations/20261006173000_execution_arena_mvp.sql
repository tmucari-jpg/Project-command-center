-- ============================================================
-- EXECUTION ARENA MVP
-- Evidence-based comparison of execution candidates.
-- ============================================================

create table if not exists public.execution_arena_trials (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  factory_case_id uuid references public.project_factory_cases(id) on delete cascade,
  orchestrator_route_id uuid references public.orchestrator_routes(id) on delete set null,

  scenario text not null,
  candidate_label text not null,
  model_label text,
  agent_type text not null
    check (agent_type in ('command','research','business','marketing','product','qa','analytics')),
  strategy text not null,
  tool_label text,

  quality_score integer not null check (quality_score between 0 and 100),
  factuality_score integer not null check (factuality_score between 0 and 100),
  task_success_score integer not null check (task_success_score between 0 and 100),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  cost_amount numeric check (cost_amount is null or cost_amount >= 0),
  cost_currency text,
  human_correction_minutes integer check (human_correction_minutes is null or human_correction_minutes >= 0),
  review_notes text,

  status text not null default 'measured'
    check (status in ('planned','measured','rejected','selected')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_execution_arena_trials_user_id
  on public.execution_arena_trials(user_id);
create index if not exists idx_execution_arena_trials_factory_case_id
  on public.execution_arena_trials(factory_case_id);
create index if not exists idx_execution_arena_trials_orchestrator_route_id
  on public.execution_arena_trials(orchestrator_route_id);

alter table public.execution_arena_trials enable row level security;

drop policy if exists "Users can view own execution arena trials"
  on public.execution_arena_trials;
create policy "Users can view own execution arena trials"
  on public.execution_arena_trials
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can create own execution arena trials"
  on public.execution_arena_trials;
create policy "Users can create own execution arena trials"
  on public.execution_arena_trials
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can update own execution arena trials"
  on public.execution_arena_trials;
create policy "Users can update own execution arena trials"
  on public.execution_arena_trials
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop trigger if exists update_execution_arena_trials_updated_at
  on public.execution_arena_trials;
create trigger update_execution_arena_trials_updated_at
  before update on public.execution_arena_trials
  for each row execute function public.update_updated_at_column();

create or replace function public.enforce_execution_arena_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.factory_case_id is not null and not exists (
    select 1 from public.project_factory_cases f
    where f.id = new.factory_case_id and f.user_id = new.user_id
  ) then
    raise exception 'Execution Arena Factory case must belong to the same user';
  end if;

  if new.orchestrator_route_id is not null and not exists (
    select 1 from public.orchestrator_routes r
    where r.id = new.orchestrator_route_id and r.user_id = new.user_id
  ) then
    raise exception 'Execution Arena route must belong to the same user';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_execution_arena_ownership_trigger
  on public.execution_arena_trials;
create trigger enforce_execution_arena_ownership_trigger
  before insert or update on public.execution_arena_trials
  for each row execute function public.enforce_execution_arena_ownership();

revoke all on function public.enforce_execution_arena_ownership()
from public, anon, authenticated;
