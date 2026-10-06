-- ============================================================
-- COMPETITIVE INTELLIGENCE LAYER
-- Commercial Project Factory cases only.
-- ============================================================

create table if not exists public.factory_competitive_intelligence (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  factory_case_id uuid not null unique references public.project_factory_cases(id) on delete cascade,

  market_summary text not null,
  competitors text not null,
  existing_solutions text not null,
  differentiation text not null,
  trends text not null,
  risks_barriers text not null,
  sources text not null,

  confidence text not null default 'medium'
    check (confidence in ('low','medium','high','verified')),

  status text not null default 'draft'
    check (status in ('draft','complete')),

  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_factory_ci_user_id
  on public.factory_competitive_intelligence(user_id);

create index if not exists idx_factory_ci_status
  on public.factory_competitive_intelligence(status);

alter table public.factory_competitive_intelligence enable row level security;

drop policy if exists "Users can view own factory competitive intelligence"
  on public.factory_competitive_intelligence;
create policy "Users can view own factory competitive intelligence"
  on public.factory_competitive_intelligence
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can create own factory competitive intelligence"
  on public.factory_competitive_intelligence;
create policy "Users can create own factory competitive intelligence"
  on public.factory_competitive_intelligence
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can update own factory competitive intelligence"
  on public.factory_competitive_intelligence;
create policy "Users can update own factory competitive intelligence"
  on public.factory_competitive_intelligence
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop trigger if exists update_factory_competitive_intelligence_updated_at
  on public.factory_competitive_intelligence;
create trigger update_factory_competitive_intelligence_updated_at
  before update on public.factory_competitive_intelligence
  for each row
  execute function public.update_updated_at_column();

create or replace function public.enforce_factory_ci_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.project_factory_cases f
    where f.id = new.factory_case_id
      and f.user_id = new.user_id
      and f.project_type = 'commercial'
  ) then
    raise exception 'Competitive Intelligence case must be an owned commercial Factory case';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_factory_ci_ownership_trigger
  on public.factory_competitive_intelligence;
create trigger enforce_factory_ci_ownership_trigger
  before insert or update on public.factory_competitive_intelligence
  for each row
  execute function public.enforce_factory_ci_ownership();

revoke all on function public.enforce_factory_ci_ownership()
  from public, anon, authenticated;
