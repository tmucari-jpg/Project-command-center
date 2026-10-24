-- Investment discovery: multiple candidate businesses before a single project path is chosen.

create table if not exists public.investment_discovery_briefs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  factory_case_id uuid not null unique references public.project_factory_cases(id) on delete cascade,
  executive_summary text not null,
  opportunities jsonb not null default '[]'::jsonb,
  recommended_option_id text,
  recommendation text,
  decision_criteria text,
  selected_option_id text,
  status text not null default 'ready'
    check (status in ('draft','ready','decided')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_investment_discovery_briefs_case
  on public.investment_discovery_briefs(factory_case_id, status);

create index if not exists idx_investment_discovery_briefs_user_id
  on public.investment_discovery_briefs(user_id);

alter table public.investment_discovery_briefs enable row level security;

revoke all on table public.investment_discovery_briefs from anon;
grant select, insert, update on table public.investment_discovery_briefs to authenticated;

create policy "Users can view own investment discovery briefs"
on public.investment_discovery_briefs for select to authenticated
using ((user_id = (select auth.uid())) or (select private.is_global_admin()));

create policy "Users can create own investment discovery briefs"
on public.investment_discovery_briefs for insert to authenticated
with check ((user_id = (select auth.uid())) or (select private.is_global_admin()));

create policy "Users can update own investment discovery briefs"
on public.investment_discovery_briefs for update to authenticated
using ((user_id = (select auth.uid())) or (select private.is_global_admin()))
with check ((user_id = (select auth.uid())) or (select private.is_global_admin()));

create or replace function public.enforce_investment_discovery_owner()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.project_factory_cases f
    where f.id = new.factory_case_id and f.user_id = new.user_id
  ) then
    raise exception 'Investment discovery case must belong to the same user';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_investment_discovery_owner_trigger on public.investment_discovery_briefs;
create trigger enforce_investment_discovery_owner_trigger
before insert or update on public.investment_discovery_briefs
for each row execute function public.enforce_investment_discovery_owner();

drop trigger if exists update_investment_discovery_briefs_updated_at on public.investment_discovery_briefs;
create trigger update_investment_discovery_briefs_updated_at
before update on public.investment_discovery_briefs
for each row execute function public.update_updated_at_column();

comment on table public.investment_discovery_briefs is
  'Resumo de decisão para investidores sem ideia definida: compara oportunidades, recomenda uma opção e regista a escolha antes de iniciar a linha normal da Factory.';
