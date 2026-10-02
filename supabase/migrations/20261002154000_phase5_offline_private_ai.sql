-- ============================================================
-- PHASE 5 — OFFLINE + PRIVATE AI FOUNDATION
-- Provider adapter metadata and sync queue. No secrets stored here.
-- ============================================================

create table if not exists public.ai_provider_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null
    check (provider in ('openai','groq','huggingchat','qwen_local','koboldcpp_local','other')),
  label text not null,
  mode text not null
    check (mode in ('cloud','local')),
  enabled boolean not null default true,
  priority integer not null default 100,
  cost_class text not null default 'unknown'
    check (cost_class in ('free','low','medium','high','unknown')),
  endpoint_hint text,
  model_hint text,
  capabilities jsonb not null default '[]'::jsonb,
  last_health_status text not null default 'unknown'
    check (last_health_status in ('unknown','healthy','degraded','offline')),
  last_health_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, label)
);

create table if not exists public.sync_queue (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  entity_type text not null,
  entity_id uuid,
  operation text not null
    check (operation in ('create','update','delete')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending','syncing','synced','conflict','failed','cancelled')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  synced_at timestamptz
);

create index if not exists idx_ai_provider_profiles_user_id on public.ai_provider_profiles(user_id);
create index if not exists idx_ai_provider_profiles_enabled on public.ai_provider_profiles(enabled);
create index if not exists idx_sync_queue_user_id on public.sync_queue(user_id);
create index if not exists idx_sync_queue_status on public.sync_queue(status);

drop trigger if exists update_ai_provider_profiles_updated_at on public.ai_provider_profiles;
create trigger update_ai_provider_profiles_updated_at
before update on public.ai_provider_profiles
for each row execute function public.update_updated_at_column();

alter table public.ai_provider_profiles enable row level security;
alter table public.sync_queue enable row level security;

create policy "Users can view own ai providers"
on public.ai_provider_profiles for select to authenticated using (user_id = auth.uid());
create policy "Users can create own ai providers"
on public.ai_provider_profiles for insert to authenticated with check (user_id = auth.uid());
create policy "Users can update own ai providers"
on public.ai_provider_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users can delete own ai providers"
on public.ai_provider_profiles for delete to authenticated using (user_id = auth.uid());

create policy "Users can view own sync queue"
on public.sync_queue for select to authenticated using (user_id = auth.uid());
create policy "Users can create own sync queue"
on public.sync_queue for insert to authenticated with check (user_id = auth.uid());
create policy "Users can update own sync queue"
on public.sync_queue for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.enforce_sync_project_owner()
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

drop trigger if exists enforce_sync_project_owner on public.sync_queue;
create trigger enforce_sync_project_owner
before insert or update on public.sync_queue
for each row execute function public.enforce_sync_project_owner();
