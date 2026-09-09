-- ============================================================
-- PROJECT COMMAND CENTER
-- RELATIONAL OWNERSHIP HARDENING
-- ============================================================
-- RLS ensures user_id = auth.uid(). This trigger additionally guarantees that
-- every referenced parent row belongs to the same user. It prevents a user
-- from linking their child record to another user's UUID, even if that UUID
-- were guessed or obtained elsewhere.

create or replace function public.enforce_owned_relationships()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null then
    raise exception 'user_id is required' using errcode = '23502';
  end if;

  if tg_table_name = 'projects' then
    if new.objective_id is not null and not exists (
      select 1 from public.objectives
      where id = new.objective_id and user_id = new.user_id
    ) then
      raise exception 'objective does not belong to user' using errcode = '23503';
    end if;

  elsif tg_table_name = 'deliverables' then
    if not exists (
      select 1 from public.projects
      where id = new.project_id and user_id = new.user_id
    ) then
      raise exception 'project does not belong to user' using errcode = '23503';
    end if;

  elsif tg_table_name = 'actions' then
    if new.project_id is not null and not exists (
      select 1 from public.projects
      where id = new.project_id and user_id = new.user_id
    ) then
      raise exception 'project does not belong to user' using errcode = '23503';
    end if;

    if new.deliverable_id is not null and not exists (
      select 1 from public.deliverables
      where id = new.deliverable_id and user_id = new.user_id
    ) then
      raise exception 'deliverable does not belong to user' using errcode = '23503';
    end if;

    if new.project_id is not null
       and new.deliverable_id is not null
       and not exists (
         select 1 from public.deliverables
         where id = new.deliverable_id
           and project_id = new.project_id
           and user_id = new.user_id
       ) then
      raise exception 'deliverable does not belong to selected project' using errcode = '23503';
    end if;

  elsif tg_table_name = 'time_sessions' then
    if not exists (
      select 1 from public.actions
      where id = new.action_id and user_id = new.user_id
    ) then
      raise exception 'action does not belong to user' using errcode = '23503';
    end if;

  elsif tg_table_name = 'evidence' then
    if new.action_id is not null and not exists (
      select 1 from public.actions
      where id = new.action_id and user_id = new.user_id
    ) then
      raise exception 'action does not belong to user' using errcode = '23503';
    end if;

    if new.deliverable_id is not null and not exists (
      select 1 from public.deliverables
      where id = new.deliverable_id and user_id = new.user_id
    ) then
      raise exception 'deliverable does not belong to user' using errcode = '23503';
    end if;

    if new.project_id is not null and not exists (
      select 1 from public.projects
      where id = new.project_id and user_id = new.user_id
    ) then
      raise exception 'project does not belong to user' using errcode = '23503';
    end if;

  elsif tg_table_name = 'metrics' then
    if new.objective_id is not null and not exists (
      select 1 from public.objectives
      where id = new.objective_id and user_id = new.user_id
    ) then
      raise exception 'objective does not belong to user' using errcode = '23503';
    end if;

    if new.project_id is not null and not exists (
      select 1 from public.projects
      where id = new.project_id and user_id = new.user_id
    ) then
      raise exception 'project does not belong to user' using errcode = '23503';
    end if;

  elsif tg_table_name = 'blockers' then
    if new.project_id is not null and not exists (
      select 1 from public.projects
      where id = new.project_id and user_id = new.user_id
    ) then
      raise exception 'project does not belong to user' using errcode = '23503';
    end if;

    if new.deliverable_id is not null and not exists (
      select 1 from public.deliverables
      where id = new.deliverable_id and user_id = new.user_id
    ) then
      raise exception 'deliverable does not belong to user' using errcode = '23503';
    end if;

    if new.action_id is not null and not exists (
      select 1 from public.actions
      where id = new.action_id and user_id = new.user_id
    ) then
      raise exception 'action does not belong to user' using errcode = '23503';
    end if;

  elsif tg_table_name = 'ideas' then
    if new.project_id is not null and not exists (
      select 1 from public.projects
      where id = new.project_id and user_id = new.user_id
    ) then
      raise exception 'project does not belong to user' using errcode = '23503';
    end if;
  end if;

  return new;
end;
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'projects',
    'deliverables',
    'actions',
    'time_sessions',
    'evidence',
    'metrics',
    'blockers',
    'ideas'
  ]
  loop
    execute format('drop trigger if exists enforce_owned_relationships on public.%I', v_table);
    execute format(
      'create trigger enforce_owned_relationships before insert or update on public.%I for each row execute function public.enforce_owned_relationships()',
      v_table
    );
  end loop;
end
$$;

-- Ensure exactly one explicitly selected Next Best Action per user.
-- Normalise any pre-existing duplicates before adding the unique partial index.
with ranked_next_actions as (
  select
    id,
    row_number() over (
      partition by user_id
      order by updated_at desc, created_at desc, id
    ) as row_number
  from public.actions
  where is_next_action = true
)
update public.actions
set is_next_action = false
where id in (
  select id
  from ranked_next_actions
  where row_number > 1
);

drop index if exists public.idx_actions_user_next;

create unique index if not exists idx_actions_one_next_per_user
on public.actions(user_id)
where is_next_action = true;

-- Atomic helper for selecting the single Next Best Action.
create or replace function public.set_next_action(p_action_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.actions
    where id = p_action_id
      and user_id = v_user_id
      and status not in ('completed', 'cancelled')
  ) then
    raise exception 'action not found or unavailable' using errcode = '42501';
  end if;

  update public.actions
  set is_next_action = false
  where user_id = v_user_id
    and is_next_action = true
    and id <> p_action_id;

  update public.actions
  set is_next_action = true
  where id = p_action_id
    and user_id = v_user_id;
end;
$$;

revoke all on function public.set_next_action(uuid) from public;
grant execute on function public.set_next_action(uuid) to authenticated;

