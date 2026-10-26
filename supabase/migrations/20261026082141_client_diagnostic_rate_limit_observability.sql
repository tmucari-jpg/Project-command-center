create or replace function public.client_diagnostic_rate_limit_summary()
returns table (
  action text,
  tracked_links bigint,
  attempts bigint,
  blocked_estimate bigint,
  last_activity timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select
    l.action,
    count(*)::bigint as tracked_links,
    coalesce(sum(l.attempts), 0)::bigint as attempts,
    coalesce(sum(
      greatest(
        l.attempts - case when l.action = 'lookup' then 60 else 8 end,
        0
      )
    ), 0)::bigint as blocked_estimate,
    max(l.updated_at) as last_activity
  from private.client_diagnostic_rate_limits l
  join public.client_diagnostic_requests r on r.id = l.request_id
  where r.user_id = (select auth.uid())
     or (select private.is_global_admin())
  group by l.action
  order by l.action;
$$;

revoke all on function public.client_diagnostic_rate_limit_summary() from public, anon;
grant execute on function public.client_diagnostic_rate_limit_summary() to authenticated;
