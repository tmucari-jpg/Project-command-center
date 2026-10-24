-- Client diagnostic questionnaire: external bearer-link intake without PCC account access.

create table if not exists public.client_diagnostic_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  factory_case_id uuid not null references public.project_factory_cases(id) on delete cascade,
  token_hash text not null unique,
  questionnaire_version text not null default 'basic-v1',
  client_name text,
  client_organization text,
  public_context text,
  status text not null default 'active'
    check (status in ('active','opened','submitted','clarification_needed','reviewed','incorporated','revoked','expired')),
  expires_at timestamptz not null,
  opened_at timestamptz,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  incorporated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_client_diagnostic_requests_owner
  on public.client_diagnostic_requests(user_id, factory_case_id, created_at desc);
create index if not exists idx_client_diagnostic_requests_case_status
  on public.client_diagnostic_requests(factory_case_id, status, created_at desc);

create table if not exists public.client_diagnostic_responses (
  id uuid primary key default uuid_generate_v4(),
  request_id uuid not null unique references public.client_diagnostic_requests(id) on delete cascade,
  respondent_name text not null,
  respondent_role text,
  respondent_email text,
  answers jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_client_diagnostic_responses_request
  on public.client_diagnostic_responses(request_id);

create table if not exists public.client_diagnostic_reviews (
  id uuid primary key default uuid_generate_v4(),
  request_id uuid not null unique references public.client_diagnostic_requests(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  review_status text not null
    check (review_status in ('accepted','partially_accepted','clarification_needed')),
  review_notes text,
  missing_information text,
  points_to_confirm text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_client_diagnostic_reviews_owner
  on public.client_diagnostic_reviews(user_id, request_id);

alter table public.client_diagnostic_requests enable row level security;
alter table public.client_diagnostic_responses enable row level security;
alter table public.client_diagnostic_reviews enable row level security;

revoke all on table public.client_diagnostic_requests from anon;
revoke all on table public.client_diagnostic_responses from anon;
revoke all on table public.client_diagnostic_reviews from anon;

grant select, insert, update on table public.client_diagnostic_requests to authenticated;
grant select on table public.client_diagnostic_responses to authenticated;
grant select, insert, update on table public.client_diagnostic_reviews to authenticated;

create policy "Users can view own client diagnostic requests"
on public.client_diagnostic_requests for select to authenticated
using ((user_id = (select auth.uid())) or (select private.is_global_admin()));

create policy "Users can create own client diagnostic requests"
on public.client_diagnostic_requests for insert to authenticated
with check ((user_id = (select auth.uid())) or (select private.is_global_admin()));

create policy "Users can update own client diagnostic requests"
on public.client_diagnostic_requests for update to authenticated
using ((user_id = (select auth.uid())) or (select private.is_global_admin()))
with check ((user_id = (select auth.uid())) or (select private.is_global_admin()));

create policy "Users can view responses for own client diagnostic requests"
on public.client_diagnostic_responses for select to authenticated
using (
  exists (
    select 1
    from public.client_diagnostic_requests r
    where r.id = request_id
      and (r.user_id = (select auth.uid()) or (select private.is_global_admin()))
  )
);

create policy "Users can view own client diagnostic reviews"
on public.client_diagnostic_reviews for select to authenticated
using ((user_id = (select auth.uid())) or (select private.is_global_admin()));

create policy "Users can create own client diagnostic reviews"
on public.client_diagnostic_reviews for insert to authenticated
with check (
  ((user_id = (select auth.uid())) or (select private.is_global_admin()))
  and exists (
    select 1
    from public.client_diagnostic_requests r
    where r.id = request_id and r.user_id = user_id
  )
);

create policy "Users can update own client diagnostic reviews"
on public.client_diagnostic_reviews for update to authenticated
using ((user_id = (select auth.uid())) or (select private.is_global_admin()))
with check (
  ((user_id = (select auth.uid())) or (select private.is_global_admin()))
  and exists (
    select 1
    from public.client_diagnostic_requests r
    where r.id = request_id and r.user_id = user_id
  )
);

create or replace function public.client_diagnostic_lookup(p_token_hash text)
returns table (
  request_id uuid,
  client_name text,
  client_organization text,
  public_context text,
  questionnaire_version text,
  status text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    return;
  end if;

  update public.client_diagnostic_requests as r
  set status = 'expired', updated_at = now()
  where r.token_hash = p_token_hash
    and r.status in ('active','opened')
    and r.expires_at <= now();

  update public.client_diagnostic_requests as r
  set status = 'opened',
      opened_at = coalesce(r.opened_at, now()),
      updated_at = now()
  where r.token_hash = p_token_hash
    and r.status = 'active'
    and r.expires_at > now();

  return query
  select
    r.id,
    r.client_name,
    r.client_organization,
    r.public_context,
    r.questionnaire_version,
    r.status,
    r.expires_at
  from public.client_diagnostic_requests r
  where r.token_hash = p_token_hash
    and r.status <> 'revoked'
  limit 1;
end;
$$;

create or replace function public.client_diagnostic_submit(
  p_token_hash text,
  p_respondent_name text,
  p_respondent_role text,
  p_respondent_email text,
  p_answers jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request_id uuid;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    return false;
  end if;

  if length(trim(coalesce(p_respondent_name, ''))) < 2 then
    return false;
  end if;

  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    return false;
  end if;

  select id into v_request_id
  from public.client_diagnostic_requests
  where token_hash = p_token_hash
    and status in ('active','opened')
    and expires_at > now()
  for update;

  if v_request_id is null then
    return false;
  end if;

  insert into public.client_diagnostic_responses (
    request_id,
    respondent_name,
    respondent_role,
    respondent_email,
    answers
  )
  values (
    v_request_id,
    left(trim(p_respondent_name), 200),
    nullif(left(trim(coalesce(p_respondent_role, '')), 200), ''),
    nullif(left(trim(coalesce(p_respondent_email, '')), 320), ''),
    p_answers
  );

  update public.client_diagnostic_requests
  set status = 'submitted',
      submitted_at = now(),
      updated_at = now()
  where id = v_request_id;

  return true;
exception
  when unique_violation then
    return false;
end;
$$;

revoke all on function public.client_diagnostic_lookup(text) from public;
revoke all on function public.client_diagnostic_submit(text,text,text,text,jsonb) from public;
grant execute on function public.client_diagnostic_lookup(text) to anon;
grant execute on function public.client_diagnostic_submit(text,text,text,text,jsonb) to anon;

drop trigger if exists update_client_diagnostic_requests_updated_at on public.client_diagnostic_requests;
create trigger update_client_diagnostic_requests_updated_at
before update on public.client_diagnostic_requests
for each row execute function public.update_updated_at_column();

drop trigger if exists update_client_diagnostic_reviews_updated_at on public.client_diagnostic_reviews;
create trigger update_client_diagnostic_reviews_updated_at
before update on public.client_diagnostic_reviews
for each row execute function public.update_updated_at_column();

comment on table public.client_diagnostic_requests is
  'Bearer-link questionnaire requests for collecting client-declared information without granting PCC access.';
comment on table public.client_diagnostic_responses is
  'Immutable original client-declared answers received through a diagnostic questionnaire.';
comment on table public.client_diagnostic_reviews is
  'Internal review of client-declared answers before incorporation into a PCC diagnostic.';
