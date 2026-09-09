-- ============================================================
-- PROJECT COMMAND CENTER
-- DATABASE SCHEMA
-- ============================================================

-- Documento: 04_DATABASE_SCHEMA.sql
-- Versão: 1.0
-- Estado: SOURCE OF TRUTH

-- IMPORTANTE:
-- Este ficheiro define a estrutura conceptual da base de dados.
-- O agente deve analisar o estado real do projecto antes de
-- executar qualquer migration.

-- NÃO EXECUTAR DIRECTAMENTE EM PRODUÇÃO SEM AUDITORIA.

-- ============================================================

-- ============================================================
-- 1. EXTENSIONS
-- ============================================================

create extension if not exists "uuid-ossp";

-- ============================================================
-- 2. PROFILES
-- ============================================================

create table if not exists public.profiles (
id uuid primary key references auth.users(id) on delete cascade,

full_name text,
avatar_url text,

timezone text default 'Africa/Maputo',

created_at timestamptz not null default now(),
updated_at timestamptz not null default now()

);

-- ============================================================
-- 3. OBJECTIVES
-- ============================================================

create table if not exists public.objectives (
id uuid primary key default uuid_generate_v4(),

user_id uuid not null references public.profiles(id) on delete cascade,

title text not null,
description text,

expected_result text,

priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'critical')),

status text not null default 'draft'
    check (
        status in (
            'draft',
            'active',
            'on_track',
            'at_risk',
            'delayed',
            'completed',
            'cancelled'
        )
    ),

start_date date,
due_date date,

progress numeric(5,2) not null default 0
    check (progress >= 0 and progress <= 100),

metric_name text,
baseline_value numeric,
target_value numeric,
current_value numeric,

notes text,

created_at timestamptz not null default now(),
updated_at timestamptz not null default now(),

check (
    due_date is null
    or start_date is null
    or due_date >= start_date
)

);

-- ============================================================
-- 4. PROJECTS
-- ============================================================

create table if not exists public.projects (
id uuid primary key default uuid_generate_v4(),

user_id uuid not null references public.profiles(id) on delete cascade,

objective_id uuid references public.objectives(id) on delete set null,

title text not null,
description text,

expected_result text,

priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'critical')),

status text not null default 'idea'
    check (
        status in (
            'idea',
            'planning',
            'active',
            'on_hold',
            'at_risk',
            'completed',
            'cancelled'
        )
    ),

start_date date,
due_date date,

progress numeric(5,2) not null default 0
    check (progress >= 0 and progress <= 100),

budget numeric,
currency text,

next_action text,

notes text,

created_at timestamptz not null default now(),
updated_at timestamptz not null default now(),

check (
    due_date is null
    or start_date is null
    or due_date >= start_date
)

);

-- ============================================================
-- 5. DELIVERABLES
-- ============================================================

create table if not exists public.deliverables (
id uuid primary key default uuid_generate_v4(),

user_id uuid not null references public.profiles(id) on delete cascade,

project_id uuid not null references public.projects(id) on delete cascade,

title text not null,
description text,

priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'critical')),

status text not null default 'pending'
    check (
        status in (
            'pending',
            'active',
            'blocked',
            'completed',
            'cancelled'
        )
    ),

due_date date,

progress numeric(5,2) not null default 0
    check (progress >= 0 and progress <= 100),

completion_criteria text,

created_at timestamptz not null default now(),
updated_at timestamptz not null default now()

);

-- ============================================================
-- 6. ACTIONS
-- ============================================================

create table if not exists public.actions (
id uuid primary key default uuid_generate_v4(),

user_id uuid not null references public.profiles(id) on delete cascade,

project_id uuid references public.projects(id) on delete cascade,

deliverable_id uuid references public.deliverables(id) on delete cascade,

title text not null,
description text,

priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'critical')),

status text not null default 'pending'
    check (
        status in (
            'pending',
            'in_progress',
            'blocked',
            'completed',
            'cancelled'
        )
    ),

due_at timestamptz,

estimated_minutes integer
    check (
        estimated_minutes is null
        or estimated_minutes > 0
    ),

actual_minutes integer not null default 0
    check (actual_minutes >= 0),

completion_criteria text,

is_next_action boolean not null default false,

completed_at timestamptz,

created_at timestamptz not null default now(),
updated_at timestamptz not null default now()

);

-- ============================================================
-- 7. TIME SESSIONS
-- ============================================================

create table if not exists public.time_sessions (
id uuid primary key default uuid_generate_v4(),

user_id uuid not null references public.profiles(id) on delete cascade,

action_id uuid not null references public.actions(id) on delete cascade,

started_at timestamptz not null,
ended_at timestamptz,

duration_seconds integer
    check (
        duration_seconds is null
        or duration_seconds >= 0
    ),

notes text,

created_at timestamptz not null default now(),

check (
    ended_at is null
    or ended_at >= started_at
)

);

