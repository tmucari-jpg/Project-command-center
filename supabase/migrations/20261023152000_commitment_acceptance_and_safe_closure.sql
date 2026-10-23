-- PCC commitment, acceptance, external-cost and safe-closure controls.
-- Formaliza G3 Compromisso e reforça G5 sem criar projectos paralelos.

alter table public.projects
  add column if not exists value_status text not null default 'not_assessed',
  add column if not exists handover_status text not null default 'not_required',
  add column if not exists continuity_status text not null default 'not_required',
  add column if not exists information_classification text not null default 'internal';

alter table public.projects
  drop constraint if exists projects_value_status_check,
  add constraint projects_value_status_check
    check (value_status in ('not_assessed','proven','observing','not_proven'));

alter table public.projects
  drop constraint if exists projects_handover_status_check,
  add constraint projects_handover_status_check
    check (handover_status in ('not_required','pending','completed'));

alter table public.projects
  drop constraint if exists projects_continuity_status_check,
  add constraint projects_continuity_status_check
    check (continuity_status in ('not_required','pending','verified'));

alter table public.projects
  drop constraint if exists projects_information_classification_check,
  add constraint projects_information_classification_check
    check (information_classification in ('public','internal','confidential','restricted'));

alter table public.deliverables
  add column if not exists qa_status text not null default 'pending',
  add column if not exists qa_notes text,
  add column if not exists acceptance_status text not null default 'pending',
  add column if not exists acceptance_notes text,
  add column if not exists acceptance_reference text,
  add column if not exists accepted_at timestamptz;

alter table public.deliverables
  drop constraint if exists deliverables_qa_status_check,
  add constraint deliverables_qa_status_check
    check (qa_status in ('pending','passed','failed','not_required'));

alter table public.deliverables
  drop constraint if exists deliverables_acceptance_status_check,
  add constraint deliverables_acceptance_status_check
    check (acceptance_status in ('pending','accepted','accepted_with_reservations','correction_required','not_required'));

-- Preserve historical completed archives without inventing client acceptance.
update public.deliverables
set qa_status = 'passed',
    acceptance_status = 'not_required'
where status = 'completed';

alter table public.financial_entries
  add column if not exists cost_treatment text not null default 'pcc_internal',
  add column if not exists cost_frequency text not null default 'one_off',
  add column if not exists external_provider text;

-- Align the sales pipeline with the validated PCC commercial flow.
alter table public.commercial_leads
  add column if not exists loss_reason text;

alter table public.commercial_leads
  drop constraint if exists commercial_leads_stage_check;

update public.commercial_leads
set stage = case stage
  when 'lead' then 'contact'
  when 'contacted' then 'interest'
  when 'qualified' then 'diagnosis'
  when 'negotiation' then 'proposal'
  when 'won' then 'client'
  else stage
end
where stage in ('lead','contacted','qualified','negotiation','won');

alter table public.commercial_leads
  add constraint commercial_leads_stage_check
    check (stage in ('contact','interest','diagnosis','demonstration','proposal','client','handoff','lost'));

alter table public.financial_entries
  drop constraint if exists financial_entries_cost_treatment_check,
  add constraint financial_entries_cost_treatment_check
    check (cost_treatment in ('pcc_internal','client_direct','reimbursable_external','additional_scope'));

alter table public.financial_entries
  drop constraint if exists financial_entries_cost_frequency_check,
  add constraint financial_entries_cost_frequency_check
    check (cost_frequency in ('one_off','monthly','annual','usage'));

create table if not exists public.project_commitment_baselines (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  version integer not null default 1 check (version >= 1),
  information_classification text not null default 'internal'
    check (information_classification in ('public','internal','confidential','restricted')),
  expected_result text not null,
  scope text not null,
  exclusions text,
  deliverables_summary text not null,
  pcc_responsibilities text,
  client_responsibilities text,
  external_costs_terms text,
  acceptance_terms text not null,
  security_conditions text,
  capacity_summary text,
  cost_summary text,
  status text not null default 'draft'
    check (status in ('draft','internal_approved','client_approved','superseded')),
  client_validation_reference text,
  internal_approved_at timestamptz,
  client_approved_at timestamptz,
  locked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, version)
);

