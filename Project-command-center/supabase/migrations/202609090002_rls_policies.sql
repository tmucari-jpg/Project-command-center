-- ============================================================
-- PROJECT COMMAND CENTER
-- ROW LEVEL SECURITY
-- ============================================================

-- IMPORTANTE:

-- Este documento define as regras de segurança ao nível da
-- base de dados.

-- NÃO EXECUTAR directamente em produção sem:

-- 1. auditoria;
-- 2. confirmação do schema existente;
-- 3. verificação das migrations;
-- 4. testes de autorização;
-- 5. confirmação do ambiente.

-- ============================================================

-- ============================================================
-- 1. ENABLE RLS
-- ============================================================

alter table public.profiles enable row level security;

alter table public.objectives enable row level security;

alter table public.projects enable row level security;

alter table public.deliverables enable row level security;

alter table public.actions enable row level security;

alter table public.time_sessions enable row level security;

alter table public.evidence enable row level security;

alter table public.metrics enable row level security;

alter table public.blockers enable row level security;

alter table public.ideas enable row level security;

alter table public.ai_interactions enable row level security;

alter table public.ai_commands enable row level security;

alter table public.audit_logs enable row level security;

alter table public.notifications enable row level security;

alter table public.integrations enable row level security;

alter table public.security_events enable row level security;

-- ============================================================
-- 2. PROFILES
-- ============================================================

drop policy if exists "Users can view own profile"
on public.profiles;

create policy "Users can view own profile"
on public.profiles
for select
to authenticated
using (
id = auth.uid()
);

drop policy if exists "Users can update own profile"
on public.profiles;

create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (
id = auth.uid()
)
with check (
id = auth.uid()
);

-- ============================================================
-- 3. OBJECTIVES
-- ============================================================

drop policy if exists "Users can view own objectives"
on public.objectives;

create policy "Users can view own objectives"
on public.objectives
for select
to authenticated
using (
user_id = auth.uid()
);

drop policy if exists "Users can create own objectives"
on public.objectives;

create policy "Users can create own objectives"
on public.objectives
for insert
to authenticated
with check (
user_id = auth.uid()
);

drop policy if exists "Users can update own objectives"
on public.objectives;

create policy "Users can update own objectives"
on public.objectives
for update
to authenticated
using (
user_id = auth.uid()
)
with check (
user_id = auth.uid()
);

drop policy if exists "Users can delete own objectives"
on public.objectives;

create policy "Users can delete own objectives"
on public.objectives
for delete
to authenticated
using (
user_id = auth.uid()
);

-- ============================================================
-- 4. PROJECTS
-- ============================================================

drop policy if exists "Users can view own projects"
on public.projects;

create policy "Users can view own projects"
on public.projects
for select
to authenticated
using (
user_id = auth.uid()
);

drop policy if exists "Users can create own projects"
on public.projects;

create policy "Users can create own projects"
on public.projects
for insert
to authenticated
with check (
user_id = auth.uid()
);

drop policy if exists "Users can update own projects"
on public.projects;

create policy "Users can update own projects"
on public.projects
for update
to authenticated
using (
user_id = auth.uid()
)
with check (
user_id = auth.uid()
);

drop policy if exists "Users can delete own projects"
on public.projects;

create policy "Users can delete own projects"
on public.projects
for delete
to authenticated
using (
user_id = auth.uid()
);

-- ============================================================
-- 5. DELIVERABLES
-- ============================================================

drop policy if exists "Users can view own deliverables"
on public.deliverables;

create policy "Users can view own deliverables"
on public.deliverables
for select
to authenticated
using (
user_id = auth.uid()
);

drop policy if exists "Users can create own deliverables"
on public.deliverables;

create policy "Users can create own deliverables"
on public.deliverables
for insert
to authenticated
with check (
user_id = auth.uid()
);

drop policy if exists "Users can update own deliverables"
on public.deliverables;

create policy "Users can update own deliverables"
on public.deliverables
for update
to authenticated
using (
user_id = auth.uid()
)
with check (
user_id = auth.uid()
);

drop policy if exists "Users can delete own deliverables"
on public.deliverables;

create policy "Users can delete own deliverables"
on public.deliverables
for delete
to authenticated
using (
user_id = auth.uid()
);

-- ============================================================
-- 6. ACTIONS
-- ============================================================

drop policy if exists "Users can view own actions"
on public.actions;

create policy "Users can view own actions"
on public.actions
for select
to authenticated
using (
user_id = auth.uid()
);

drop policy if exists "Users can create own actions"
on public.actions;

create policy "Users can create own actions"
on public.actions
for insert
to authenticated
with check (
user_id = auth.uid()
);

drop policy if exists "Users can update own actions"
on public.actions;

create policy "Users can update own actions"
on public.actions
for update
to authenticated
using (
user_id = auth.uid()
)
with check (
user_id = auth.uid()
);

