-- ============================================================
-- PROJECT FACTORY MVP
-- Block 1: mandatory idea intake and routing to viability.
-- ============================================================

create table if not exists public.project_factory_cases (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,

  title text not null,
  description text,
  problem text not null,
  project_type text not null
    check (project_type in ('commercial', 'non_commercial')),
  target_user text,
  expected_value text,
  constraints text,
  source text,

  stage text not null default 'new_idea'
    check (
      stage in (
        'new_idea',
        'viability',
        'competitive_intelligence',
        'validation',
        'execution_arena',
        'factory_report',
        'decision',
        'converted_to_project',
        'on_hold',
        'killed'
      )
    ),

  competitive_intelligence_required boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_project_factory_cases_user_id
  on public.project_factory_cases(user_id);

create index if not exists idx_project_factory_cases_stage
  on public.project_factory_cases(stage);

create index if not exists idx_project_factory_cases_project_id
  on public.project_factory_cases(project_id);

alter table public.project_factory_cases enable row level security;

drop policy if exists "Users can view own factory cases"
  on public.project_factory_cases;
create policy "Users can view own factory cases"
  on public.project_factory_cases
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can create own factory cases"
  on public.project_factory_cases;
create policy "Users can create own factory cases"
  on public.project_factory_cases
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can update own factory cases"
  on public.project_factory_cases;
create policy "Users can update own factory cases"
  on public.project_factory_cases
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete own factory cases"
  on public.project_factory_cases;
create policy "Users can delete own factory cases"
  on public.project_factory_cases
  for delete
  to authenticated
  using (user_id = auth.uid());

drop trigger if exists update_project_factory_cases_updated_at
  on public.project_factory_cases;
create trigger update_project_factory_cases_updated_at
  before update on public.project_factory_cases
  for each row
  execute function public.update_updated_at_column();

create or replace function public.enforce_factory_owned_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.project_id is not null and not exists (
    select 1
    from public.projects p
    where p.id = new.project_id
      and p.user_id = new.user_id
  ) then
    raise exception 'Factory project must belong to the same user';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_factory_owned_project_trigger
  on public.project_factory_cases;
create trigger enforce_factory_owned_project_trigger
  before insert or update on public.project_factory_cases
  for each row
  execute function public.enforce_factory_owned_project();

revoke all on function public.enforce_factory_owned_project()
  from public, anon, authenticated;
