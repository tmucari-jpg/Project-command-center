-- Append-only record of a manager's approval of externally shared diagnostic material.
create table public.pcc_external_share_approvals (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.client_diagnostic_requests(id) on delete restrict,
  factory_case_id uuid not null references public.project_factory_cases(id) on delete restrict,
  manager_user_id uuid not null references auth.users(id) on delete restrict,
  audience_name text not null,
  audience_organization text not null,
  public_context text not null,
  content_sha256 text not null check (content_sha256 ~ '^[a-f0-9]{64}$'),
  content_version text not null default 'pcc-client-diagnostic-executive-v3',
  reviewed_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint approval_scope_nonempty check (length(trim(audience_organization)) > 0 and length(trim(audience_name)) > 0)
);
create index pcc_external_share_approvals_manager on public.pcc_external_share_approvals(manager_user_id,reviewed_at desc);
alter table public.pcc_external_share_approvals enable row level security;
revoke all on public.pcc_external_share_approvals from anon;
grant select, insert on public.pcc_external_share_approvals to authenticated;
create policy pcc_external_approvals_read on public.pcc_external_share_approvals for select to authenticated using (
 manager_user_id=(select auth.uid()) or (select private.is_global_admin())
);
create policy pcc_external_approvals_insert on public.pcc_external_share_approvals for insert to authenticated with check (
 manager_user_id=(select auth.uid()) and exists (
  select 1 from public.client_diagnostic_requests r join public.project_factory_cases c on c.id=r.factory_case_id
  where r.id=request_id and r.factory_case_id=pcc_external_share_approvals.factory_case_id and
  r.user_id=manager_user_id and c.user_id=manager_user_id and
  r.expires_at=pcc_external_share_approvals.expires_at
 )
);
-- No UPDATE/DELETE policies or grants: approval history remains immutable.
