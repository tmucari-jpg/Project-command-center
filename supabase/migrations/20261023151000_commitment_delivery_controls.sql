-- PCC commitment, change control, acceptance and secure closure.
-- Extends G3-G5 without changing the immutable deliverable archive semantics.

create table if not exists public.project_commitments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  baseline_version integer not null default 1 check (baseline_version >= 1),
  status text not null default 'draft'
    check (status in ('draft','pcc_validated','client_validated','superseded')),
  expected_result text not null,
  scope_included text not null,
  scope_excluded text,
  deliverables_summary text not null,
  acceptance_summary text not null,
  pcc_responsibilities text,
  client_responsibilities text,
  dependencies text,
  external_costs text,
  security_requirements text,
  capacity_basis text,
  payment_conditions text,
  client_approval_sla text,
  asset_ownership text,
  intellectual_property_terms text,
  post_delivery_support text,
  capacity_confirmed boolean not null default false,
  deliverability_confirmed boolean not null default false,
  financial_confirmed boolean not null default false,
  security_confirmed boolean not null default false,
  dependencies_confirmed boolean not null default false,
  pcc_validation_notes text,
  client_validation_notes text,
  pcc_validated_by uuid references auth.users(id) on delete set null,
  pcc_validated_at timestamptz,
  client_validated_by text,
  client_validation_reference text,
  client_validated_at timestamptz,
  supersedes_commitment_id uuid references public.project_commitments(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, baseline_version)
);

create unique index if not exists project_commitments_one_live_baseline_idx
  on public.project_commitments(project_id)
  where status = 'client_validated';

create unique index if not exists project_commitments_one_pending_validation_idx
  on public.project_commitments(project_id)
  where status = 'pcc_validated';

create index if not exists project_commitments_user_project_idx
  on public.project_commitments(user_id, project_id);

alter table public.project_commitments enable row level security;

create policy "Users can view own commitments"
on public.project_commitments for select to authenticated
using ((user_id = (select auth.uid())) or (select private.is_global_admin()));

create policy "Users can create own commitments"
on public.project_commitments for insert to authenticated
with check ((user_id = (select auth.uid())) or (select private.is_global_admin()));

create policy "Users can update own commitments"
on public.project_commitments for update to authenticated
using ((user_id = (select auth.uid())) or (select private.is_global_admin()))
with check ((user_id = (select auth.uid())) or (select private.is_global_admin()));

create table if not exists public.project_change_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  commitment_id uuid references public.project_commitments(id) on delete restrict,
  title text not null,
  requested_change text not null,
  impact_scope text,
  impact_schedule text,
  impact_cost text,
  impact_capacity text,
  impact_security text,
  decision text not null default 'pending'
    check (decision in ('pending','approved','rejected','deferred')),
  decision_notes text,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_change_requests_user_project_idx
  on public.project_change_requests(user_id, project_id, decision);

alter table public.project_change_requests enable row level security;

create policy "Users can view own change requests"
on public.project_change_requests for select to authenticated
using ((user_id = (select auth.uid())) or (select private.is_global_admin()));

create policy "Users can create own change requests"
on public.project_change_requests for insert to authenticated
with check ((user_id = (select auth.uid())) or (select private.is_global_admin()));

create policy "Users can update own change requests"
on public.project_change_requests for update to authenticated
using ((user_id = (select auth.uid())) or (select private.is_global_admin()))
with check ((user_id = (select auth.uid())) or (select private.is_global_admin()));

alter table public.deliverables
  add column if not exists commitment_id uuid references public.project_commitments(id) on delete restrict,
  add column if not exists qa_status text not null default 'not_ready'
    check (qa_status in ('not_ready','ready_for_review','approved','changes_required')),
  add column if not exists qa_notes text,
  add column if not exists qa_reviewed_at timestamptz;

create index if not exists deliverables_commitment_idx
  on public.deliverables(commitment_id)
  where commitment_id is not null;

