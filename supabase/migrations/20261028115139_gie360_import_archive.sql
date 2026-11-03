-- Private originals, normalized versions and append-only human review history.
create table public.gie360_import_batches (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.gie360_organizations(id),
 created_by uuid not null references auth.users(id),
 source_name text not null check(length(source_name) between 1 and 255 and lower(source_name) ~ '\.(csv|xlsx)$'),
 source_path text not null unique,
 original_sha256 text not null check(original_sha256 ~ '^[0-9a-f]{64}$'),
 snapshot jsonb not null check(coalesce(jsonb_typeof(snapshot)='object' and jsonb_typeof(snapshot->'records')='array' and jsonb_typeof(snapshot->'alerts')='array' and snapshot->>'originalSha256'=original_sha256 and pg_column_size(snapshot)<10485760,false)),
 overlap_batch_ids uuid[] not null default '{}' check(cardinality(overlap_batch_ids)<=100),
 overlap_batch_count integer not null default 0 check(overlap_batch_count>=cardinality(overlap_batch_ids)),
 unique(organization_id,original_sha256),
 state text not null default 'received' check(state in ('received','in_review','approved','rejected')),
 created_at timestamptz not null default now(), reviewed_by uuid references auth.users(id), reviewed_at timestamptz, review_reason text, reconciliation jsonb,
 check(source_path=organization_id::text || '/' || id::text || '/original.' || case when lower(source_name) like '%.xlsx' then 'xlsx' else 'csv' end)
);
create index gie360_import_batches_org_idx on public.gie360_import_batches(organization_id,created_at desc);
alter table public.gie360_import_batches enable row level security;
revoke all on public.gie360_import_batches from anon,authenticated;
grant select on public.gie360_import_batches to authenticated;
grant select,insert,update on public.gie360_import_batches to service_role;
create policy gie360_import_read on public.gie360_import_batches for select to authenticated using(private.gie360_can_access(organization_id));
create table public.gie360_import_review_events (
 id uuid primary key default gen_random_uuid(), batch_id uuid not null references public.gie360_import_batches(id),
 organization_id uuid not null references public.gie360_organizations(id), actor_id uuid not null references auth.users(id),
 target_state text not null check(target_state in('in_review','approved','rejected')),
 reason text not null check(length(trim(reason)) between 3 and 2000), created_at timestamptz not null default now()
);
create index gie360_import_review_events_batch_idx on public.gie360_import_review_events(batch_id,created_at);
alter table public.gie360_import_review_events enable row level security;
revoke all on public.gie360_import_review_events from anon,authenticated;
grant select on public.gie360_import_review_events to authenticated;
grant select,insert on public.gie360_import_review_events to service_role;
create policy gie360_import_events_read on public.gie360_import_review_events for select to authenticated using(private.gie360_can_access(organization_id));
create or replace function public.review_gie360_import(p_import_id uuid,p_target text,p_reason text,p_actor_id uuid,p_reconciliation jsonb default null)
returns public.gie360_import_batches language plpgsql security invoker set search_path='' as $function$
declare v_batch public.gie360_import_batches;
begin
 select * into v_batch from public.gie360_import_batches where id=p_import_id for update;
 if not found or p_actor_id is null or not exists(select 1 from public.gie360_organizations o where o.id=v_batch.organization_id and o.manager_user_id=p_actor_id) then raise exception 'GIE360_IMPORT_REVIEW_FORBIDDEN'; end if;
 if p_target not in('in_review','approved','rejected') or p_reason is null or length(trim(p_reason)) not between 3 and 2000 then raise exception 'GIE360_IMPORT_REVIEW_INVALID'; end if;
 if v_batch.state in('approved','rejected') then raise exception 'GIE360_IMPORT_IMMUTABLE_VERSION'; end if;
 if v_batch.state='received' and p_target not in('in_review','rejected') then raise exception 'GIE360_IMPORT_REVIEW_REQUIRED'; end if;
 if v_batch.state='in_review' and p_target not in('approved','rejected') then raise exception 'GIE360_IMPORT_TRANSITION_INVALID'; end if;
 if p_target='approved' and (coalesce(jsonb_array_length(v_batch.snapshot->'records'),0)=0 or exists(select 1 from jsonb_array_elements(v_batch.snapshot->'alerts') a where a->>'severity'='error')) then raise exception 'GIE360_IMPORT_BLOCKING_ALERTS'; end if;
 if p_target='approved' and (coalesce(p_reconciliation->>'status','') <> 'matched' or coalesce(jsonb_array_length(p_reconciliation->'comparedFields'),0)=0 or p_reconciliation->'reference'->>'periodFrom' is distinct from v_batch.snapshot->'coverage'->>'periodFrom' or p_reconciliation->'reference'->>'periodTo' is distinct from v_batch.snapshot->'coverage'->>'periodTo') then raise exception 'GIE360_IMPORT_RECONCILIATION_REQUIRED'; end if;
 update public.gie360_import_batches set state=p_target,reviewed_by=p_actor_id,reviewed_at=now(),review_reason=trim(p_reason),reconciliation=p_reconciliation where id=p_import_id returning * into v_batch;
 insert into public.gie360_import_review_events(batch_id,organization_id,actor_id,target_state,reason) values(v_batch.id,v_batch.organization_id,p_actor_id,p_target,trim(p_reason));
 return v_batch;
end;
$function$;
revoke all on function public.review_gie360_import(uuid,text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.review_gie360_import(uuid,text,text,uuid,jsonb) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('gie360-import-originals','gie360-import-originals',false,3145728,array['text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']) on conflict(id) do nothing;
create policy gie360_original_read on storage.objects for select to authenticated using(bucket_id='gie360-import-originals' and exists(select 1 from public.gie360_organizations o where o.id::text=(storage.foldername(name))[1] and private.gie360_can_access(o.id)));
-- No UPDATE/DELETE privileges: uploads and normalized versions cannot be overwritten.