-- ============================================================
-- 8. EVIDENCE
-- ============================================================

create table if not exists public.evidence (
id uuid primary key default uuid_generate_v4(),

user_id uuid not null references public.profiles(id) on delete cascade,

action_id uuid references public.actions(id) on delete cascade,

deliverable_id uuid references public.deliverables(id) on delete cascade,

project_id uuid references public.projects(id) on delete cascade,

evidence_type text not null
    check (
        evidence_type in (
            'file',
            'link',
            'document',
            'screenshot',
            'comment',
            'number',
            'result',
            'external_reference'
        )
    ),

title text,

description text,

url text,

storage_path text,

numeric_value numeric,

created_at timestamptz not null default now()

);

-- ============================================================
-- 9. METRICS
-- ============================================================

create table if not exists public.metrics (
id uuid primary key default uuid_generate_v4(),

user_id uuid not null references public.profiles(id) on delete cascade,

objective_id uuid references public.objectives(id) on delete cascade,

project_id uuid references public.projects(id) on delete cascade,

name text not null,

description text,

metric_type text not null
    check (
        metric_type in (
            'execution_ratio',
            'outcome_ratio',
            'on_time_completion',
            'focus_ratio',
            'time_efficiency',
            'project_health',
            'custom'
        )
    ),

unit text,

baseline_value numeric,
target_value numeric,
current_value numeric,

measurement_date date,

created_at timestamptz not null default now(),
updated_at timestamptz not null default now()

);

-- ============================================================
-- 10. BLOCKERS
-- ============================================================

create table if not exists public.blockers (
id uuid primary key default uuid_generate_v4(),

user_id uuid not null references public.profiles(id) on delete cascade,

project_id uuid references public.projects(id) on delete cascade,

deliverable_id uuid references public.deliverables(id) on delete cascade,

action_id uuid references public.actions(id) on delete cascade,

title text not null,

description text,

impact text,

responsible text,

identified_at timestamptz not null default now(),

resolution_due_at timestamptz,

status text not null default 'open'
    check (
        status in (
            'open',
            'investigating',
            'waiting',
            'resolved',
            'ignored'
        )
    ),

solution text,

resolved_at timestamptz,

created_at timestamptz not null default now(),
updated_at timestamptz not null default now()

);

-- ============================================================
-- 11. IDEAS
-- ============================================================

create table if not exists public.ideas (
id uuid primary key default uuid_generate_v4(),

user_id uuid not null references public.profiles(id) on delete cascade,

project_id uuid references public.projects(id) on delete set null,

title text not null,

description text,

source text,

potential text,

priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'critical')),

status text not null default 'captured'
    check (
        status in (
            'captured',
            'evaluating',
            'approved',
            'rejected',
            'converted_to_project',
            'archived'
        )
    ),

next_decision text,

created_at timestamptz not null default now(),
updated_at timestamptz not null default now()

);

-- ============================================================
-- 12. AI INTERACTIONS
-- ============================================================

create table if not exists public.ai_interactions (
id uuid primary key default uuid_generate_v4(),

user_id uuid not null references public.profiles(id) on delete cascade,

command text not null,

intent text,

context jsonb,

response text,

model text,

tokens_used integer,

created_at timestamptz not null default now()

);

-- ============================================================
-- 13. AI COMMANDS
-- ============================================================

create table if not exists public.ai_commands (
id uuid primary key default uuid_generate_v4(),

user_id uuid not null references public.profiles(id) on delete cascade,

command text not null,

intent text,

parameters jsonb,

status text not null default 'pending'
    check (
        status in (
            'pending',
            'processing',
            'completed',
            'failed',
            'cancelled'
        )
    ),

result jsonb,

error_message text,

created_at timestamptz not null default now(),
completed_at timestamptz

);

-- ============================================================
-- 14. AUDIT LOGS
-- ============================================================

create table if not exists public.audit_logs (
id uuid primary key default uuid_generate_v4(),

user_id uuid references public.profiles(id) on delete set null,

action text not null,

entity_type text,

entity_id uuid,

old_data jsonb,

new_data jsonb,

ip_address inet,

user_agent text,

created_at timestamptz not null default now()

);

-- ============================================================
-- 15. NOTIFICATIONS
-- ============================================================

create table if not exists public.notifications (
id uuid primary key default uuid_generate_v4(),

user_id uuid not null references public.profiles(id) on delete cascade,

type text not null,

title text not null,

message text,

priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'critical')),

read_at timestamptz,

related_entity_type text,

related_entity_id uuid,

created_at timestamptz not null default now()

);

-- ============================================================
-- 16. INTEGRATIONS
-- ============================================================

create table if not exists public.integrations (
id uuid primary key default uuid_generate_v4(),

user_id uuid not null references public.profiles(id) on delete cascade,

provider text not null,

status text not null default 'disconnected'
    check (
        status in (
            'connected',
            'disconnected',
            'error',
            'expired'
        )
    ),

metadata jsonb,

connected_at timestamptz,

last_sync_at timestamptz,

created_at timestamptz not null default now(),
updated_at timestamptz not null default now()

);

