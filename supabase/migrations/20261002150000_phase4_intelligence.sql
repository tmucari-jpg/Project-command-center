-- ============================================================
-- PHASE 4 — INTELLIGENCE FOUNDATION
-- Intelligence Briefing, Opportunity Radar and knowledge links.
-- Evidence and Decisions reuse existing canonical tables.
-- ============================================================

create table if not exists public.intelligence_signals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  signal_type text not null
    check (signal_type in ('briefing','opportunity','risk','market','customer','operational')),
  title text not null,
  summary text,
  source_reference text,
  confidence text not null default 'unverified'
    check (confidence in ('unverified','low','medium','high','verified')),
  status text not null default 'new'
    check (status in ('new','reviewed','actionable','dismissed','converted')),
  action_hint text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists public.knowledge_links (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  from_entity_type text not null,
  from_entity_id uuid not null,
  relation text not null,
  to_entity_type text not null,
  to_entity_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, from_entity_type, from_entity_id, relation, to_entity_type, to_entity_id)
);

create index if not exists idx_intelligence_signals_user_id on public.intelligence_signals(user_id);
create index if not exists idx_intelligence_signals_project_id on public.intelligence_signals(project_id);
create index if not exists idx_intelligence_signals_type on public.intelligence_signals(signal_type);
create index if not exists idx_intelligence_signals_status on public.intelligence_signals(status);
create index if not exists idx_knowledge_links_user_id on public.knowledge_links(user_id);
create index if not exists idx_knowledge_links_project_id on public.knowledge_links(project_id);

alter table public.intelligence_signals enable row level security;
alter table public.knowledge_links enable row level security;

create policy "Users can view own intelligence signals"
on public.intelligence_signals for select to authenticated using (user_id = auth.uid());
create policy "Users can create own intelligence signals"
on public.intelligence_signals for insert to authenticated with check (user_id = auth.uid());
create policy "Users can update own intelligence signals"
on public.intelligence_signals for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Users can view own knowledge links"
on public.knowledge_links for select to authenticated using (user_id = auth.uid());
create policy "Users can create own knowledge links"
on public.knowledge_links for insert to authenticated with check (user_id = auth.uid());
create policy "Users can delete own knowledge links"
on public.knowledge_links for delete to authenticated using (user_id = auth.uid());

create or replace function public.enforce_intelligence_project_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.project_id is not null and not exists (
    select 1 from public.projects where id = new.project_id and user_id = new.user_id
  ) then
    raise exception 'project does not belong to user' using errcode = '23503';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_intelligence_project_owner on public.intelligence_signals;
create trigger enforce_intelligence_project_owner
before insert or update on public.intelligence_signals
for each row execute function public.enforce_intelligence_project_owner();

drop trigger if exists enforce_intelligence_project_owner on public.knowledge_links;
create trigger enforce_intelligence_project_owner
before insert or update on public.knowledge_links
for each row execute function public.enforce_intelligence_project_owner();
