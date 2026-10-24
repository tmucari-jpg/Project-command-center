-- External client-diagnostic sources: immutable references to completed questionnaires received outside PCC.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-diagnostic-imports',
  'client-diagnostic-imports',
  false,
  10485760,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/png',
    'image/jpeg'
  ]::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.client_diagnostic_external_sources (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  factory_case_id uuid not null references public.project_factory_cases(id) on delete cascade,
  request_id uuid references public.client_diagnostic_requests(id) on delete set null,
  source_type text not null check (source_type in ('file','link')),
  source_url text,
  storage_path text,
  file_name text,
  mime_type text,
  file_size bigint,
  note text,
  created_at timestamptz not null default now(),
  check (
    (source_type = 'link' and source_url is not null and storage_path is null)
    or
    (source_type = 'file' and storage_path is not null and file_name is not null)
  )
);

create index if not exists idx_client_diagnostic_external_sources_owner
  on public.client_diagnostic_external_sources(user_id, factory_case_id, created_at desc);

create index if not exists idx_client_diagnostic_external_sources_request
  on public.client_diagnostic_external_sources(request_id, created_at desc);

alter table public.client_diagnostic_external_sources enable row level security;

revoke all on table public.client_diagnostic_external_sources from anon;
grant select, insert on table public.client_diagnostic_external_sources to authenticated;

create policy "Users can view own client diagnostic external sources"
on public.client_diagnostic_external_sources for select to authenticated
using ((user_id = (select auth.uid())) or (select private.is_global_admin()));

create policy "Users can add own client diagnostic external sources"
on public.client_diagnostic_external_sources for insert to authenticated
with check (
  (
    (client_diagnostic_external_sources.user_id = (select auth.uid()))
    or (select private.is_global_admin())
  )
  and exists (
    select 1
    from public.project_factory_cases f
    where f.id = client_diagnostic_external_sources.factory_case_id
      and f.user_id = client_diagnostic_external_sources.user_id
  )
  and (
    client_diagnostic_external_sources.request_id is null
    or exists (
      select 1
      from public.client_diagnostic_requests r
      where r.id = client_diagnostic_external_sources.request_id
        and r.factory_case_id = client_diagnostic_external_sources.factory_case_id
        and r.user_id = client_diagnostic_external_sources.user_id
    )
  )
);

drop policy if exists "Users can read own client diagnostic imports" on storage.objects;
create policy "Users can read own client diagnostic imports"
on storage.objects for select to authenticated
using (
  bucket_id = 'client-diagnostic-imports'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can upload own client diagnostic imports" on storage.objects;
create policy "Users can upload own client diagnostic imports"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'client-diagnostic-imports'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can delete own client diagnostic imports" on storage.objects;
create policy "Users can delete own client diagnostic imports"
on storage.objects for delete to authenticated
using (
  bucket_id = 'client-diagnostic-imports'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

comment on table public.client_diagnostic_external_sources is
  'Completed diagnostic questionnaires received outside the PCC, stored as private file uploads or external links and linked to the relevant factory case.';
