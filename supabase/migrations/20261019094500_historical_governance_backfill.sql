-- ============================================================
-- PCC HISTORICAL GOVERNANCE BACKFILL
-- Reconstroi apenas estados de governanca suportados por registos existentes.
-- Nao infere viabilidade, riscos ou decisoes inexistentes.
-- ============================================================

alter table public.project_gate_events
  add column if not exists event_source text not null default 'live'
    check (event_source in ('live','historical_backfill')),
  add column if not exists effective_at timestamptz,
  add column if not exists evidence_snapshot jsonb not null default '{}'::jsonb;

-- Corrige o backfill inicial: status planning sustenta G3; status active sustenta G4.
update public.projects
set
  governance_gate = case
    when status = 'planning' then 'g3_planning'
    when status = 'active' then 'g4_execution'
    else governance_gate
  end,
  governance_gate_status = case
    when status = 'planning' then 'in_progress'
    when status = 'active' then 'in_progress'
    else governance_gate_status
  end
where status in ('planning','active');

-- Factory antiga continua em G2 quando nao existe uma conclusao de viabilidade explicita.
update public.project_factory_cases f
set
  governance_gate = 'g2_viability',
  governance_gate_status = case
    when v.viability_status is null then 'in_progress'
    when v.viability_status = 'insufficient' then 'blocked'
    when v.viability_status in ('viable','conditional','not_viable') then 'ready'
    else 'in_progress'
  end
from public.factory_validations v
where v.factory_case_id = f.id;

update public.project_factory_cases f
set
  governance_gate = 'g2_viability',
  governance_gate_status = 'in_progress'
where not exists (
  select 1
  from public.factory_validations v
  where v.factory_case_id = f.id
);

-- Reconstrucao auditavel do estado historico observado.
insert into public.project_gate_events (
  user_id,
  project_id,
  gate,
  event_type,
  rationale,
  event_source,
  effective_at,
  evidence_snapshot
)
select
  p.user_id,
  p.id,
  case when p.status = 'planning' then 'g3_planning' else 'g4_execution' end,
  'entered',
  case
    when p.status = 'planning'
      then 'Reconstruido a partir do registo historico do projecto: status=planning.'
    else 'Reconstruido a partir do registo historico do projecto: status=active.'
  end,
  'historical_backfill',
  p.created_at,
  jsonb_build_object(
    'source_table','projects',
    'project_status',p.status,
    'progress',p.progress,
    'created_at',p.created_at,
    'updated_at',p.updated_at
  )
from public.projects p
where p.status in ('planning','active')
  and not exists (
    select 1
    from public.project_gate_events e
    where e.project_id = p.id
      and e.gate = case when p.status = 'planning' then 'g3_planning' else 'g4_execution' end
      and e.event_source = 'historical_backfill'
  );

insert into public.project_gate_events (
  user_id,
  factory_case_id,
  gate,
  event_type,
  rationale,
  event_source,
  effective_at,
  evidence_snapshot
)
select
  f.user_id,
  f.id,
  'g2_viability',
  'entered',
  'Reconstruido a partir do registo historico da Factory. O caso estava em avaliacao/validacao antes da formalizacao dos Gates.',
  'historical_backfill',
  f.created_at,
  jsonb_build_object(
    'source_table','project_factory_cases',
    'stage',f.stage,
    'created_at',f.created_at,
    'updated_at',f.updated_at,
    'legacy_validation_status',v.status,
    'legacy_recommendation',v.recommendation,
    'viability_status',v.viability_status
  )
from public.project_factory_cases f
left join public.factory_validations v on v.factory_case_id = f.id
where not exists (
  select 1
  from public.project_gate_events e
  where e.factory_case_id = f.id
    and e.gate = 'g2_viability'
    and e.event_source = 'historical_backfill'
);

comment on column public.project_gate_events.event_source is
  'live = evento registado pelo novo fluxo; historical_backfill = evento reconstruido a partir de registos anteriores.';
comment on column public.project_gate_events.effective_at is
  'Momento historico de referencia quando o evento foi reconstruido.';
comment on column public.project_gate_events.evidence_snapshot is
  'Snapshot minimo dos registos que suportaram a inferencia historica.';
