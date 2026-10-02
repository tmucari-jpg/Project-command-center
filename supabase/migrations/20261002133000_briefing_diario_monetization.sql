-- ============================================================
-- BRIEFING DIARIO — MONETIZATION BASE
-- Additive extension of Phase 2. No duplicate commercial source of truth.
-- ============================================================

create table if not exists public.subscription_plans (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  code text not null,
  name text not null,
  price numeric not null check (price >= 0),
  currency text not null default 'MZN',
  billing_period text not null
    check (billing_period in ('weekly','monthly','quarterly','semiannual','annual')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, code)
);

create table if not exists public.payment_channels (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  provider text not null,
  channel_label text not null,
  status text not null default 'planned'
    check (status in ('planned','testing','active','paused')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, provider)
);

create table if not exists public.subscription_funnel_metrics (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  metric_date date not null default current_date,
  acquired integer not null default 0 check (acquired >= 0),
  payment_started integer not null default 0 check (payment_started >= 0),
  paid integer not null default 0 check (paid >= 0),
  activated integer not null default 0 check (activated >= 0),
  retained integer not null default 0 check (retained >= 0),
  churned integer not null default 0 check (churned >= 0),
  notes text,
  created_at timestamptz not null default now(),
  unique (project_id, metric_date)
);

create index if not exists idx_subscription_plans_project_id on public.subscription_plans(project_id);
create index if not exists idx_payment_channels_project_id on public.payment_channels(project_id);
create index if not exists idx_subscription_funnel_metrics_project_id on public.subscription_funnel_metrics(project_id);

drop trigger if exists update_subscription_plans_updated_at on public.subscription_plans;
create trigger update_subscription_plans_updated_at
before update on public.subscription_plans
for each row execute function public.update_updated_at_column();

drop trigger if exists update_payment_channels_updated_at on public.payment_channels;
create trigger update_payment_channels_updated_at
before update on public.payment_channels
for each row execute function public.update_updated_at_column();

alter table public.subscription_plans enable row level security;
alter table public.payment_channels enable row level security;
alter table public.subscription_funnel_metrics enable row level security;

create policy "Users can view own subscription plans"
on public.subscription_plans for select to authenticated using (user_id = auth.uid());
create policy "Users can create own subscription plans"
on public.subscription_plans for insert to authenticated with check (user_id = auth.uid());
create policy "Users can update own subscription plans"
on public.subscription_plans for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Users can view own payment channels"
on public.payment_channels for select to authenticated using (user_id = auth.uid());
create policy "Users can create own payment channels"
on public.payment_channels for insert to authenticated with check (user_id = auth.uid());
create policy "Users can update own payment channels"
on public.payment_channels for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Users can view own funnel metrics"
on public.subscription_funnel_metrics for select to authenticated using (user_id = auth.uid());
create policy "Users can create own funnel metrics"
on public.subscription_funnel_metrics for insert to authenticated with check (user_id = auth.uid());
create policy "Users can update own funnel metrics"
on public.subscription_funnel_metrics for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.enforce_subscription_project_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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
    'subscription_plans',
    'payment_channels',
    'subscription_funnel_metrics'
  ]
  loop
    execute format('drop trigger if exists enforce_subscription_project_owner on public.%I', v_table);
    execute format(
      'create trigger enforce_subscription_project_owner before insert or update on public.%I for each row execute function public.enforce_subscription_project_owner()',
      v_table
    );
  end loop;
end
$$;

-- Seed only for an existing Briefing Diario project.
-- Prices reflect the currently approved project base. Payment integrations are
-- seeded as planned, not assumed live.
insert into public.subscription_plans (user_id, project_id, code, name, price, currency, billing_period)
select p.user_id, p.id, seed.code, seed.name, seed.price, 'MZN', seed.billing_period
from public.projects p
cross join (
  values
    ('weekly', 'Semanal', 92::numeric, 'weekly'),
    ('monthly', 'Mensal', 250::numeric, 'monthly'),
    ('quarterly', 'Trimestral', 700::numeric, 'quarterly'),
    ('semiannual', 'Semestral', 1250::numeric, 'semiannual'),
    ('annual', 'Anual', 2500::numeric, 'annual')
) as seed(code, name, price, billing_period)
where lower(unaccent(p.title)) = 'briefing diario'
on conflict (project_id, code) do nothing;

insert into public.payment_channels (user_id, project_id, provider, channel_label, status, notes)
select p.user_id, p.id, seed.provider, seed.channel_label, 'planned', seed.notes
from public.projects p
cross join (
  values
    ('mpesa', 'M-Pesa', 'Integração/pagamento a validar no ambiente real.'),
    ('emola', 'e-Mola / Movitel Paga Já', 'Integração/pagamento a validar no ambiente real.'),
    ('payizi', 'Pay IZI', 'Integração/pagamento a validar no ambiente real.')
) as seed(provider, channel_label, notes)
where lower(unaccent(p.title)) = 'briefing diario'
on conflict (project_id, provider) do nothing;
