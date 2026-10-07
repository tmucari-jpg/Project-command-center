create table if not exists public.factory_reports (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  factory_case_id uuid not null unique references public.project_factory_cases(id) on delete cascade,
  problem_identified text not null,
  market text,
  competitors text,
  existing_solutions text,
  differentiation text,
  market_trend text,
  technology_required text,
  estimated_cost text,
  revenue_model text,
  risks text,
  regulation text,
  execution_probability integer check (execution_probability between 0 and 100),
  adoption_probability integer check (adoption_probability between 0 and 100),
  critical_hypotheses text,
  tests_required text,
  status text not null default 'draft' check (status in ('draft','ready','decided')),
  final_decision text check (final_decision is null or final_decision in ('go','modify','hold','kill')),
  decision_rationale text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_factory_reports_user_id on public.factory_reports(user_id);
alter table public.factory_reports enable row level security;

drop policy if exists "Users can view own factory reports" on public.factory_reports;
create policy "Users can view own factory reports"
on public.factory_reports for select to authenticated using (user_id = auth.uid());

drop policy if exists "Users can create own factory reports" on public.factory_reports;
create policy "Users can create own factory reports"
on public.factory_reports for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "Users can update own factory reports" on public.factory_reports;
create policy "Users can update own factory reports"
on public.factory_reports for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop trigger if exists update_factory_reports_updated_at on public.factory_reports;
create trigger update_factory_reports_updated_at
before update on public.factory_reports
for each row execute function public.update_updated_at_column();

create or replace function public.enforce_factory_report_ownership()
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
    raise exception 'Factory report case must belong to the same user';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_factory_report_ownership_trigger on public.factory_reports;
create trigger enforce_factory_report_ownership_trigger
before insert or update on public.factory_reports
for each row execute function public.enforce_factory_report_ownership();

revoke all on function public.enforce_factory_report_ownership()
from public, anon, authenticated;
