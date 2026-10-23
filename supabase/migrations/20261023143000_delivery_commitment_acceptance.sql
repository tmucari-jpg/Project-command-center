-- PCC delivery commitment, scope control, QA, acceptance and secure closure.
alter table public.deliverables
  add column if not exists qa_status text not null default 'not_ready',
  add column if not exists qa_notes text,
  add column if not exists qa_checked_at timestamptz;
alter table public.deliverables drop constraint if exists deliverables_qa_status_check;
alter table public.deliverables add constraint deliverables_qa_status_check check (qa_status in ('not_ready','passed','failed'));
update public.deliverables set qa_status='passed', qa_checked_at=coalesce(qa_checked_at,locked_at,updated_at,created_at,now()) where status='completed' and qa_status<>'passed';
alter table public.deliverables drop constraint if exists deliverables_workstream_check;
alter table public.deliverables add constraint deliverables_workstream_check check (workstream in ('general','commercial','sales','marketing','monetization','financial','operational','governance','security','technical','other'));

alter table public.commercial_leads drop constraint if exists commercial_leads_stage_check;
update public.commercial_leads set stage=case stage when 'lead' then 'contact' when 'contacted' then 'interest' when 'qualified' then 'diagnosis' when 'negotiation' then 'proposal' else stage end where stage in ('lead','contacted','qualified','negotiation');
alter table public.commercial_leads add constraint commercial_leads_stage_check check (stage in ('contact','interest','diagnosis','demo','proposal','won','lost','lead','contacted','qualified','negotiation'));

alter table public.financial_entries
  add column if not exists cost_classification text,
  add column if not exists supplier_name text,
  add column if not exists recurrence text,
  add column if not exists client_approved boolean not null default false,
  add column if not exists related_deliverable_id uuid references public.deliverables(id) on delete set null;
update public.financial_entries set cost_classification='internal_pcc' where entry_type='cost' and cost_classification is null;
alter table public.financial_entries drop constraint if exists financial_entries_cost_classification_check;
alter table public.financial_entries add constraint financial_entries_cost_classification_check check (cost_classification is null or cost_classification in ('internal_pcc','client_direct','reimbursable_external','additional_scope'));
alter table public.financial_entries drop constraint if exists financial_entries_cost_requires_classification;
alter table public.financial_entries add constraint financial_entries_cost_requires_classification check (entry_type<>'cost' or cost_classification is not null);
alter table public.financial_entries drop constraint if exists financial_entries_recurrence_check;
alter table public.financial_entries add constraint financial_entries_recurrence_check check (recurrence is null or recurrence in ('one_off','monthly','annual','usage'));

create or replace function private.normalize_financial_cost_classification()
returns trigger language plpgsql security invoker set search_path = '' as $
begin
  if new.entry_type = 'revenue' then
    new.cost_classification := null;
  elsif new.entry_type = 'cost' and new.cost_classification is null then
    new.cost_classification := 'internal_pcc';
  end if;
  return new;
end; $;

drop trigger if exists normalize_financial_cost_classification on public.financial_entries;
create trigger normalize_financial_cost_classification
before insert or update of entry_type,cost_classification on public.financial_entries
for each row execute function private.normalize_financial_cost_classification();

create table if not exists public.project_commitment_baselines (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  version integer not null default 1 check (version>=1),
  status text not null default 'draft' check (status in ('draft','awaiting_client','approved','rejected','superseded')),
  expected_result text not null, scope_included text not null, exclusions text not null,
  deliverables_summary text not null, acceptance_summary text not null,
  pcc_responsibilities text not null, client_responsibilities text not null, assumptions_dependencies text not null,
  capacity_validation text not null, financial_validation text not null, security_validation text not null, external_costs_note text not null,
  validation_milestones text, payment_terms text, asset_ownership_terms text, intellectual_property_terms text, post_delivery_terms text,
  capacity_required_hours numeric, capacity_available_hours numeric, capacity_period text,
  capacity_exception_approved boolean not null default false, capacity_exception_rationale text,
  estimated_pcc_cost numeric, minimum_margin_pct numeric not null default 20,
  margin_exception_approved boolean not null default false, margin_exception_rationale text,
  price numeric, currency text, due_date date, pcc_validated_at timestamptz, client_validated_at timestamptz,
  client_validator text, approval_reference text, client_notes text, created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(project_id,version)
);
create index if not exists project_commitment_baselines_project_status_idx on public.project_commitment_baselines(project_id,status,version desc);

