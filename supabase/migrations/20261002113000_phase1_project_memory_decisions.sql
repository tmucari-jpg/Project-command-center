-- ============================================================
-- PHASE 1 FOUNDATION
-- Project Memory + Decision History
-- Additive migration only. Existing Project/Objective/Action data remains source of truth.
-- ============================================================

create table if not exists public.project_memory (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  memory_type text not null
    check (memory_type in ('context','decision_context','constraint','assumption','learning','reference')),
  title text not null,
  content text not null,
  source text,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.decisions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  title text not null,
  context text,
  options_considered text,
  decision text not null,
  rationale text,
  decided_at timestamptz not null default now(),
  outcome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_project_memory_user_id on public.project_memory(user_id);
create index if not exists idx_project_memory_project_id on public.project_memory(project_id);
create index if not exists idx_decisions_user_id on public.decisions(user_id);
create index if not exists idx_decisions_project_id on public.decisions(project_id);

drop trigger if exists update_project_memory_updated_at on public.project_memory;
create trigger update_project_memory_updated_at
before update on public.project_memory
for each row execute function public.update_updated_at_column();

drop trigger if exists update_decisions_updated_at on public.decisions;
create trigger update_decisions_updated_at
before update on public.decisions
for each row execute function public.update_updated_at_column();

alter table public.project_memory enable row level security;
alter table public.decisions enable row level security;

drop policy if exists "Users can view own project memory" on public.project_memory;
create policy "Users can view own project memory"
on public.project_memory for select to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can create own project memory" on public.project_memory;
create policy "Users can create own project memory"
on public.project_memory for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update own project memory" on public.project_memory;
create policy "Users can update own project memory"
on public.project_memory for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can delete own project memory" on public.project_memory;
create policy "Users can delete own project memory"
on public.project_memory for delete to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can view own decisions" on public.decisions;
create policy "Users can view own decisions"
on public.decisions for select to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can create own decisions" on public.decisions;
create policy "Users can create own decisions"
on public.decisions for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update own decisions" on public.decisions;
create policy "Users can update own decisions"
on public.decisions for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can delete own decisions" on public.decisions;
create policy "Users can delete own decisions"
on public.decisions for delete to authenticated
using (user_id = auth.uid());

create or replace function public.enforce_phase1_owned_relationships()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null then
    raise exception 'user_id is required' using errcode = '23502';
  end if;

  if new.project_id is not null and not exists (
    select 1 from public.projects
    where id = new.project_id and user_id = new.user_id
  ) then
    raise exception 'project does not belong to user' using errcode = '23503';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_phase1_owned_relationships on public.project_memory;
create trigger enforce_phase1_owned_relationships
before insert or update on public.project_memory
for each row execute function public.enforce_phase1_owned_relationships();

drop trigger if exists enforce_phase1_owned_relationships on public.decisions;
create trigger enforce_phase1_owned_relationships
before insert or update on public.decisions
for each row execute function public.enforce_phase1_owned_relationships();
