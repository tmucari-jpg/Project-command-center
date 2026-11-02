-- Additive archive only. Apply to isolated staging first; never rewrites historical data.
create table public.generated_deliverable_artifacts (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete restrict,
  deliverable_id uuid not null references public.deliverables(id) on delete restrict,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  document_kind text not null,
  files jsonb not null check (jsonb_typeof(files) = 'object'),
  source_snapshot jsonb not null,
  generator_version text not null default 'pcc-2026-10-v1',
  created_at timestamptz not null default now()
);
create index generated_deliverable_artifacts_owner on public.generated_deliverable_artifacts(user_id);
create index generated_deliverable_artifacts_deliverable on public.generated_deliverable_artifacts(deliverable_id);
create index generated_deliverable_artifacts_actor on public.generated_deliverable_artifacts(actor_id);
alter table public.generated_deliverable_artifacts enable row level security;
grant select, insert on public.generated_deliverable_artifacts to authenticated;
revoke all on public.generated_deliverable_artifacts from anon;
create policy generated_artifacts_read on public.generated_deliverable_artifacts for select to authenticated
 using (user_id = (select auth.uid()) or (select private.is_global_admin()));
create policy generated_artifacts_insert on public.generated_deliverable_artifacts for insert to authenticated
 with check (actor_id = (select auth.uid()) and (user_id = (select auth.uid()) or (select private.is_global_admin()))
 and exists(select 1 from public.deliverables d where d.id=deliverable_id and d.user_id=generated_deliverable_artifacts.user_id and d.status <> 'completed' and d.locked_at is null));
-- Append-only archive: no UPDATE/DELETE privileges or policies, including for admins.
insert into storage.buckets(id,name,public,file_size_limit)
 values ('pcc-deliverable-artifacts','pcc-deliverable-artifacts',false,20971520)
 on conflict (id) do nothing;
create policy generated_files_read on storage.objects for select to authenticated
 using (bucket_id='pcc-deliverable-artifacts' and exists (
   select 1 from public.deliverables d
   where d.id::text=(storage.foldername(name))[2] and d.user_id::text=(storage.foldername(name))[1]
   and (d.user_id=(select auth.uid()) or (select private.is_global_admin()))));
create policy generated_files_insert on storage.objects for insert to authenticated
 with check (bucket_id='pcc-deliverable-artifacts' and exists (
   select 1 from public.deliverables d
   where d.id::text=(storage.foldername(name))[2] and d.user_id::text=(storage.foldername(name))[1]
   and d.status <> 'completed' and d.locked_at is null
   and (d.user_id=(select auth.uid()) or (select private.is_global_admin()))));

create or replace function public.finalize_generated_deliverable(p_id uuid, p_deliverable_id uuid, p_kind text, p_files jsonb, p_snapshot jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare d public.deliverables%rowtype; f jsonb; prefix text; link text;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into d from public.deliverables where id=p_deliverable_id for update;
 if not found or not (d.user_id=auth.uid() or private.is_global_admin()) then raise exception 'Deliverable inaccessible'; end if;
 if d.status='completed' or d.locked_at is not null then raise exception 'Final deliverable immutable'; end if;
 -- Same operation may be retried, but it must never overwrite another artifact.
 if exists(select 1 from public.generated_deliverable_artifacts where id=p_id and deliverable_id=d.id) then return p_id; end if;
 if p_kind not in ('master_mind','master_plan','commercial_guide','diagnosis','decision','progress','closure','document','spreadsheet','presentation') then raise exception 'Unsupported document kind'; end if;
 if jsonb_typeof(p_files) <> 'object' or p_files='{}'::jsonb then raise exception 'Files required'; end if;
 prefix := d.user_id::text || '/' || d.id::text || '/' || p_id::text || '/';
 for f in select value from jsonb_each(p_files) loop
   if left(f->>'path',length(prefix)) <> prefix or f->>'path' like '%..%' or coalesce(f->>'sha256','') !~ '^[a-f0-9]{64}$'
     or not exists(select 1 from storage.objects o where o.bucket_id='pcc-deliverable-artifacts' and o.name=f->>'path') then
     raise exception 'Invalid or missing archived file';
   end if;
 end loop;
 insert into public.generated_deliverable_artifacts(id,user_id,deliverable_id,actor_id,document_kind,files,source_snapshot)
 values(p_id,d.user_id,d.id,auth.uid(),p_kind,p_files,p_snapshot);
 link := '/api/deliverables/artifacts/' || p_id::text || '/download';
 insert into public.evidence(user_id,project_id,deliverable_id,evidence_type,title,description,url)
 values(d.user_id,d.project_id,d.id,'document',d.title || ' - rascunho gerado',
 'Artefacto real arquivado. Geração não equivale a QA nem aceitação. Versão: ' || p_id::text,link);
 update public.deliverables set artifact_url=link, artifact_reference='generated:' || p_id::text,
   qa_status='pending',acceptance_status='pending',accepted_at=null where id=d.id;
 return p_id;
end; $$;
revoke all on function public.finalize_generated_deliverable(uuid,uuid,text,jsonb,jsonb) from public, anon;
grant execute on function public.finalize_generated_deliverable(uuid,uuid,text,jsonb,jsonb) to authenticated;