drop policy if exists "Users can delete own actions"
on public.actions;

create policy "Users can delete own actions"
on public.actions
for delete
to authenticated
using (
user_id = auth.uid()
);

-- ============================================================
-- 7. TIME SESSIONS
-- ============================================================

drop policy if exists "Users can view own time sessions"
on public.time_sessions;

create policy "Users can view own time sessions"
on public.time_sessions
for select
to authenticated
using (
user_id = auth.uid()
);

drop policy if exists "Users can create own time sessions"
on public.time_sessions;

create policy "Users can create own time sessions"
on public.time_sessions
for insert
to authenticated
with check (
user_id = auth.uid()
);

drop policy if exists "Users can update own time sessions"
on public.time_sessions;

create policy "Users can update own time sessions"
on public.time_sessions
for update
to authenticated
using (
user_id = auth.uid()
)
with check (
user_id = auth.uid()
);

drop policy if exists "Users can delete own time sessions"
on public.time_sessions;

create policy "Users can delete own time sessions"
on public.time_sessions
for delete
to authenticated
using (
user_id = auth.uid()
);

-- ============================================================
-- 8. EVIDENCE
-- ============================================================

drop policy if exists "Users can view own evidence"
on public.evidence;

create policy "Users can view own evidence"
on public.evidence
for select
to authenticated
using (
user_id = auth.uid()
);

drop policy if exists "Users can create own evidence"
on public.evidence;

create policy "Users can create own evidence"
on public.evidence
for insert
to authenticated
with check (
user_id = auth.uid()
);

drop policy if exists "Users can update own evidence"
on public.evidence;

create policy "Users can update own evidence"
on public.evidence
for update
to authenticated
using (
user_id = auth.uid()
)
with check (
user_id = auth.uid()
);

drop policy if exists "Users can delete own evidence"
on public.evidence;

create policy "Users can delete own evidence"
on public.evidence
for delete
to authenticated
using (
user_id = auth.uid()
);

-- ============================================================
-- 9. METRICS
-- ============================================================

drop policy if exists "Users can view own metrics"
on public.metrics;

create policy "Users can view own metrics"
on public.metrics
for select
to authenticated
using (
user_id = auth.uid()
);

drop policy if exists "Users can create own metrics"
on public.metrics;

create policy "Users can create own metrics"
on public.metrics
for insert
to authenticated
with check (
user_id = auth.uid()
);

drop policy if exists "Users can update own metrics"
on public.metrics;

create policy "Users can update own metrics"
on public.metrics
for update
to authenticated
using (
user_id = auth.uid()
)
with check (
user_id = auth.uid()
);

drop policy if exists "Users can delete own metrics"
on public.metrics;

create policy "Users can delete own metrics"
on public.metrics
for delete
to authenticated
using (
user_id = auth.uid()
);

-- ============================================================
-- 10. BLOCKERS
-- ============================================================

drop policy if exists "Users can view own blockers"
on public.blockers;

create policy "Users can view own blockers"
on public.blockers
for select
to authenticated
using (
user_id = auth.uid()
);

drop policy if exists "Users can create own blockers"
on public.blockers;

create policy "Users can create own blockers"
on public.blockers
for insert
to authenticated
with check (
user_id = auth.uid()
);

drop policy if exists "Users can update own blockers"
on public.blockers;

create policy "Users can update own blockers"
on public.blockers
for update
to authenticated
using (
user_id = auth.uid()
)
with check (
user_id = auth.uid()
);

drop policy if exists "Users can delete own blockers"
on public.blockers;

create policy "Users can delete own blockers"
on public.blockers
for delete
to authenticated
using (
user_id = auth.uid()
);

-- ============================================================
-- 11. IDEAS
-- ============================================================

drop policy if exists "Users can view own ideas"
on public.ideas;

create policy "Users can view own ideas"
on public.ideas
for select
to authenticated
using (
user_id = auth.uid()
);

drop policy if exists "Users can create own ideas"
on public.ideas;

create policy "Users can create own ideas"
on public.ideas
for insert
to authenticated
with check (
user_id = auth.uid()
);

drop policy if exists "Users can update own ideas"
on public.ideas;

create policy "Users can update own ideas"
on public.ideas
for update
to authenticated
using (
user_id = auth.uid()
)
with check (
user_id = auth.uid()
);

drop policy if exists "Users can delete own ideas"
on public.ideas;

create policy "Users can delete own ideas"
on public.ideas
for delete
to authenticated
using (
user_id = auth.uid()
);

-- ============================================================
-- 12. AI INTERACTIONS
-- ============================================================

drop policy if exists "Users can view own AI interactions"
on public.ai_interactions;

create policy "Users can view own AI interactions"
on public.ai_interactions
for select
to authenticated
using (
user_id = auth.uid()
);

