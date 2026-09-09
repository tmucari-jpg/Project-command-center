-- ============================================================
-- PROJECT COMMAND CENTER
-- SECURITY + EXECUTION HARDENING
-- ============================================================

-- Rate limiting is persisted in Postgres so Vercel instances do not rely on
-- process-local memory.

create table if not exists public.api_rate_limits (
  user_id uuid not null references public.profiles(id) on delete cascade,
  rate_key text not null,
  window_start timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  primary key (user_id, rate_key)
);

alter table public.api_rate_limits enable row level security;

-- No direct RLS policies are intentionally granted. Authenticated users access
-- the table only through the security-definer function below.

create or replace function public.check_brave_search_rate_limit()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_key constant text := 'brave_search';
  v_limit constant integer := 20;
  v_window_seconds constant integer := 60;
  v_count integer;
  v_window_start timestamptz;
begin
  if v_user_id is null then
    return false;
  end if;

  insert into public.api_rate_limits (
    user_id,
    rate_key,
    window_start,
    request_count
  )
  values (
    v_user_id,
    v_key,
    now(),
    0
  )
  on conflict (user_id, rate_key) do nothing;

  select request_count, window_start
    into v_count, v_window_start
  from public.api_rate_limits
  where user_id = v_user_id
    and rate_key = v_key
  for update;

  if now() >= v_window_start + make_interval(secs => v_window_seconds) then
    update public.api_rate_limits
    set window_start = now(),
        request_count = 1
    where user_id = v_user_id
      and rate_key = v_key;

    return true;
  end if;

  if v_count >= v_limit then
    return false;
  end if;

  update public.api_rate_limits
  set request_count = request_count + 1
  where user_id = v_user_id
    and rate_key = v_key;

  return true;
end;
$$;

revoke all on function public.check_brave_search_rate_limit() from public;
grant execute on function public.check_brave_search_rate_limit() to authenticated;

-- Only one active timer session per user.
create unique index if not exists idx_time_sessions_one_open_per_user
on public.time_sessions(user_id)
where ended_at is null;

-- Keep time session duration derived from timestamps.
create or replace function public.calculate_time_session_duration()
returns trigger
language plpgsql
as $$
begin
  if new.ended_at is null then
    new.duration_seconds = null;
  else
    new.duration_seconds = greatest(
      0,
      floor(extract(epoch from (new.ended_at - new.started_at)))::integer
    );
  end if;

  return new;
end;
$$;

drop trigger if exists calculate_time_session_duration
on public.time_sessions;

create trigger calculate_time_session_duration
before insert or update of started_at, ended_at
on public.time_sessions
for each row
execute function public.calculate_time_session_duration();

-- Recalculate actual minutes on the action whenever a time session changes.
create or replace function public.refresh_action_actual_minutes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action_id uuid;
begin
  v_action_id := case when tg_op = 'DELETE' then old.action_id else new.action_id end;

  update public.actions
  set actual_minutes = coalesce((
    select floor(sum(coalesce(duration_seconds, 0)) / 60.0)::integer
    from public.time_sessions
    where action_id = v_action_id
  ), 0)
  where id = v_action_id;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists refresh_action_actual_minutes
on public.time_sessions;

create trigger refresh_action_actual_minutes
after insert or update of ended_at, duration_seconds or delete
on public.time_sessions
for each row
execute function public.refresh_action_actual_minutes();

-- Synchronise completion timestamps with status.
create or replace function public.sync_action_completion_timestamp()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    new.completed_at = coalesce(new.completed_at, now());
  elsif new.status <> 'completed' and old.status = 'completed' then
    new.completed_at = null;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_action_completion_timestamp
on public.actions;

create trigger sync_action_completion_timestamp
before update of status
on public.actions
for each row
execute function public.sync_action_completion_timestamp();

-- Generic immutable audit trail for user-owned entities.
create or replace function public.audit_user_owned_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_user_id uuid;
  v_entity_id uuid;
begin
  if tg_op = 'INSERT' then
    v_old := null;
    v_new := to_jsonb(new);
    v_user_id := coalesce((v_new ->> 'user_id')::uuid, auth.uid());
    v_entity_id := (v_new ->> 'id')::uuid;
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    v_user_id := coalesce((v_new ->> 'user_id')::uuid, (v_old ->> 'user_id')::uuid, auth.uid());
    v_entity_id := coalesce((v_new ->> 'id')::uuid, (v_old ->> 'id')::uuid);
  else
    v_old := to_jsonb(old);
    v_new := null;
    v_user_id := coalesce((v_old ->> 'user_id')::uuid, auth.uid());
    v_entity_id := (v_old ->> 'id')::uuid;
  end if;

  insert into public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data
  )
  values (
    v_user_id,
    lower(tg_op),
    tg_table_name,
    v_entity_id,
    v_old,
    v_new
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'objectives',
    'projects',
    'deliverables',
    'actions',
    'time_sessions',
    'evidence',
    'metrics',
    'blockers',
    'ideas',
    'integrations'
  ]
  loop
    execute format('drop trigger if exists audit_user_owned_change on public.%I', v_table);
    execute format(
      'create trigger audit_user_owned_change after insert or update or delete on public.%I for each row execute function public.audit_user_owned_change()',
      v_table
    );
  end loop;
end
$$;

-- Useful query indexes for dashboard and focus mode.
create index if not exists idx_objectives_user_status
on public.objectives(user_id, status);

create index if not exists idx_projects_user_status
on public.projects(user_id, status);

create index if not exists idx_actions_user_status_due
on public.actions(user_id, status, due_at);

create index if not exists idx_actions_user_next
on public.actions(user_id, is_next_action)
where is_next_action = true;

create index if not exists idx_blockers_user_status_project
on public.blockers(user_id, status, project_id);

create index if not exists idx_time_sessions_user_started
on public.time_sessions(user_id, started_at desc);
