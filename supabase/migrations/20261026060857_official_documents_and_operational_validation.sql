insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pcc-official-documents','pcc-official-documents',false,20971520,array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/zip','application/x-zip-compressed','text/plain','application/json']::text[])
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create table if not exists public.pcc_official_documents (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  deliverable_id uuid references public.deliverables(id) on delete set null,
  document_key text not null check (document_key in ('master_mind','commercial_guide','technical_package','release_diagnostic','other')),
  title text not null,
  format text not null check (format in ('docx','pdf','zip','txt','json','other')),
  version_label text not null,
  status text not null default 'draft' check (status in ('draft','current','superseded')),
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  file_size bigint check (file_size is null or file_size >= 0),
  sha256 text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_pcc_official_documents_owner on public.pcc_official_documents(user_id,document_key,status,created_at desc);
create index if not exists idx_pcc_official_documents_project on public.pcc_official_documents(project_id,status,created_at desc);
create index if not exists idx_pcc_official_documents_deliverable on public.pcc_official_documents(deliverable_id,status,created_at desc);
alter table public.pcc_official_documents enable row level security;
revoke all on table public.pcc_official_documents from anon;
grant select,insert,update,delete on table public.pcc_official_documents to authenticated;
create policy "Users can view own PCC official documents" on public.pcc_official_documents for select to authenticated using ((user_id=(select auth.uid())) or (select private.is_global_admin()));
create policy "Users can create own PCC official documents" on public.pcc_official_documents for insert to authenticated with check ((user_id=(select auth.uid())) or (select private.is_global_admin()));
create policy "Users can update own PCC official documents" on public.pcc_official_documents for update to authenticated using ((user_id=(select auth.uid())) or (select private.is_global_admin())) with check ((user_id=(select auth.uid())) or (select private.is_global_admin()));
create policy "Users can delete own PCC official documents" on public.pcc_official_documents for delete to authenticated using ((user_id=(select auth.uid())) or (select private.is_global_admin()));

create or replace function public.enforce_pcc_official_document_owner() returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if new.project_id is not null and not exists (select 1 from public.projects p where p.id=new.project_id and p.user_id=new.user_id) then raise exception 'Official document project must belong to the same user'; end if;
  if new.deliverable_id is not null and not exists (select 1 from public.deliverables d where d.id=new.deliverable_id and d.user_id=new.user_id and (new.project_id is null or d.project_id=new.project_id)) then raise exception 'Official document deliverable must belong to the same user and project'; end if;
  return new;
end; $$;
drop trigger if exists enforce_pcc_official_document_owner_trigger on public.pcc_official_documents;
create trigger enforce_pcc_official_document_owner_trigger before insert or update on public.pcc_official_documents for each row execute function public.enforce_pcc_official_document_owner();
drop trigger if exists update_pcc_official_documents_updated_at on public.pcc_official_documents;
create trigger update_pcc_official_documents_updated_at before update on public.pcc_official_documents for each row execute function public.update_updated_at_column();

drop policy if exists "Users can read own PCC official documents" on storage.objects;
create policy "Users can read own PCC official documents" on storage.objects for select to authenticated using (bucket_id='pcc-official-documents' and ((storage.foldername(name))[1]=(select auth.uid())::text or (select private.is_global_admin())));
drop policy if exists "Users can upload own PCC official documents" on storage.objects;
create policy "Users can upload own PCC official documents" on storage.objects for insert to authenticated with check (bucket_id='pcc-official-documents' and ((storage.foldername(name))[1]=(select auth.uid())::text or (select private.is_global_admin())));
drop policy if exists "Users can update own PCC official documents" on storage.objects;
create policy "Users can update own PCC official documents" on storage.objects for update to authenticated using (bucket_id='pcc-official-documents' and ((storage.foldername(name))[1]=(select auth.uid())::text or (select private.is_global_admin()))) with check (bucket_id='pcc-official-documents' and ((storage.foldername(name))[1]=(select auth.uid())::text or (select private.is_global_admin())));
drop policy if exists "Users can delete own PCC official documents" on storage.objects;
create policy "Users can delete own PCC official documents" on storage.objects for delete to authenticated using (bucket_id='pcc-official-documents' and ((storage.foldername(name))[1]=(select auth.uid())::text or (select private.is_global_admin())));

create table if not exists public.operational_validation_runs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  scope text not null check (scope in ('release','ai_provider','botia','offline_device','mobile_android','mobile_ios','downloads','database','security')),
  status text not null check (status in ('passed','failed','partial','not_tested')),
  release_sha text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_operational_validation_runs_owner on public.operational_validation_runs(user_id,scope,created_at desc);
alter table public.operational_validation_runs enable row level security;
revoke all on table public.operational_validation_runs from anon;
grant select,insert on table public.operational_validation_runs to authenticated;
create policy "Users can view own operational validation runs" on public.operational_validation_runs for select to authenticated using ((user_id=(select auth.uid())) or (select private.is_global_admin()));
create policy "Users can record own operational validation runs" on public.operational_validation_runs for insert to authenticated with check ((user_id=(select auth.uid())) or (select private.is_global_admin()));
comment on table public.pcc_official_documents is 'Versioned PCC official documents stored privately and linked to project deliverables for controlled desktop/mobile download.';
comment on table public.operational_validation_runs is 'Evidence ledger for operational end-to-end validations. A code test alone must not be recorded as passed operational validation.';
