-- Fix agentic ownership trigger when it is attached to agent_runs.
-- The previous function referenced NEW.agent_run_id inside a compound IF,
-- which fails on agent_runs because that table has no agent_run_id column.

create or replace function public.enforce_agentic_owned_relationships()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.project_id is not null and not exists (
    select 1
    from public.projects
    where id = new.project_id
      and user_id = new.user_id
  ) then
    raise exception 'project does not belong to user' using errcode = '23503';
  end if;

  if tg_table_name in ('approval_requests','execution_steps') then
    if not exists (
      select 1
      from public.agent_runs
      where id = new.agent_run_id
        and user_id = new.user_id
    ) then
      raise exception 'agent run does not belong to user' using errcode = '23503';
    end if;
  end if;

  return new;
end;
$function$;
