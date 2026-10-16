alter table public.projects
  add column if not exists owner_id uuid references public.profiles(id) on delete set null,
  add column if not exists next_review_date date,
  add column if not exists decision_gate text not null default 'validate'
    check (decision_gate in ('validate','launch','scale','hold','stop')),
  add column if not exists gate_status text not null default 'pending'
    check (gate_status in ('pending','ready','approved','blocked'));

alter table public.deliverables
  add column if not exists owner_id uuid references public.profiles(id) on delete set null;

create index if not exists idx_projects_owner_id on public.projects(owner_id);
create index if not exists idx_projects_next_review_date on public.projects(next_review_date);
create index if not exists idx_deliverables_owner_id on public.deliverables(owner_id);

create table if not exists public.project_dependencies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  depends_on_project_id uuid not null references public.projects(id) on delete cascade,
  relation_type text not null default 'depends_on'
    check (relation_type in ('depends_on','blocks','related')),
  status text not null default 'active'
    check (status in ('active','resolved')),
  notes text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (project_id, depends_on_project_id, relation_type),
  check (project_id <> depends_on_project_id)
);

create index if not exists idx_project_dependencies_user_id on public.project_dependencies(user_id);
create index if not exists idx_project_dependencies_project_id on public.project_dependencies(project_id);
create index if not exists idx_project_dependencies_depends_on on public.project_dependencies(depends_on_project_id);

alter table public.project_dependencies enable row level security;

drop policy if exists "Users can view own project dependencies" on public.project_dependencies;
create policy "Users can view own project dependencies"
on public.project_dependencies for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_global_admin()));

drop policy if exists "Users can create own project dependencies" on public.project_dependencies;
create policy "Users can create own project dependencies"
on public.project_dependencies for insert to authenticated
with check (user_id = (select auth.uid()) or (select private.is_global_admin()));

drop policy if exists "Users can update own project dependencies" on public.project_dependencies;
create policy "Users can update own project dependencies"
on public.project_dependencies for update to authenticated
using (user_id = (select auth.uid()) or (select private.is_global_admin()))
with check (user_id = (select auth.uid()) or (select private.is_global_admin()));

drop policy if exists "Users can delete own project dependencies" on public.project_dependencies;
create policy "Users can delete own project dependencies"
on public.project_dependencies for delete to authenticated
using (user_id = (select auth.uid()) or (select private.is_global_admin()));

grant select, insert, update, delete on public.project_dependencies to authenticated;

create table if not exists public.project_unit_economics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  cac numeric,
  conversion_rate_pct numeric check (conversion_rate_pct is null or (conversion_rate_pct >= 0 and conversion_rate_pct <= 100)),
  arpu numeric,
  gross_margin_pct numeric check (gross_margin_pct is null or (gross_margin_pct >= -1000 and gross_margin_pct <= 100)),
  payback_months numeric check (payback_months is null or payback_months >= 0),
  currency text,
  period_start date,
  period_end date,
  source_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id)
);

create index if not exists idx_project_unit_economics_user_id on public.project_unit_economics(user_id);

alter table public.project_unit_economics enable row level security;

drop policy if exists "Users can view own project unit economics" on public.project_unit_economics;
create policy "Users can view own project unit economics"
on public.project_unit_economics for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_global_admin()));

drop policy if exists "Users can create own project unit economics" on public.project_unit_economics;
create policy "Users can create own project unit economics"
on public.project_unit_economics for insert to authenticated
with check (user_id = (select auth.uid()) or (select private.is_global_admin()));

drop policy if exists "Users can update own project unit economics" on public.project_unit_economics;
create policy "Users can update own project unit economics"
on public.project_unit_economics for update to authenticated
using (user_id = (select auth.uid()) or (select private.is_global_admin()))
with check (user_id = (select auth.uid()) or (select private.is_global_admin()));

drop policy if exists "Users can delete own project unit economics" on public.project_unit_economics;
create policy "Users can delete own project unit economics"
on public.project_unit_economics for delete to authenticated
using (user_id = (select auth.uid()) or (select private.is_global_admin()));

grant select, insert, update, delete on public.project_unit_economics to authenticated;
