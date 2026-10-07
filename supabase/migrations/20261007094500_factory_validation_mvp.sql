create table if not exists public.factory_validations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  factory_case_id uuid not null unique references public.project_factory_cases(id) on delete cascade,
  critical_hypotheses text not null,
  validation_plan text not null,
  evidence text not null,
  result_summary text not null,
  recommendation text not null check (recommendation in ('proceed','modify','hold')),
  arena_required boolean not null default false,
  status text not null default 'complete' check (status in ('draft','complete')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_factory_validations_user_id on public.factory_validations(user_id);

alter table public.factory_validations enable row level security;

drop policy if exists "Users can view own factory validations" on public.factory_validations;
create policy "Users can view own factory validations"
on public.factory_validations for select to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can create own factory validations" on public.factory_validations;
create policy "Users can create own factory validations"
on public.factory_validations for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update own factory validations" on public.factory_validations;
create policy "Users can update own factory validations"
on public.factory_validations for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop trigger if exists update_factory_validations_updated_at on public.factory_validations;
create trigger update_factory_validations_updated_at
before update on public.factory_validations
for each row execute function public.update_updated_at_column();

create or replace function public.enforce_factory_validation_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.project_factory_cases f
    where f.id = new.factory_case_id and f.user_id = new.user_id
  ) then
    raise exception 'Factory validation case must belong to the same user';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_factory_validation_ownership_trigger on public.factory_validations;
create trigger enforce_factory_validation_ownership_trigger
before insert or update on public.factory_validations
for each row execute function public.enforce_factory_validation_ownership();

revoke all on function public.enforce_factory_validation_ownership()
from public, anon, authenticated;