-- ============================================================
-- 17. SECURITY EVENTS
-- ============================================================

create table if not exists public.security_events (
id uuid primary key default uuid_generate_v4(),

user_id uuid references public.profiles(id) on delete set null,

event_type text not null,

severity text not null
    check (
        severity in (
            'info',
            'low',
            'medium',
            'high',
            'critical'
        )
    ),

description text,

metadata jsonb,

ip_address inet,

user_agent text,

created_at timestamptz not null default now()

);

-- ============================================================
-- 18. INDEXES
-- ============================================================

create index if not exists idx_objectives_user_id
on public.objectives(user_id);

create index if not exists idx_projects_user_id
on public.projects(user_id);

create index if not exists idx_projects_objective_id
on public.projects(objective_id);

create index if not exists idx_deliverables_user_id
on public.deliverables(user_id);

create index if not exists idx_deliverables_project_id
on public.deliverables(project_id);

create index if not exists idx_actions_user_id
on public.actions(user_id);

create index if not exists idx_actions_project_id
on public.actions(project_id);

create index if not exists idx_actions_deliverable_id
on public.actions(deliverable_id);

create index if not exists idx_actions_status
on public.actions(status);

create index if not exists idx_actions_due_at
on public.actions(due_at);

create index if not exists idx_time_sessions_user_id
on public.time_sessions(user_id);

create index if not exists idx_time_sessions_action_id
on public.time_sessions(action_id);

create index if not exists idx_evidence_user_id
on public.evidence(user_id);

create index if not exists idx_metrics_user_id
on public.metrics(user_id);

create index if not exists idx_blockers_user_id
on public.blockers(user_id);

create index if not exists idx_blockers_status
on public.blockers(status);

create index if not exists idx_ideas_user_id
on public.ideas(user_id);

create index if not exists idx_notifications_user_id
on public.notifications(user_id);

create index if not exists idx_audit_logs_user_id
on public.audit_logs(user_id);

create index if not exists idx_security_events_user_id
on public.security_events(user_id);

-- ============================================================
-- 19. UPDATED_AT FUNCTION
-- ============================================================

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
new.updated_at = now();
return new;
end;
$$;

-- ============================================================
-- 20. UPDATED_AT TRIGGERS
-- ============================================================

drop trigger if exists update_profiles_updated_at
on public.profiles;

create trigger update_profiles_updated_at
before update on public.profiles
for each row
execute function public.update_updated_at_column();

drop trigger if exists update_objectives_updated_at
on public.objectives;

create trigger update_objectives_updated_at
before update on public.objectives
for each row
execute function public.update_updated_at_column();

drop trigger if exists update_projects_updated_at
on public.projects;

create trigger update_projects_updated_at
before update on public.projects
for each row
execute function public.update_updated_at_column();

drop trigger if exists update_deliverables_updated_at
on public.deliverables;

create trigger update_deliverables_updated_at
before update on public.deliverables
for each row
execute function public.update_updated_at_column();

drop trigger if exists update_actions_updated_at
on public.actions;

create trigger update_actions_updated_at
before update on public.actions
for each row
execute function public.update_updated_at_column();

drop trigger if exists update_metrics_updated_at
on public.metrics;

create trigger update_metrics_updated_at
before update on public.metrics
for each row
execute function public.update_updated_at_column();

drop trigger if exists update_blockers_updated_at
on public.blockers;

create trigger update_blockers_updated_at
before update on public.blockers
for each row
execute function public.update_updated_at_column();

drop trigger if exists update_ideas_updated_at
on public.ideas;

create trigger update_ideas_updated_at
before update on public.ideas
for each row
execute function public.update_updated_at_column();

drop trigger if exists update_integrations_updated_at
on public.integrations;

create trigger update_integrations_updated_at
before update on public.integrations
for each row
execute function public.update_updated_at_column();

-- ============================================================
-- 21. PROFILE CREATION TRIGGER
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin

insert into public.profiles (
    id,
    full_name
)

values (
    new.id,
    coalesce(
        new.raw_user_meta_data ->> 'full_name',
        new.email
    )
);

return new;

end;
$$;

drop trigger if exists on_auth_user_created
on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_user();

-- ============================================================
-- 22. DATA INTEGRITY NOTES
-- ============================================================

-- O agente deve validar:

-- 1. Todas as foreign keys.
-- 2. Todas as constraints.
-- 3. Todas as relações user_id.
-- 4. Compatibilidade com RLS.
-- 5. Necessidade real dos indexes.
-- 6. Compatibilidade com Supabase.
-- 7. Compatibilidade com migrations existentes.

-- Não assumir que este schema deve substituir automaticamente
-- qualquer schema existente.

-- Em caso de conflito, analisar primeiro.

-- ============================================================
-- END OF DATABASE SCHEMA
-- ============================================================
