-- ============================================================
-- PHASE 2 — MONETIZATION FIRST
-- Additive commercial model: offer, customer, price, channel,
-- pipeline/leads and revenue/costs.
-- ============================================================

create table if not exists public.project_commercial_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null unique references public.projects(id) on delete cascade,
  is_priority boolean not null default false,
  offer text,
  ideal_customer text,
  price numeric,
  currency text,
  channel text,
  validation_status text not null default 'not_ready'
    check (validation_status in ('not_ready','draft','ready_to_validate','validating','validated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commercial_leads (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  organisation text,
  contact_reference text,
  source text,
  stage text not null default 'lead'
    check (stage in ('lead','contacted','qualified','proposal','negotiation','won','lost')),
  value numeric,
  currency text,
  next_action text,
  next_action_at timestamptz,
  risk text,
  information_missing text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.financial_entries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  entry_type text not null check (entry_type in ('revenue','cost')),
  category text,
  description text not null,
  amount numeric not null check (amount >= 0),
  currency text not null,
  occurred_on date not null default current_date,
  status text not null default 'actual'
    check (status in ('actual','forecast','pending')),
  evidence_reference text,
  created_at timestamptz not null default now()
);

create index if not exists idx_commercial_profiles_user_id on public.project_commercial_profiles(user_id);
create index if not exists idx_commercial_leads_user_id on public.commercial_leads(user_id);
create index if not exists idx_commercial_leads_project_id on public.commercial_leads(project_id);
create index if not exists idx_commercial_leads_stage on public.commercial_leads(stage);
create index if not exists idx_financial_entries_user_id on public.financial_entries(user_id);
create index if not exists idx_financial_entries_project_id on public.financial_entries(project_id);
create index if not exists idx_financial_entries_type on public.financial_entries(entry_type);

drop trigger if exists update_project_commercial_profiles_updated_at on public.project_commercial_profiles;
create trigger update_project_commercial_profiles_updated_at
before update on public.project_commercial_profiles
for each row execute function public.update_updated_at_column();

drop trigger if exists update_commercial_leads_updated_at on public.commercial_leads;
create trigger update_commercial_leads_updated_at
before update on public.commercial_leads
for each row execute function public.update_updated_at_column();

alter table public.project_commercial_profiles enable row level security;
alter table public.commercial_leads enable row level security;
alter table public.financial_entries enable row level security;

create policy "Users can view own commercial profiles"
on public.project_commercial_profiles for select to authenticated using (user_id = auth.uid());
create policy "Users can create own commercial profiles"
on public.project_commercial_profiles for insert to authenticated with check (user_id = auth.uid());
create policy "Users can update own commercial profiles"
on public.project_commercial_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Users can view own commercial leads"
on public.commercial_leads for select to authenticated using (user_id = auth.uid());
create policy "Users can create own commercial leads"
on public.commercial_leads for insert to authenticated with check (user_id = auth.uid());
create policy "Users can update own commercial leads"
on public.commercial_leads for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users can delete own commercial leads"
on public.commercial_leads for delete to authenticated using (user_id = auth.uid());

create policy "Users can view own financial entries"
on public.financial_entries for select to authenticated using (user_id = auth.uid());
create policy "Users can create own financial entries"
on public.financial_entries for insert to authenticated with check (user_id = auth.uid());
create policy "Users can update own financial entries"
on public.financial_entries for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users can delete own financial entries"
on public.financial_entries for delete to authenticated using (user_id = auth.uid());

create or replace function public.enforce_phase2_owned_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null then
    raise exception 'user_id is required' using errcode = '23502';
  end if;

  if not exists (
    select 1 from public.projects
    where id = new.project_id and user_id = new.user_id
  ) then
    raise exception 'project does not belong to user' using errcode = '23503';
  end if;

  return new;
end;
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'project_commercial_profiles',
    'commercial_leads',
    'financial_entries'
  ]
  loop
    execute format('drop trigger if exists enforce_phase2_owned_project on public.%I', v_table);
    execute format(
      'create trigger enforce_phase2_owned_project before insert or update on public.%I for each row execute function public.enforce_phase2_owned_project()',
      v_table
    );
  end loop;
end
$$;
