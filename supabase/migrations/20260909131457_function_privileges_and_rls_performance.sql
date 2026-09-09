-- Lock trigger functions to trigger execution only and harden search paths.
alter function public.update_updated_at_column() set search_path = '';
alter function public.calculate_time_session_duration() set search_path = '';
alter function public.sync_action_completion_timestamp() set search_path = '';
alter function public.handle_new_user() set search_path = '';
alter function public.audit_user_owned_change() set search_path = '';
alter function public.enforce_owned_relationships() set search_path = '';
alter function public.refresh_action_actual_minutes() set search_path = '';
alter function public.check_brave_search_rate_limit() set search_path = '';
alter function public.set_next_action(uuid) set search_path = '';

revoke all on function public.update_updated_at_column() from public, anon, authenticated;
revoke all on function public.calculate_time_session_duration() from public, anon, authenticated;
revoke all on function public.sync_action_completion_timestamp() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.audit_user_owned_change() from public, anon, authenticated;
revoke all on function public.enforce_owned_relationships() from public, anon, authenticated;
revoke all on function public.refresh_action_actual_minutes() from public, anon, authenticated;
revoke all on function public.check_brave_search_rate_limit() from public, anon, authenticated;
revoke all on function public.set_next_action(uuid) from public, anon, authenticated;

grant execute on function public.check_brave_search_rate_limit() to authenticated;
grant execute on function public.set_next_action(uuid) to authenticated;

-- Avoid per-row auth.uid() re-evaluation while preserving every policy's semantics.
do $$
declare
  p record;
  v_using text;
  v_check text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') like '%auth.uid()%'
        or coalesce(with_check, '') like '%auth.uid()%')
  loop
    v_using := case
      when p.qual is null then null
      else replace(p.qual, 'auth.uid()', '(SELECT auth.uid())')
    end;
    v_check := case
      when p.with_check is null then null
      else replace(p.with_check, 'auth.uid()', '(SELECT auth.uid())')
    end;

    execute format(
      'alter policy %I on %I.%I%s%s',
      p.policyname,
      p.schemaname,
      p.tablename,
      case when v_using is null then '' else format(' using (%s)', v_using) end,
      case when v_check is null then '' else format(' with check (%s)', v_check) end
    );
  end loop;
end;
$$;

