-- ============================================================
-- PHASE 6 — SECURITY + SCALE FOUNDATION
-- RBAC, security posture and Vault metadata.
-- Secrets themselves remain outside plaintext database storage.
-- ============================================================

create table if not exists public.user_roles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null
    check (role in ('owner','admin','editor','viewer')),
  scope_type text not null default 'global'
    check (scope_type in ('global','project')),
  project_id uuid references public.projects(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, role, scope_type, project_id)
);

create table if not exists public.vault_items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  category text not null,
  service text not null,
  username_hint text,
  secret_reference text,
  url text,
  notes text,
  storage_mode text not null default 'local_encrypted'
    check (storage_mode in ('local_encrypted','external_secret_store')),
  status text not null default 'active'
    check (status in ('active','rotating','revoked','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.security_controls (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  control_key text not null,
  enabled boolean not null default false,
  notes text,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, control_key)
);

create index if not exists idx_user_roles_user_id on public.user_roles(user_id);
create index if not exists idx_user_roles_project_id on public.user_roles(project_id);
create index if not exists idx_vault_items_user_id on public.vault_items(user_id);
create index if not exists idx_vault_items_project_id on public.vault_items(project_id);
create index if not exists idx_security_controls_user_id on public.security_controls(user_id);

drop trigger if exists update_vault_items_updated_at on public.vault_items;
create trigger update_vault_items_updated_at
before update on public.vault_items
for each row execute function public.update_updated_at_column();

drop trigger if exists update_security_controls_updated_at on public.security_controls;
create trigger update_security_controls_updated_at
before update on public.security_controls
for each row execute function public.update_updated_at_column();

alter table public.user_roles enable row level security;
alter table public.vault_items enable row level security;
alter table public.security_controls enable row level security;

create policy "Users can view own roles"
on public.user_roles for select to authenticated using (user_id = auth.uid());

create policy "Users can view own vault metadata"
on public.vault_items for select to authenticated using (user_id = auth.uid());
create policy "Users can create own vault metadata"
on public.vault_items for insert to authenticated with check (user_id = auth.uid());
create policy "Users can update own vault metadata"
on public.vault_items for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Users can view own security controls"
on public.security_controls for select to authenticated using (user_id = auth.uid());
create policy "Users can create own security controls"
on public.security_controls for insert to authenticated with check (user_id = auth.uid());
create policy "Users can update own security controls"
on public.security_controls for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.enforce_security_project_owner()
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

drop trigger if exists enforce_security_project_owner on public.user_roles;
create trigger enforce_security_project_owner
before insert or update on public.user_roles
for each row execute function public.enforce_security_project_owner();

drop trigger if exists enforce_security_project_owner on public.vault_items;
create trigger enforce_security_project_owner
before insert or update on public.vault_items
for each row execute function public.enforce_security_project_owner();