create index if not exists idx_project_commitment_baselines_project
  on public.project_commitment_baselines(project_id, version desc);

alter table public.project_commitment_baselines enable row level security;

create policy "Users can view own commitment baselines"
on public.project_commitment_baselines for select to authenticated
using ((user_id = (select auth.uid())) or (select private.is_global_admin()));

create policy "Users can create own commitment baselines"
on public.project_commitment_baselines for insert to authenticated
with check ((user_id = (select auth.uid())) or (select private.is_global_admin()));

create policy "Users can update own commitment baselines"
on public.project_commitment_baselines for update to authenticated
using ((user_id = (select auth.uid())) or (select private.is_global_admin()))
with check ((user_id = (select auth.uid())) or (select private.is_global_admin()));

create or replace function public.enforce_commitment_baseline_owner()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.projects p
    where p.id = new.project_id and p.user_id = new.user_id
  ) then
    raise exception 'Commitment baseline project must belong to the same user';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_commitment_baseline_owner_trigger on public.project_commitment_baselines;
create trigger enforce_commitment_baseline_owner_trigger
before insert or update on public.project_commitment_baselines
for each row execute function public.enforce_commitment_baseline_owner();

create or replace function private.protect_approved_commitment_baseline()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and old.status in ('client_approved','superseded') then
    raise exception 'Baseline aprovada é histórica e não pode ser apagada.'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and old.status in ('client_approved','superseded') then
    if new.status = old.status then
      raise exception 'Baseline aprovada é imutável. Registe uma alteração e crie nova versão.'
        using errcode = '23514';
    end if;
  end if;

  if new.status = 'client_approved' then
    if new.internal_approved_at is null then
      raise exception 'A baseline precisa de validação interna do PCC antes da validação do cliente.'
        using errcode = '23514';
    end if;
    if nullif(btrim(new.client_validation_reference), '') is null then
      raise exception 'Registe a referência da validação explícita do cliente ou responsável interno.'
        using errcode = '23514';
    end if;
    new.client_approved_at := coalesce(new.client_approved_at, now());
    new.locked_at := coalesce(new.locked_at, now());
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists protect_approved_commitment_baseline on public.project_commitment_baselines;
create trigger protect_approved_commitment_baseline
before update or delete on public.project_commitment_baselines
for each row execute function private.protect_approved_commitment_baseline();

create table if not exists public.project_change_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  baseline_id uuid references public.project_commitment_baselines(id) on delete restrict,
  title text not null,
  description text not null,
  impact_scope text,
  impact_timeline text,
  impact_cost text,
  impact_capacity text,
  impact_security text,
  decision text not null default 'pending'
    check (decision in ('pending','approved','rejected','deferred')),
  decision_rationale text,
  decided_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_project_change_requests_project
  on public.project_change_requests(project_id, decision, created_at desc);

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

create or replace function public.enforce_change_request_owner()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.projects p
    where p.id = new.project_id and p.user_id = new.user_id
  ) then
    raise exception 'Change request project must belong to the same user';
  end if;
  if new.baseline_id is not null and not exists (
    select 1 from public.project_commitment_baselines b
    where b.id = new.baseline_id
      and b.project_id = new.project_id
      and b.user_id = new.user_id
  ) then
    raise exception 'Change request baseline must belong to the same project and user';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_change_request_owner_trigger on public.project_change_requests;
create trigger enforce_change_request_owner_trigger
before insert or update on public.project_change_requests
for each row execute function public.enforce_change_request_owner();

create trigger update_project_commitment_baselines_updated_at
before update on public.project_commitment_baselines
for each row execute function public.update_updated_at_column();

create trigger update_project_change_requests_updated_at
before update on public.project_change_requests
for each row execute function public.update_updated_at_column();