create table if not exists public.deliverable_acceptances (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  deliverable_id uuid not null references public.deliverables(id) on delete cascade,
  status text not null default 'pending_review'
    check (status in ('pending_review','accepted','accepted_with_reservations','correction_required')),
  accepted_by text,
  notes text,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (deliverable_id)
);

create index if not exists deliverable_acceptances_user_project_idx
  on public.deliverable_acceptances(user_id, project_id, status);

alter table public.deliverable_acceptances enable row level security;

create policy "Users can view own deliverable acceptances"
on public.deliverable_acceptances for select to authenticated
using ((user_id = (select auth.uid())) or (select private.is_global_admin()));

create policy "Users can create own deliverable acceptances"
on public.deliverable_acceptances for insert to authenticated
with check ((user_id = (select auth.uid())) or (select private.is_global_admin()));

create policy "Users can update own deliverable acceptances"
on public.deliverable_acceptances for update to authenticated
using ((user_id = (select auth.uid())) or (select private.is_global_admin()))
with check ((user_id = (select auth.uid())) or (select private.is_global_admin()));

create table if not exists public.project_closure_state (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  value_status text not null default 'not_assessed'
    check (value_status in ('not_assessed','proved','observing','not_proved')),
  value_evidence text,
  handover_status text not null default 'not_applicable'
    check (handover_status in ('not_applicable','pending','completed')),
  handover_notes text,
  security_transfer_status text not null default 'not_applicable'
    check (security_transfer_status in ('not_applicable','pending','completed')),
  security_transfer_notes text,
  continuity_status text not null default 'not_applicable'
    check (continuity_status in ('not_applicable','pending','confirmed')),
  continuity_notes text,
  financial_status text not null default 'pending'
    check (financial_status in ('pending','updated')),
  lessons_learned text,
  next_follow_up text,
  updated_at timestamptz not null default now(),
  unique (project_id)
);

alter table public.project_closure_state enable row level security;

create policy "Users can view own closure state"
on public.project_closure_state for select to authenticated
using ((user_id = (select auth.uid())) or (select private.is_global_admin()));

create policy "Users can create own closure state"
on public.project_closure_state for insert to authenticated
with check ((user_id = (select auth.uid())) or (select private.is_global_admin()));

create policy "Users can update own closure state"
on public.project_closure_state for update to authenticated
using ((user_id = (select auth.uid())) or (select private.is_global_admin()))
with check ((user_id = (select auth.uid())) or (select private.is_global_admin()));

alter table public.financial_entries
  add column if not exists cost_scope text not null default 'pcc_internal'
    check (cost_scope in ('pcc_internal','client_direct','reimbursable_external','additional_scope')),
  add column if not exists supplier text,
  add column if not exists recurrence text not null default 'one_off'
    check (recurrence in ('one_off','monthly','annual','usage'));

create or replace function public.touch_pcc_commitment_tables()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_project_commitments on public.project_commitments;
create trigger touch_project_commitments before update on public.project_commitments
for each row execute function public.touch_pcc_commitment_tables();

drop trigger if exists touch_project_change_requests on public.project_change_requests;
create trigger touch_project_change_requests before update on public.project_change_requests
for each row execute function public.touch_pcc_commitment_tables();

drop trigger if exists touch_deliverable_acceptances on public.deliverable_acceptances;
create trigger touch_deliverable_acceptances before update on public.deliverable_acceptances
for each row execute function public.touch_pcc_commitment_tables();

drop trigger if exists touch_project_closure_state on public.project_closure_state;
create trigger touch_project_closure_state before update on public.project_closure_state
for each row execute function public.touch_pcc_commitment_tables();


-- Align the commercial funnel with the PCC consultancy flow without breaking
-- the currently deployed application during the schema-first rollout. Historical
-- stages remain valid and are normalized by the new UI; new writes use the new funnel.
alter table public.commercial_leads
  drop constraint if exists commercial_leads_stage_check;

alter table public.commercial_leads
  add constraint commercial_leads_stage_check
  check (stage in (
    'lead','contacted','qualified','negotiation','won',
    'contact','interest','diagnosis','demo','proposal','client','lost'
  ));
