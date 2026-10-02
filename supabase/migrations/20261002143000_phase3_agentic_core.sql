-- ============================================================
-- PHASE 3 — AGENTIC CORE
-- Agent registry, execution runs, QA/PASS and human approval gates.
-- Additive only; existing ai_commands / ai_interactions remain available.
-- ============================================================

create table if not exists public.agent_runs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  agent_type text not null
    check (agent_type in ('command','research','business','marketing','product','qa','analytics')),
  prompt_code text,
  objective text not null,
  input_context jsonb not null default '{}'::jsonb,
  proposed_actions jsonb not null default '[]'::jsonb,
  status text not null default 'draft'
    check (status in ('draft','ready','waiting_approval','approved','running','qa','passed','failed','cancelled')),
  qa_status text not null default 'not_checked'
    check (qa_status in ('not_checked','pass','fail')),
  qa_evidence jsonb not null default '[]'::jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.approval_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  agent_run_id uuid not null references public.agent_runs(id) on delete cascade,
  action_type text not null
    check (action_type in ('payment','external_message','external_publication','delete','strategic_change','pricing_change','permission_change','irreversible_action')),
  description text not null,
  payload_preview jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','cancelled')),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.execution_steps (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  agent_run_id uuid not null references public.agent_runs(id) on delete cascade,
  sequence_no integer not null check (sequence_no > 0),
  title text not null,
  step_type text not null default 'analysis'
    check (step_type in ('analysis','read','write','external_action','qa')),
  requires_approval boolean not null default false,
  approval_request_id uuid references public.approval_requests(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending','blocked','running','completed','failed','skipped')),
  result jsonb,
  evidence jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (agent_run_id, sequence_no)
);

create index if not exists idx_agent_runs_user_id on public.agent_runs(user_id);
create index if not exists idx_agent_runs_project_id on public.agent_runs(project_id);
create index if not exists idx_agent_runs_status on public.agent_runs(status);
create index if not exists idx_approval_requests_user_id on public.approval_requests(user_id);
create index if not exists idx_approval_requests_status on public.approval_requests(status);
create index if not exists idx_execution_steps_agent_run_id on public.execution_steps(agent_run_id);

drop trigger if exists update_agent_runs_updated_at on public.agent_runs;
create trigger update_agent_runs_updated_at
before update on public.agent_runs
for each row execute function public.update_updated_at_column();

alter table public.agent_runs enable row level security;
alter table public.approval_requests enable row level security;
alter table public.execution_steps enable row level security;

create policy "Users can view own agent runs"
on public.agent_runs for select to authenticated using (user_id = auth.uid());
create policy "Users can create own agent runs"
on public.agent_runs for insert to authenticated with check (user_id = auth.uid());
create policy "Users can update own agent runs"
on public.agent_runs for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Users can view own approval requests"
on public.approval_requests for select to authenticated using (user_id = auth.uid());
create policy "Users can create own approval requests"
on public.approval_requests for insert to authenticated with check (user_id = auth.uid());
create policy "Users can update own approval requests"
on public.approval_requests for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Users can view own execution steps"
on public.execution_steps for select to authenticated using (user_id = auth.uid());
create policy "Users can create own execution steps"
on public.execution_steps for insert to authenticated with check (user_id = auth.uid());
create policy "Users can update own execution steps"
on public.execution_steps for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.enforce_agentic_owned_relationships()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.project_id is not null and not exists (
    select 1 from public.projects where id = new.project_id and user_id = new.user_id
  ) then
    raise exception 'project does not belong to user' using errcode = '23503';
  end if;

  if tg_table_name in ('approval_requests','execution_steps') and not exists (
    select 1 from public.agent_runs where id = new.agent_run_id and user_id = new.user_id
  ) then
    raise exception 'agent run does not belong to user' using errcode = '23503';
  end if;

  return new;
end;
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array['agent_runs','approval_requests','execution_steps']
  loop
    execute format('drop trigger if exists enforce_agentic_owned_relationships on public.%I', v_table);
    execute format(
      'create trigger enforce_agentic_owned_relationships before insert or update on public.%I for each row execute function public.enforce_agentic_owned_relationships()',
      v_table
    );
  end loop;
end
$$;