drop policy if exists "Users can create own AI interactions"
on public.ai_interactions;

create policy "Users can create own AI interactions"
on public.ai_interactions
for insert
to authenticated
with check (
user_id = auth.uid()
);

-- ============================================================
-- 13. AI COMMANDS
-- ============================================================

drop policy if exists "Users can view own AI commands"
on public.ai_commands;

create policy "Users can view own AI commands"
on public.ai_commands
for select
to authenticated
using (
user_id = auth.uid()
);

drop policy if exists "Users can create own AI commands"
on public.ai_commands;

create policy "Users can create own AI commands"
on public.ai_commands
for insert
to authenticated
with check (
user_id = auth.uid()
);

-- ============================================================
-- 14. AUDIT LOGS
-- ============================================================

drop policy if exists "Users can view own audit logs"
on public.audit_logs;

create policy "Users can view own audit logs"
on public.audit_logs
for select
to authenticated
using (
user_id = auth.uid()
);

-- Não permitir que utilizadores normais alterem ou eliminem
-- audit logs directamente.

-- Registos administrativos devem ser criados através de
-- mecanismos server-side apropriados.

-- ============================================================
-- 15. NOTIFICATIONS
-- ============================================================

drop policy if exists "Users can view own notifications"
on public.notifications;

create policy "Users can view own notifications"
on public.notifications
for select
to authenticated
using (
user_id = auth.uid()
);

drop policy if exists "Users can update own notifications"
on public.notifications;

create policy "Users can update own notifications"
on public.notifications
for update
to authenticated
using (
user_id = auth.uid()
)
with check (
user_id = auth.uid()
);

-- ============================================================
-- 16. INTEGRATIONS
-- ============================================================

drop policy if exists "Users can view own integrations"
on public.integrations;

create policy "Users can view own integrations"
on public.integrations
for select
to authenticated
using (
user_id = auth.uid()
);

drop policy if exists "Users can create own integrations"
on public.integrations;

create policy "Users can create own integrations"
on public.integrations
for insert
to authenticated
with check (
user_id = auth.uid()
);

drop policy if exists "Users can update own integrations"
on public.integrations;

create policy "Users can update own integrations"
on public.integrations
for update
to authenticated
using (
user_id = auth.uid()
)
with check (
user_id = auth.uid()
);

drop policy if exists "Users can delete own integrations"
on public.integrations;

create policy "Users can delete own integrations"
on public.integrations
for delete
to authenticated
using (
user_id = auth.uid()
);

-- ============================================================
-- 17. SECURITY EVENTS
-- ============================================================

drop policy if exists "Users can view own security events"
on public.security_events;

create policy "Users can view own security events"
on public.security_events
for select
to authenticated
using (
user_id = auth.uid()
);

-- Utilizadores não devem poder alterar ou apagar directamente
-- eventos de segurança.

-- ============================================================
-- 18. SERVICE ROLE
-- ============================================================

-- O service_role do Supabase possui privilégios elevados e
-- contorna RLS.

-- NUNCA expor service_role_key no frontend.

-- Operações que necessitem desse nível de privilégio devem
-- ocorrer exclusivamente no ambiente server-side apropriado.

-- ============================================================
-- 19. TESTES OBRIGATÓRIOS
-- ============================================================

-- O agente deve criar testes que confirmem:

-- TESTE 1
-- Utilizador A consegue consultar os próprios dados.

-- TESTE 2
-- Utilizador A NÃO consegue consultar dados do utilizador B.

-- TESTE 3
-- Utilizador A consegue criar dados próprios.

-- TESTE 4
-- Utilizador A NÃO consegue criar dados em nome do utilizador B.

-- TESTE 5
-- Utilizador A consegue actualizar dados próprios.

-- TESTE 6
-- Utilizador A NÃO consegue actualizar dados do utilizador B.

-- TESTE 7
-- Utilizador A consegue eliminar apenas dados próprios.

-- TESTE 8
-- Utilizador A NÃO consegue eliminar dados do utilizador B.

-- TESTE 9
-- Utilizador não autenticado não consegue aceder aos dados
-- privados.

-- TESTE 10
-- Service role não aparece no frontend.

-- ============================================================
-- 20. PRINCÍPIO DE SEGURANÇA
-- ============================================================

-- Nunca confiar apenas no frontend para autorização.

-- A regra de acesso deve ser aplicada na base de dados e/ou
-- no backend.

-- Segurança deve existir em profundidade:

-- AUTH
-- ↓
-- AUTHORIZATION
-- ↓
-- RLS
-- ↓
-- SERVER VALIDATION
-- ↓
-- DATABASE CONSTRAINTS
-- ↓
-- AUDIT

-- ============================================================

-- ============================================================
-- END OF RLS POLICIES
-- ============================================================
