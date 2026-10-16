create table if not exists public.project_strategy_execution_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  strategy jsonb not null default '{}'::jsonb,
  monetization jsonb not null default '{}'::jsonb,
  marketing jsonb not null default '{}'::jsonb,
  sales jsonb not null default '{}'::jsonb,
  execution jsonb not null default '{}'::jsonb,
  measurement jsonb not null default '{}'::jsonb,
  missing_items jsonb not null default '[]'::jsonb,
  source_snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'prepared'
    check (status in ('prepared','active','validated','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id)
);

create index if not exists idx_project_strategy_execution_plans_user_id
  on public.project_strategy_execution_plans(user_id);

alter table public.project_strategy_execution_plans enable row level security;

drop policy if exists "Users can view own strategy execution plans" on public.project_strategy_execution_plans;
create policy "Users can view own strategy execution plans"
on public.project_strategy_execution_plans
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_global_admin())
);

drop policy if exists "Users can create own strategy execution plans" on public.project_strategy_execution_plans;
create policy "Users can create own strategy execution plans"
on public.project_strategy_execution_plans
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  or (select private.is_global_admin())
);

drop policy if exists "Users can update own strategy execution plans" on public.project_strategy_execution_plans;
create policy "Users can update own strategy execution plans"
on public.project_strategy_execution_plans
for update
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_global_admin())
)
with check (
  user_id = (select auth.uid())
  or (select private.is_global_admin())
);

drop policy if exists "Users can delete own strategy execution plans" on public.project_strategy_execution_plans;
create policy "Users can delete own strategy execution plans"
on public.project_strategy_execution_plans
for delete
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_global_admin())
);
