-- Secure client project status portal.
-- Public links expose only an explicitly published snapshot, never internal project tables.

create table if not exists public.project_client_status_snapshots (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  version integer not null default 1,
  public_note text,
  project_status text not null,
  expected_result text,
  next_action text,
  deliverables jsonb not null default '[]'::jsonb,
  kpis jsonb not null default '[]'::jsonb,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(project_id, version)
);

create index if not exists idx_project_client_status_snapshots_project
  on public.project_client_status_snapshots(user_id, project_id, version desc);

create table if not exists public.project_client_status_links (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  token_hash text not null unique,
  status text not null default 'active'
    check (status in ('active','opened','revoked','expired')),
  expires_at timestamptz not null,
  opened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_project_client_status_links_owner
  on public.project_client_status_links(user_id, project_id, created_at desc);

create table if not exists public.project_client_status_decisions (
  id uuid primary key default uuid_generate_v4(),
  link_id uuid not null references public.project_client_status_links(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  decision text not null check (decision in ('approve','change','clarification')),
  respondent_name text not null,
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists idx_project_client_status_decisions_project
  on public.project_client_status_decisions(project_id, created_at desc);

alter table public.project_client_status_snapshots enable row level security;
alter table public.project_client_status_links enable row level security;
alter table public.project_client_status_decisions enable row level security;

revoke all on table public.project_client_status_snapshots from anon;
revoke all on table public.project_client_status_links from anon;
revoke all on table public.project_client_status_decisions from anon;

grant select, insert on table public.project_client_status_snapshots to authenticated;
grant select, insert, update on table public.project_client_status_links to authenticated;
grant select on table public.project_client_status_decisions to authenticated;

create policy "Users can view own project client snapshots"
on public.project_client_status_snapshots for select to authenticated
using ((user_id = (select auth.uid())) or (select private.is_global_admin()));

create policy "Users can publish own project client snapshots"
on public.project_client_status_snapshots for insert to authenticated
with check ((user_id = (select auth.uid())) or (select private.is_global_admin()));

create policy "Users can view own project client links"
on public.project_client_status_links for select to authenticated
using ((user_id = (select auth.uid())) or (select private.is_global_admin()));

create policy "Users can create own project client links"
on public.project_client_status_links for insert to authenticated
with check ((user_id = (select auth.uid())) or (select private.is_global_admin()));

create policy "Users can update own project client links"
on public.project_client_status_links for update to authenticated
using ((user_id = (select auth.uid())) or (select private.is_global_admin()))
with check ((user_id = (select auth.uid())) or (select private.is_global_admin()));

create policy "Users can view client decisions for own projects"
on public.project_client_status_decisions for select to authenticated
using (
  exists (
    select 1 from public.projects p
    where p.id = project_id
      and (p.user_id = (select auth.uid()) or (select private.is_global_admin()))
  )
);

create table if not exists private.project_client_status_rate_limits (
  link_id uuid not null references public.project_client_status_links(id) on delete cascade,
  action text not null check (action in ('lookup','submit')),
  window_started_at timestamptz not null,
  attempts integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (link_id, action)
);

create or replace function private.consume_project_client_status_rate_limit(
  p_link_id uuid,
  p_action text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_attempts integer;
begin
  if p_link_id is null or p_action not in ('lookup','submit') or p_limit < 1 or p_window_seconds < 1 then
    return false;
  end if;

  insert into private.project_client_status_rate_limits(link_id, action, window_started_at, attempts, updated_at)
  values (p_link_id, p_action, v_now, 1, v_now)
  on conflict (link_id, action)
  do update set
    window_started_at = case
      when private.project_client_status_rate_limits.window_started_at <= v_now - make_interval(secs => p_window_seconds)
        then v_now
      else private.project_client_status_rate_limits.window_started_at
    end,
    attempts = case
      when private.project_client_status_rate_limits.window_started_at <= v_now - make_interval(secs => p_window_seconds)
        then 1
      else private.project_client_status_rate_limits.attempts + 1
    end,
    updated_at = v_now
  returning attempts into v_attempts;

  return v_attempts <= p_limit;
end;
$$;

revoke all on function private.consume_project_client_status_rate_limit(uuid,text,integer,integer) from public;

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

  update public.project_client_status_links
  set status = 'expired', updated_at = now()
  where id = v_link_id and status in ('active','opened') and expires_at <= now();

  update public.project_client_status_links
  set status = 'opened', opened_at = coalesce(opened_at, now()), updated_at = now()
  where id = v_link_id and status = 'active' and expires_at > now();

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
  limit 1;
end;
$$;

create or replace function public.project_client_status_submit(
  p_token_hash text,
  p_decision text,
  p_respondent_name text,
  p_comment text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_link_id uuid;
  v_project_id uuid;
  v_user_id uuid;
  v_project_title text;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then return false; end if;
  if p_decision not in ('approve','change','clarification') then return false; end if;
  if length(trim(coalesce(p_respondent_name,''))) < 2 then return false; end if;
  if length(coalesce(p_comment,'')) > 4000 then return false; end if;

  select l.id, l.project_id, l.user_id, p.title
    into v_link_id, v_project_id, v_user_id, v_project_title
  from public.project_client_status_links l
  join public.projects p on p.id = l.project_id
  where l.token_hash = p_token_hash
    and l.status in ('active','opened')
    and l.expires_at > now()
  for update of l;

  if v_link_id is null then return false; end if;
  if not private.consume_project_client_status_rate_limit(v_link_id, 'submit', 8, 900) then return false; end if;

  insert into public.project_client_status_decisions(link_id, project_id, decision, respondent_name, comment)
  values (v_link_id, v_project_id, p_decision, left(trim(p_respondent_name),200), nullif(left(trim(coalesce(p_comment,'')),4000),''));

  insert into public.notifications(user_id,type,title,message,priority,related_entity_type,related_entity_id)
  values (
    v_user_id,
    'client_project_status_decision',
    'Nova decisão do cliente',
    left(trim(p_respondent_name),200) || ' respondeu ao acompanhamento de "' || left(v_project_title,220) || '".',
    'high',
    'project',
    v_project_id
  );

  return true;
end;
$$;

revoke all on function public.project_client_status_lookup(text) from public;
revoke all on function public.project_client_status_submit(text,text,text,text) from public;
grant execute on function public.project_client_status_lookup(text) to anon;
grant execute on function public.project_client_status_submit(text,text,text,text) to anon;

drop trigger if exists update_project_client_status_links_updated_at on public.project_client_status_links;
create trigger update_project_client_status_links_updated_at
before update on public.project_client_status_links
for each row execute function public.update_updated_at_column();

comment on table public.project_client_status_snapshots is
  'Explicitly published client-facing project snapshots. Internal project data is never exposed directly.';
comment on table public.project_client_status_links is
  'Secure bearer links for client project status and next-actions access.';
comment on table public.project_client_status_decisions is
  'Client validation, change requests or clarification requests submitted from the project status portal.';
