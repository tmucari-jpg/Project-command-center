create or replace function public.project_client_status_lookup(p_token_hash text)
returns table (
  link_id uuid,
  project_title text,
  project_status text,
  expected_result text,
  next_action text,
  public_note text,
  deliverables jsonb,
  kpis jsonb,
  published_at timestamptz,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_link_id uuid;
  v_project_id uuid;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    return;
  end if;

  select l.id, l.project_id
    into v_link_id, v_project_id
  from public.project_client_status_links l
  where l.token_hash = p_token_hash
    and l.status <> 'revoked'
  limit 1;

  if v_link_id is null then return; end if;
  if not private.consume_project_client_status_rate_limit(v_link_id, 'lookup', 60, 600) then return; end if;

  update public.project_client_status_links as l
  set status = 'expired', updated_at = now()
  where l.id = v_link_id and l.status in ('active','opened') and l.expires_at <= now();

  update public.project_client_status_links as l
  set status = 'opened', opened_at = coalesce(l.opened_at, now()), updated_at = now()
  where l.id = v_link_id and l.status = 'active' and l.expires_at > now();

  return query
  select
    l.id,
    p.title,
    s.project_status,
    s.expected_result,
    s.next_action,
    s.public_note,
    s.deliverables,
    s.kpis,
    s.published_at,
    l.expires_at
  from public.project_client_status_links l
  join public.projects p on p.id = l.project_id
  join lateral (
    select ss.*
    from public.project_client_status_snapshots ss
    where ss.project_id = l.project_id
    order by ss.version desc
    limit 1
  ) s on true
  where l.id = v_link_id
    and l.status <> 'revoked'
    and l.expires_at > now()
  limit 1;
end;
$$;
