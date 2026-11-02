-- PCC: bind published links to a fixed snapshot and publish atomically.
-- Additive migration; apply only during authorised release migration.
alter table public.project_client_status_links
  add column if not exists snapshot_id uuid references public.project_client_status_snapshots(id);

create index if not exists idx_project_client_status_links_snapshot
  on public.project_client_status_links(snapshot_id);

create or replace function public.publish_project_client_status_atomic(
 p_project_id uuid, p_owner_id uuid, p_public_note text, p_project_status text,
 p_expected_result text, p_next_action text, p_deliverables jsonb, p_kpis jsonb,
 p_token_hash text, p_expires_at timestamptz
) returns uuid
language plpgsql security invoker set search_path=public,pg_temp
as $$
declare v_project public.projects%rowtype; v_version integer; v_snapshot uuid; v_link uuid;
begin
 if auth.uid() is null or (p_owner_id <> auth.uid() and not (select private.is_global_admin())) then
   raise exception 'NOT_AUTHORIZED' using errcode='42501';
 end if;
 if p_token_hash !~ '^[0-9a-f]{64}$' or p_expires_at <= now() or
    length(coalesce(p_public_note,''))>2000 or jsonb_typeof(p_deliverables)<>'array'
    or jsonb_typeof(p_kpis)<>'array' then
   raise exception 'INVALID_SHARE' using errcode='22023';
 end if;
 -- Project row lock serialises version increments and link replacement.
 select * into v_project from public.projects
  where id=p_project_id and user_id=p_owner_id for update;
 if not found then raise exception 'PROJECT_NOT_FOUND' using errcode='42501'; end if;
 select coalesce(max(version),0)+1 into v_version from public.project_client_status_snapshots
  where project_id=p_project_id;
 insert into public.project_client_status_snapshots
  (user_id,project_id,version,public_note,project_status,expected_result,next_action,deliverables,kpis)
 values
  (p_owner_id,p_project_id,v_version,p_public_note,p_project_status,p_expected_result,
   p_next_action,p_deliverables,p_kpis)
 returning id into v_snapshot;
 -- A failure after this point rolls back ALL changes including revocation.
 update public.project_client_status_links set status='revoked'
 where project_id=p_project_id and user_id=p_owner_id and status in ('active','opened');
 insert into public.project_client_status_links
  (user_id,project_id,snapshot_id,token_hash,expires_at)
 values (p_owner_id,p_project_id,v_snapshot,p_token_hash,p_expires_at)
 returning id into v_link;
 return v_link;
end; $$;
revoke all on function public.publish_project_client_status_atomic(uuid,uuid,text,text,text,text,jsonb,jsonb,text,timestamptz) from public,anon;
grant execute on function public.publish_project_client_status_atomic(uuid,uuid,text,text,text,text,jsonb,jsonb,text,timestamptz) to authenticated;

-- Keep existing response columns and token/rate limiting; pin new links to their snapshot.
create or replace function public.project_client_status_lookup(p_token_hash text)
returns table (
 link_id uuid, project_title text, project_status text, expected_result text,
 next_action text, public_note text, deliverables jsonb, kpis jsonb,
 published_at timestamptz, expires_at timestamptz
)
language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_link_id uuid;
begin
 if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then return; end if;
 select l.id into v_link_id from public.project_client_status_links l
 where l.token_hash=p_token_hash and l.status in ('active','opened') limit 1;
 if v_link_id is null then return; end if;
 if not private.consume_project_client_status_rate_limit(v_link_id,'lookup',60,600) then return; end if;
 update public.project_client_status_links l set status='expired',updated_at=now()
 where l.id=v_link_id and l.status in ('active','opened') and l.expires_at<=now();
 update public.project_client_status_links l
 set status='opened',opened_at=coalesce(l.opened_at,now()),updated_at=now()
 where l.id=v_link_id and l.status='active' and l.expires_at>now();
 return query select l.id,p.title,s.project_status,s.expected_result,s.next_action,
 s.public_note,s.deliverables,s.kpis,s.published_at,l.expires_at
 from public.project_client_status_links l
 join public.projects p on p.id=l.project_id
 join public.project_client_status_snapshots s on s.id=coalesce(
  l.snapshot_id,
  (select ss.id from public.project_client_status_snapshots ss
   where ss.project_id=l.project_id order by ss.version desc limit 1))
 where l.id=v_link_id and l.status='opened' and l.expires_at>now()
 limit 1;
end; $$;
revoke all on function public.project_client_status_lookup(text) from public;
grant execute on function public.project_client_status_lookup(text) to anon;
