-- ============================================================
-- ORCHESTRATOR ROUTING MVP
-- Agent + Dot + execution strategy selection without static model ranking.
-- ============================================================

create table if not exists public.orchestrator_routes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  factory_case_id uuid references public.project_factory_cases(id) on delete cascade,

  task_type text not null
    check (task_type in ('command','research','competitive_intelligence','business','marketing','product','qa','analytics')),
  objective text not null,
  risk_level text not null
    check (risk_level in ('low','medium','high','critical')),
  factuality text not null
    check (factuality in ('standard','high')),
  cost_sensitivity text not null
    check (cost_sensitivity in ('low','medium','high')),

  selected_agent text not null
    check (selected_agent in ('command','research','business','marketing','product','qa','analytics')),
  selected_dots jsonb not null default '[]'::jsonb,
  provider_policy text not null
    check (provider_policy in ('local_first','balanced','quality_first')),
  strategy text not null,
  approval_required boolean not null default false,
  rationale text not null,

  status text not null default 'proposed'
    check (status in ('proposed','approved','executing','completed','failed','cancelled')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_orchestrator_routes_user_id on public.orchestrator_routes(user_id);
create index if not exists idx_orchestrator_routes_project_id on public.orchestrator_routes(project_id);
create index if not exists idx_orchestrator_routes_factory_case_id on public.orchestrator_routes(factory_case_id);
create index if not exists idx_orchestrator_routes_status on public.orchestrator_routes(status);

alter table public.orchestrator_routes enable row level security;

drop policy if exists "Users can view own orchestrator routes" on public.orchestrator_routes;
create policy "Users can view own orchestrator routes"
on public.orchestrator_routes for select to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can create own orchestrator routes" on public.orchestrator_routes;
create policy "Users can create own orchestrator routes"
on public.orchestrator_routes for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update own orchestrator routes" on public.orchestrator_routes;
create policy "Users can update own orchestrator routes"
on public.orchestrator_routes for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop trigger if exists update_orchestrator_routes_updated_at on public.orchestrator_routes;
create trigger update_orchestrator_routes_updated_at
before update on public.orchestrator_routes
for each row execute function public.update_updated_at_column();

create or replace function public.enforce_orchestrator_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.project_id is not null and not exists (
    select 1 from public.projects p
    where p.id = new.project_id and p.user_id = new.user_id
  ) then
    raise exception 'Orchestrator project must belong to the same user';
  end if;

  if new.factory_case_id is not null and not exists (
    select 1 from public.project_factory_cases f
    where f.id = new.factory_case_id and f.user_id = new.user_id
  ) then
    raise exception 'Orchestrator Factory case must belong to the same user';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_orchestrator_ownership_trigger on public.orchestrator_routes;
create trigger enforce_orchestrator_ownership_trigger
before insert or update on public.orchestrator_routes
for each row execute function public.enforce_orchestrator_ownership();

revoke all on function public.enforce_orchestrator_ownership()
from public, anon, authenticated;
