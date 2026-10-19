create table if not exists public.project_governance_dependencies (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  factory_case_id uuid references public.project_factory_cases(id) on delete cascade,
  gate text not null check (gate in ('g1_triage','g2_viability','g3_planning','g4_execution','g5_closure')),
  kind text not null check (kind in ('information','validation','confirmation','decision')),
  owner_role text not null check (owner_role in ('pcc','project_owner')),
  required_item text not null,
  description text,
  status text not null default 'pending' check (status in ('pending','resolving','resolved','confirmed')),
  source_reference text,
  evidence text,
  missing_key text,
  blocks_progress boolean not null default false,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (project_id is not null or factory_case_id is not null),
  check (kind <> 'decision' or owner_role = 'project_owner')
);

create index if not exists idx_project_governance_dependencies_project
  on public.project_governance_dependencies(project_id,gate,status);
create index if not exists idx_project_governance_dependencies_factory
  on public.project_governance_dependencies(factory_case_id,gate,status);
create index if not exists idx_project_governance_dependencies_owner
  on public.project_governance_dependencies(owner_role,status);

alter table public.project_governance_dependencies enable row level security;

drop policy if exists "Users can view own governance dependencies" on public.project_governance_dependencies;
create policy "Users can view own governance dependencies"
on public.project_governance_dependencies for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_global_admin()));

drop policy if exists "Users can create own governance dependencies" on public.project_governance_dependencies;
create policy "Users can create own governance dependencies"
on public.project_governance_dependencies for insert to authenticated
with check (user_id = (select auth.uid()) or (select private.is_global_admin()));

drop policy if exists "Users can update own governance dependencies" on public.project_governance_dependencies;
create policy "Users can update own governance dependencies"
on public.project_governance_dependencies for update to authenticated
using (user_id = (select auth.uid()) or (select private.is_global_admin()))
with check (user_id = (select auth.uid()) or (select private.is_global_admin()));

drop trigger if exists update_project_governance_dependencies_updated_at on public.project_governance_dependencies;
create trigger update_project_governance_dependencies_updated_at
before update on public.project_governance_dependencies
for each row execute function public.update_updated_at_column();

comment on table public.project_governance_dependencies is
  'Dependencias de governanca: informacao, validacao, confirmacao ou decisao. PCC resolve primeiro tudo o que conseguir automaticamente.';