create table if not exists public.project_change_requests (
  id uuid primary key default uuid_generate_v4(), user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  baseline_id uuid not null references public.project_commitment_baselines(id) on delete restrict, baseline_version integer not null,
  request_summary text not null, impact_scope text not null, impact_schedule text not null, impact_cost text not null, impact_capacity text not null, impact_security text not null,
  affected_areas text not null,
  cost_delta numeric, currency text, due_date_delta_days integer,
  status text not null default 'requested' check (status in ('requested','approved','rejected','implemented')),
  decision_rationale text, decided_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists project_change_requests_project_status_idx on public.project_change_requests(project_id,status,created_at desc);

create table if not exists public.deliverable_acceptance_events (
  id uuid primary key default uuid_generate_v4(), user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade, deliverable_id uuid not null references public.deliverables(id) on delete restrict,
  deliverable_version integer not null default 1,
  status text not null check (status in ('in_review','accepted','accepted_with_reservations','changes_requested')),
  actor_type text not null default 'client' check (actor_type in ('client','pcc')), actor_name text not null, notes text, evidence_reference text,
  created_at timestamptz not null default now()
);
create index if not exists deliverable_acceptance_events_delivery_idx on public.deliverable_acceptance_events(deliverable_id,created_at desc);

create table if not exists public.project_closure_assessments (
  id uuid primary key default uuid_generate_v4(), user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null unique references public.projects(id) on delete cascade,
  value_status text not null default 'not_assessed' check (value_status in ('not_assessed','proven','observing','not_proven')),
  value_summary text not null default '', client_acceptance_complete boolean not null default false, changes_closed boolean not null default false,
  financials_updated boolean not null default false, handover_required boolean not null default false, handover_complete boolean not null default false,
  access_transfer_complete boolean not null default false, temporary_access_revoked boolean not null default false, data_retention_reviewed boolean not null default false,
  security_transfer_notes text, continuity_notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create or replace function private.enforce_delivery_governance_project_ownership() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (select 1 from public.projects p where p.id=new.project_id and p.user_id=new.user_id) then raise exception 'Project record must belong to same workspace owner' using errcode='23503'; end if;
  return new;
end; $$;
create or replace function private.enforce_acceptance_deliverable_ownership() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (select 1 from public.deliverables d where d.id=new.deliverable_id and d.project_id=new.project_id and d.user_id=new.user_id) then raise exception 'Acceptance must match deliverable/project/workspace' using errcode='23503'; end if;
  return new;
end; $$;

drop trigger if exists commitment_baseline_owner on public.project_commitment_baselines;
create trigger commitment_baseline_owner before insert or update on public.project_commitment_baselines for each row execute function private.enforce_delivery_governance_project_ownership();
drop trigger if exists project_change_request_owner on public.project_change_requests;
create trigger project_change_request_owner before insert or update on public.project_change_requests for each row execute function private.enforce_delivery_governance_project_ownership();
drop trigger if exists project_closure_assessment_owner on public.project_closure_assessments;
create trigger project_closure_assessment_owner before insert or update on public.project_closure_assessments for each row execute function private.enforce_delivery_governance_project_ownership();
drop trigger if exists deliverable_acceptance_owner on public.deliverable_acceptance_events;
create trigger deliverable_acceptance_owner before insert on public.deliverable_acceptance_events for each row execute function private.enforce_acceptance_deliverable_ownership();

drop trigger if exists update_project_commitment_baselines_updated_at on public.project_commitment_baselines;
create trigger update_project_commitment_baselines_updated_at before update on public.project_commitment_baselines for each row execute function public.update_updated_at_column();
drop trigger if exists update_project_change_requests_updated_at on public.project_change_requests;
create trigger update_project_change_requests_updated_at before update on public.project_change_requests for each row execute function public.update_updated_at_column();
drop trigger if exists update_project_closure_assessments_updated_at on public.project_closure_assessments;
create trigger update_project_closure_assessments_updated_at before update on public.project_closure_assessments for each row execute function public.update_updated_at_column();

alter table public.project_commitment_baselines enable row level security;
alter table public.project_change_requests enable row level security;
alter table public.deliverable_acceptance_events enable row level security;
alter table public.project_closure_assessments enable row level security;

create policy "Users can view own commitment baselines" on public.project_commitment_baselines for select to authenticated using (user_id=(select auth.uid()) or (select private.is_global_admin()));
create policy "Users can create own commitment baselines" on public.project_commitment_baselines for insert to authenticated with check (user_id=(select auth.uid()) or (select private.is_global_admin()));
create policy "Users can update own commitment baselines" on public.project_commitment_baselines for update to authenticated using (user_id=(select auth.uid()) or (select private.is_global_admin())) with check (user_id=(select auth.uid()) or (select private.is_global_admin()));
create policy "Users can view own project change requests" on public.project_change_requests for select to authenticated using (user_id=(select auth.uid()) or (select private.is_global_admin()));
create policy "Users can create own project change requests" on public.project_change_requests for insert to authenticated with check (user_id=(select auth.uid()) or (select private.is_global_admin()));
create policy "Users can update own project change requests" on public.project_change_requests for update to authenticated using (user_id=(select auth.uid()) or (select private.is_global_admin())) with check (user_id=(select auth.uid()) or (select private.is_global_admin()));
create policy "Users can view own deliverable acceptance events" on public.deliverable_acceptance_events for select to authenticated using (user_id=(select auth.uid()) or (select private.is_global_admin()));
create policy "Users can create own deliverable acceptance events" on public.deliverable_acceptance_events for insert to authenticated with check (user_id=(select auth.uid()) or (select private.is_global_admin()));
create policy "Users can view own project closure assessments" on public.project_closure_assessments for select to authenticated using (user_id=(select auth.uid()) or (select private.is_global_admin()));
create policy "Users can create own project closure assessments" on public.project_closure_assessments for insert to authenticated with check (user_id=(select auth.uid()) or (select private.is_global_admin()));
create policy "Users can update own project closure assessments" on public.project_closure_assessments for update to authenticated using (user_id=(select auth.uid()) or (select private.is_global_admin())) with check (user_id=(select auth.uid()) or (select private.is_global_admin()));

comment on table public.project_commitment_baselines is 'Baseline de compromisso validada pelo PCC e pelo cliente antes da execução material.';
comment on table public.project_change_requests is 'Controlo de alterações materiais de âmbito, prazo, custo, capacidade e segurança.';
comment on table public.deliverable_acceptance_events is 'Histórico append-only de revisão e aceitação dos entregáveis.';
comment on table public.project_closure_assessments is 'Preparação do G5: valor, handover, acessos, retenção e continuidade.';

create or replace function private.protect_approved_commitment_baseline()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op='DELETE' and old.status in ('approved','superseded') then
    raise exception 'Baseline aprovada/superseded é arquivo de compromisso e não pode ser apagada.' using errcode='23514';
  end if;
  if tg_op='UPDATE' and old.status='approved' then
    if new.status='superseded' and (to_jsonb(new)-'status'-'updated_at')=(to_jsonb(old)-'status'-'updated_at') then return new; end if;
    raise exception 'Baseline aprovada é imutável. Crie nova versão através do controlo de alterações.' using errcode='23514';
  end if;
  if tg_op='UPDATE' and old.status='superseded' then raise exception 'Baseline histórica imutável.' using errcode='23514'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end; $$;
drop trigger if exists protect_approved_commitment_baseline on public.project_commitment_baselines;
create trigger protect_approved_commitment_baseline before update or delete on public.project_commitment_baselines for each row execute function private.protect_approved_commitment_baseline();

create or replace function private.protect_acceptance_event_archive()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Eventos de aceitação são append-only e não podem ser alterados ou apagados.' using errcode='23514';
end; $$;
drop trigger if exists protect_acceptance_event_archive on public.deliverable_acceptance_events;
create trigger protect_acceptance_event_archive before update or delete on public.deliverable_acceptance_events for each row execute function private.protect_acceptance_event_archive();

-- Expand governance dependency ownership and align global-admin RLS.
alter table public.project_governance_dependencies drop constraint if exists project_governance_dependencies_owner_role_check;
alter table public.project_governance_dependencies add constraint project_governance_dependencies_owner_role_check check (owner_role in ('pcc','project_owner','client'));
alter table public.project_governance_dependencies drop constraint if exists project_governance_dependencies_check1;

drop policy if exists "Users can view own governance risks" on public.project_governance_risks;
create policy "Users can view own governance risks" on public.project_governance_risks for select to authenticated
using (user_id=(select auth.uid()) or (select private.is_global_admin()));
drop policy if exists "Users can create own governance risks" on public.project_governance_risks;
create policy "Users can create own governance risks" on public.project_governance_risks for insert to authenticated
with check (user_id=(select auth.uid()) or (select private.is_global_admin()));
drop policy if exists "Users can update own governance risks" on public.project_governance_risks;
create policy "Users can update own governance risks" on public.project_governance_risks for update to authenticated
using (user_id=(select auth.uid()) or (select private.is_global_admin()))
with check (user_id=(select auth.uid()) or (select private.is_global_admin()));
drop policy if exists "Users can delete own governance risks" on public.project_governance_risks;
create policy "Users can delete own governance risks" on public.project_governance_risks for delete to authenticated
using (user_id=(select auth.uid()) or (select private.is_global_admin()));

drop policy if exists "Users can view own gate events" on public.project_gate_events;
create policy "Users can view own gate events" on public.project_gate_events for select to authenticated
using (user_id=(select auth.uid()) or (select private.is_global_admin()));
drop policy if exists "Users can create own gate events" on public.project_gate_events;
create policy "Users can create own gate events" on public.project_gate_events for insert to authenticated
with check (user_id=(select auth.uid()) or (select private.is_global_admin()));

alter table public.project_commitment_baselines
  add constraint project_commitment_capacity_required_check
  check (capacity_required_hours is null or capacity_required_hours >= 0);
alter table public.project_commitment_baselines
  add constraint project_commitment_capacity_available_check
  check (capacity_available_hours is null or capacity_available_hours >= 0);
alter table public.project_commitment_baselines
  add constraint project_commitment_estimated_cost_check
  check (estimated_pcc_cost is null or estimated_pcc_cost >= 0);
alter table public.project_commitment_baselines
  add constraint project_commitment_min_margin_check
  check (minimum_margin_pct >= 0 and minimum_margin_pct <= 100);

-- Cross-record consistency: a Change Request must reference the exact baseline of the same project/workspace.
create or replace function private.enforce_change_baseline_consistency()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (
    select 1 from public.project_commitment_baselines b
    where b.id = new.baseline_id
      and b.project_id = new.project_id
      and b.user_id = new.user_id
      and b.version = new.baseline_version
  ) then
    raise exception 'Change request baseline must match project, workspace and version' using errcode='23503';
  end if;
  return new;
end; $$;
drop trigger if exists project_change_baseline_consistency on public.project_change_requests;
create trigger project_change_baseline_consistency
before insert or update on public.project_change_requests
for each row execute function private.enforce_change_baseline_consistency();

-- Related financial costs cannot point to a deliverable from another project/workspace.
create or replace function private.enforce_financial_deliverable_consistency()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.related_deliverable_id is not null and not exists (
    select 1 from public.deliverables d
    where d.id = new.related_deliverable_id
      and d.project_id = new.project_id
      and d.user_id = new.user_id
  ) then
    raise exception 'Financial entry deliverable must belong to the same project/workspace' using errcode='23503';
  end if;
  return new;
end; $$;
drop trigger if exists financial_deliverable_consistency on public.financial_entries;
create trigger financial_deliverable_consistency
before insert or update of project_id,user_id,related_deliverable_id on public.financial_entries
for each row execute function private.enforce_financial_deliverable_consistency();

-- Core content of a Change Request is immutable once created; only its decision state can progress.
create or replace function private.protect_change_request_history()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op='DELETE' then raise exception 'Pedido de alteração é histórico e não pode ser apagado.' using errcode='23514'; end if;
  if old.status in ('rejected','implemented') then raise exception 'Pedido de alteração encerrado é imutável.' using errcode='23514'; end if;
  if (to_jsonb(new) - 'status' - 'decision_rationale' - 'decided_at' - 'updated_at')
     <> (to_jsonb(old) - 'status' - 'decision_rationale' - 'decided_at' - 'updated_at') then
    raise exception 'O conteúdo do pedido de alteração é imutável; registe um novo pedido.' using errcode='23514';
  end if;
  if old.status='requested' and new.status not in ('requested','approved','rejected') then raise exception 'Transição inválida do pedido de alteração.' using errcode='23514'; end if;
  if old.status='approved' and new.status not in ('approved','implemented') then raise exception 'Transição inválida do pedido de alteração aprovado.' using errcode='23514'; end if;
  return new;
end; $$;
drop trigger if exists protect_change_request_history on public.project_change_requests;
create trigger protect_change_request_history before update or delete on public.project_change_requests
for each row execute function private.protect_change_request_history();

-- Closure assessment becomes immutable once the project is formally completed.
create or replace function private.protect_completed_closure_assessment()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from public.projects p where p.id = old.project_id and p.status = 'completed') then
    raise exception 'Avaliação de fecho de projecto concluído é arquivo histórico imutável.' using errcode='23514';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end; $$;
drop trigger if exists protect_completed_closure_assessment on public.project_closure_assessments;
create trigger protect_completed_closure_assessment
before update or delete on public.project_closure_assessments
for each row execute function private.protect_completed_closure_assessment();

alter table public.project_closure_assessments
  drop constraint if exists project_closure_handover_notes_check;
alter table public.project_closure_assessments
  add constraint project_closure_handover_notes_check
  check (
    not handover_required
    or (nullif(btrim(security_transfer_notes),'') is not null and nullif(btrim(continuity_notes),'') is not null)
  );

-- Security control catalogue: explicit controls are visible instead of an empty security dashboard.
insert into public.security_controls (user_id, control_key, enabled, notes, last_checked_at)
select p.id, v.control_key, v.enabled, v.notes, case when v.enabled then now() else null end
from public.profiles p
cross join (values
  ('offline_secure_logout', true, 'Base local e caches PCC são removidos no logout; alterações não sincronizadas geram aviso.'),
  ('vault_reference_only', true, 'Vault guarda apenas metadata/referências; secrets não devem ser persistidos em plaintext no PCC.'),
  ('auth_leaked_password_protection', false, 'Requer activação/verificação no Supabase Auth antes do READY de produção.'),
  ('backup_restore_continuity', false, 'Requer evidência de política e teste de recuperação antes de ser marcado como activo.'),
  ('project_access_review', false, 'RBAC existe; revisão operacional por projecto deve ser validada antes de escala multiutilizador.')
) as v(control_key,enabled,notes)
on conflict (user_id,control_key) do update set
  notes = excluded.notes,
  enabled = case
    when excluded.control_key in ('offline_secure_logout','vault_reference_only') then true
    else security_controls.enabled
  end,
  last_checked_at = case
    when excluded.control_key in ('offline_secure_logout','vault_reference_only') then now()
    else security_controls.last_checked_at
  end;