-- Strengthen the immutable deliverable gate: QA and acceptance precede final archive.
create or replace function private.protect_final_deliverable_archive()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'completed' or old.locked_at is not null then
      raise exception 'Entregável final bloqueado: crie uma nova versão no PCC em vez de alterar ou apagar o arquivo oficial.'
        using errcode = '23514';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and (old.status = 'completed' or old.locked_at is not null) then
    raise exception 'Entregável final bloqueado: crie uma nova versão no PCC em vez de alterar o arquivo oficial.'
      using errcode = '23514';
  end if;

  if new.status = 'completed' then
    if tg_op = 'INSERT' then
      raise exception 'Um entregável não pode nascer como concluído. Registe o resultado e a evidência antes de o entregar.'
        using errcode = '23514';
    end if;

    if new.qa_status not in ('passed','not_required') then
      raise exception 'O entregável precisa de passar por QA antes de ser arquivado como final.'
        using errcode = '23514';
    end if;

    if new.acceptance_status not in ('accepted','accepted_with_reservations','not_required') then
      raise exception 'O entregável precisa de aceitação registada antes de ser arquivado como final.'
        using errcode = '23514';
    end if;

    if new.artifact_type in ('website', 'application', 'dashboard', 'api') then
      if nullif(btrim(new.artifact_url), '') is null then
        raise exception 'Entregáveis digitais executáveis exigem um URL oficial antes do fecho.'
          using errcode = '23514';
      end if;
      if nullif(btrim(new.artifact_reference), '') is null then
        raise exception 'Entregáveis digitais executáveis exigem uma referência imutável de versão (deploy, commit ou release).'
          using errcode = '23514';
      end if;
    end if;

    if not exists (
      select 1
      from public.evidence e
      where e.deliverable_id = new.id
        and e.user_id = new.user_id
    ) then
      raise exception 'O entregável precisa de evidência associada antes de ser bloqueado como entregue.'
        using errcode = '23514';
    end if;

    new.locked_at := coalesce(new.locked_at, now());
  else
    new.locked_at := null;
  end if;

  return new;
end;
$$;

comment on table public.project_commitment_baselines is
  'Baseline G3 aprovada: resultado esperado, âmbito, entregáveis, responsabilidades, exclusões e condições validadas antes da execução material.';
comment on table public.project_change_requests is
  'Controlo formal de alterações materiais de âmbito, prazo, custo, capacidade ou segurança após aprovação da baseline.';


create or replace function private.enforce_project_execution_commitment()
returns trigger
language plpgsql
set search_path = ''
as $pcc$
begin
  if new.status = 'active'
     and (
       tg_op = 'INSERT'
       or (tg_op = 'UPDATE' and old.status is distinct from 'active')
     )
     and not exists (
       select 1
       from public.project_commitment_baselines b
       where b.project_id = new.id
         and b.user_id = new.user_id
         and b.status = 'client_approved'
     )
  then
    raise exception 'O projecto só pode entrar em execução após G3 interno e validação explícita do cliente ou responsável interno.'
      using errcode = '23514';
  end if;

  return new;
end;
$pcc$;

drop trigger if exists enforce_project_execution_commitment on public.projects;
create trigger enforce_project_execution_commitment
before insert or update of status on public.projects
for each row execute function private.enforce_project_execution_commitment();

comment on column public.financial_entries.cost_treatment is
  'Separa custo interno PCC, custo directo do cliente, custo externo reembolsável e trabalho adicional fora do âmbito.';


-- Reframe the PCC internal launch deliverable so Operations owns execution,
-- while prospecting/pipeline remain in the commercial capability.
update public.deliverables d
set
  title = 'Plano Operacional de Lançamento e Execução',
  description = 'Sistema operacional que transforma o compromisso aprovado em execução coordenada: actividades, responsáveis, prazos, dependências, recursos, riscos, checkpoints, evidências, desvios e critérios de conclusão.',
  completion_criteria = 'Plano operacional utilizável com sequência de lançamento, actividades, responsáveis, prazos, dependências, riscos, checkpoints, próximos passos e critérios de conclusão claramente definidos, sem duplicar funções de Marketing ou Vendas.'
from public.projects p
where d.project_id = p.id
  and d.user_id = p.user_id
  and p.title = 'Marketing, Vendas e Lançamento do PCC'
  and d.title = 'Lançamento · Funil, prospects, pilotos e primeiros clientes'
  and d.workstream = 'operational';
