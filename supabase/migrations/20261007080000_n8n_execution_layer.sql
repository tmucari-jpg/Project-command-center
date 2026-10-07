-- ============================================================
-- N8N EXECUTION LAYER
-- Command Center owns decisions; n8n is a replaceable execution engine.
-- No credentials are stored in these tables.
-- ============================================================

create table if not exists public.automation_workflows (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  engine text not null default 'n8n'
    check (engine in ('n8n')),
  trigger_mode text not null default 'webhook'
    check (trigger_mode in ('webhook','poll')),
  is_active boolean not null default true,
  requires_approval boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, code)
);

create table if not exists public.automation_jobs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  workflow_id uuid references public.automation_workflows(id) on delete set null,
  orchestrator_route_id uuid references public.orchestrator_routes(id) on delete set null,
  factory_case_id uuid references public.project_factory_cases(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,

  objective text not null,
  payload jsonb not null default '{}'::jsonb,
  priority text not null default 'normal'
    check (priority in ('low','normal','high')),
  status text not null default 'queued'
    check (status in ('queued','approved','dispatching','running','succeeded','failed','cancelled')),
  external_run_id text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  queued_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_automation_workflows_user_id
  on public.automation_workflows(user_id);
create index if not exists idx_automation_jobs_user_id
  on public.automation_jobs(user_id);
create index if not exists idx_automation_jobs_status
  on public.automation_jobs(status);
create index if not exists idx_automation_jobs_factory_case_id
  on public.automation_jobs(factory_case_id);
create index if not exists idx_automation_jobs_project_id
  on public.automation_jobs(project_id);

alter table public.automation_workflows enable row level security;
alter table public.automation_jobs enable row level security;

drop policy if exists "Users can view own automation workflows" on public.automation_workflows;
create policy "Users can view own automation workflows"
  on public.automation_workflows for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can create own automation workflows" on public.automation_workflows;
create policy "Users can create own automation workflows"
  on public.automation_workflows for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can update own automation workflows" on public.automation_workflows;
create policy "Users can update own automation workflows"
  on public.automation_workflows for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can view own automation jobs" on public.automation_jobs;
create policy "Users can view own automation jobs"
  on public.automation_jobs for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can create own automation jobs" on public.automation_jobs;
create policy "Users can create own automation jobs"
  on public.automation_jobs for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can update own automation jobs" on public.automation_jobs;
create policy "Users can update own automation jobs"
  on public.automation_jobs for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop trigger if exists update_automation_workflows_updated_at on public.automation_workflows;
create trigger update_automation_workflows_updated_at
  before update on public.automation_workflows
  for each row execute function public.update_updated_at_column();

drop trigger if exists update_automation_jobs_updated_at on public.automation_jobs;
create trigger update_automation_jobs_updated_at
  before update on public.automation_jobs
  for each row execute function public.update_updated_at_column();

create or replace function public.enforce_automation_job_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.workflow_id is not null and not exists (
    select 1 from public.automation_workflows w
    where w.id = new.workflow_id and w.user_id = new.user_id
  ) then
    raise exception 'Automation workflow must belong to the same user';
  end if;

  if new.orchestrator_route_id is not null and not exists (
    select 1 from public.orchestrator_routes r
    where r.id = new.orchestrator_route_id and r.user_id = new.user_id
  ) then
    raise exception 'Orchestrator route must belong to the same user';
  end if;

  if new.factory_case_id is not null and not exists (
    select 1 from public.project_factory_cases f
    where f.id = new.factory_case_id and f.user_id = new.user_id
  ) then
    raise exception 'Factory case must belong to the same user';
  end if;

  if new.project_id is not null and not exists (
    select 1 from public.projects p
    where p.id = new.project_id and p.user_id = new.user_id
  ) then
    raise exception 'Project must belong to the same user';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_automation_job_ownership_trigger on public.automation_jobs;
create trigger enforce_automation_job_ownership_trigger
  before insert or update on public.automation_jobs
  for each row execute function public.enforce_automation_job_ownership();

revoke all on function public.enforce_automation_job_ownership()
from public, anon, authenticated;
