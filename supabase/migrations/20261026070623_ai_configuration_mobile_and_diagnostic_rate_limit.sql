-- AI configuration validity, mobile release formats and diagnostic rate limiting.
alter table public.ai_provider_profiles
  add column if not exists configuration_status text not null default 'unverified',
  add column if not exists availability_reason text not null default 'unknown';

alter table public.ai_provider_profiles drop constraint if exists ai_provider_profiles_configuration_status_check;
alter table public.ai_provider_profiles add constraint ai_provider_profiles_configuration_status_check
  check (configuration_status in ('unverified','valid','invalid'));
alter table public.ai_provider_profiles drop constraint if exists ai_provider_profiles_availability_reason_check;
alter table public.ai_provider_profiles add constraint ai_provider_profiles_availability_reason_check
  check (availability_reason in ('healthy','quota','rate_limit','auth','model','endpoint','network','provider','unknown'));

update public.ai_provider_profiles
set configuration_status='valid', availability_reason='quota'
where lower(coalesce(last_health_message,'')) ~ '(quota|credits remaining|insufficient_quota|add funds|billing)'
  and last_health_status in ('degraded','offline');
update public.ai_provider_profiles
set configuration_status='valid', availability_reason='healthy'
where last_health_status='healthy';

alter table public.pcc_official_documents drop constraint if exists pcc_official_documents_document_key_check;
alter table public.pcc_official_documents add constraint pcc_official_documents_document_key_check
  check (document_key in ('master_mind','commercial_guide','technical_package','release_diagnostic','android_apk','android_aab','other'));
alter table public.pcc_official_documents drop constraint if exists pcc_official_documents_format_check;
alter table public.pcc_official_documents add constraint pcc_official_documents_format_check
  check (format in ('docx','pdf','zip','txt','json','apk','aab','other'));

update storage.buckets set allowed_mime_types=array[
  'application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip','application/x-zip-compressed','text/plain','application/json',
  'application/vnd.android.package-archive','application/octet-stream'
]::text[] where id='pcc-official-documents';

create table if not exists private.client_diagnostic_rate_limits (
  request_id uuid not null references public.client_diagnostic_requests(id) on delete cascade,
  action text not null check (action in ('lookup','submit')),
  window_started_at timestamptz not null default now(),
  attempts integer not null default 0 check (attempts >= 0),
  updated_at timestamptz not null default now(),
  primary key (request_id,action)
);
revoke all on table private.client_diagnostic_rate_limits from public,anon,authenticated;

CREATE OR REPLACE FUNCTION private.consume_client_diagnostic_rate_limit(p_request_id uuid, p_action text, p_limit integer, p_window_seconds integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_attempts integer;
begin
  if p_request_id is null
     or p_action not in ('lookup','submit')
     or p_limit < 1
     or p_window_seconds < 1
  then
    return false;
  end if;

  insert into private.client_diagnostic_rate_limits as limits (
    request_id, action, window_started_at, attempts, updated_at
  )
  values (
    p_request_id, p_action, now(), 1, now()
  )
  on conflict (request_id, action) do update
  set
    attempts = case
      when limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
        then 1
      else limits.attempts + 1
    end,
    window_started_at = case
      when limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
        then now()
      else limits.window_started_at
    end,
    updated_at = now()
  returning attempts into v_attempts;

  return v_attempts <= p_limit;
end;
$function$;
revoke all on function private.consume_client_diagnostic_rate_limit(uuid,text,integer,integer) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION public.client_diagnostic_lookup(p_token_hash text)
 RETURNS TABLE(request_id uuid, client_name text, client_organization text, public_context text, questionnaire_version text, status text, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_request_id uuid;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    return;
  end if;

  select r.id
  into v_request_id
  from public.client_diagnostic_requests r
  where r.token_hash = p_token_hash
    and r.status <> 'revoked'
  limit 1;

  if v_request_id is null then
    return;
  end if;

  -- Generous enough for normal refreshes, but prevents hammering a valid bearer link.
  if not private.consume_client_diagnostic_rate_limit(v_request_id, 'lookup', 60, 600) then
    return;
  end if;

  update public.client_diagnostic_requests as r
  set status = 'expired', updated_at = now()
  where r.id = v_request_id
    and r.status in ('active','opened')
    and r.expires_at <= now();

  update public.client_diagnostic_requests as r
  set status = 'opened',
      opened_at = coalesce(r.opened_at, now()),
      updated_at = now()
  where r.id = v_request_id
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
  where r.id = v_request_id
    and r.status <> 'revoked'
  limit 1;
end;
$function$;
CREATE OR REPLACE FUNCTION public.client_diagnostic_submit(p_token_hash text, p_respondent_name text, p_respondent_role text, p_respondent_email text, p_answers jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_request_id uuid;
  v_user_id uuid;
  v_factory_case_id uuid;
  v_case_title text;
  v_missing text[] := '{}'::text[];
  v_confirm text[] := '{}'::text[];
  v_key text;
  v_value text;
  v_label text;
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

  -- Database-level size/key guard also protects direct RPC calls that bypass the UI.
  if octet_length(p_answers::text) > 60000 or jsonb_object_length(p_answers) > 30 then
    return false;
  end if;

  select
    r.id,
    r.user_id,
    r.factory_case_id,
    coalesce(f.title, 'Caso PCC')
  into
    v_request_id,
    v_user_id,
    v_factory_case_id,
    v_case_title
  from public.client_diagnostic_requests r
  left join public.project_factory_cases f on f.id = r.factory_case_id
  where r.token_hash = p_token_hash
    and r.status in ('active','opened')
    and r.expires_at > now()
  for update of r;

  if v_request_id is null then
    return false;
  end if;

  -- Eight attempts per 15 minutes per valid request. One successful submission
  -- still remains enforced by the unique response/request relationship.
  if not private.consume_client_diagnostic_rate_limit(v_request_id, 'submit', 8, 900) then
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

  if length(trim(coalesce(p_answers->>'desired_result', ''))) = 0 then
    v_missing := array_append(v_missing, 'Resultado pretendido');
  end if;

  if length(trim(coalesce(p_answers->>'focus', ''))) = 0 then
    v_missing := array_append(v_missing, 'Foco / impacto principal');
  end if;

  if length(trim(coalesce(p_answers->>'success_criteria', ''))) = 0 then
    v_missing := array_append(v_missing, 'Critério de valor / sucesso');
  end if;

  for v_key, v_value in
    select key, value
    from jsonb_each_text(p_answers)
  loop
    if coalesce(v_value, '') ~* '(não sei|nao sei|a confirmar|não definido|nao definido|por definir|a definir)' then
      v_label := case v_key
        when 'request_nature' then 'Natureza da solicitação'
        when 'context' then 'Contexto essencial'
        when 'focus' then 'Foco / impacto principal'
        when 'desired_result' then 'Resultado pretendido'
        when 'conditions' then 'Condições / restrições'
        when 'deadline_urgency' then 'Prioridade / prazo'
        when 'success_criteria' then 'Critérios de valor / sucesso'
        else replace(initcap(replace(v_key, '_', ' ')), ' / ', ' / ')
      end;

      if not (v_label = any(v_confirm)) then
        v_confirm := array_append(v_confirm, v_label);
      end if;
    end if;
  end loop;

  update public.client_diagnostic_requests
  set status = 'analyzing',
      submitted_at = now(),
      triage_missing_information = v_missing,
      triage_points_to_confirm = v_confirm,
      triaged_at = now(),
      updated_at = now()
  where id = v_request_id;

  insert into public.notifications (
    user_id,
    type,
    title,
    message,
    priority,
    related_entity_type,
    related_entity_id
  )
  values (
    v_user_id,
    'client_diagnostic_response',
    'Nova resposta de diagnóstico',
    left(trim(p_respondent_name), 200) || ' respondeu ao questionário de "' || left(v_case_title, 220) || '".',
    'high',
    'project_factory_case',
    v_factory_case_id
  );

  return true;
exception
  when unique_violation then
    return false;
end;
$function$;
revoke all on function public.client_diagnostic_lookup(text) from public;
revoke all on function public.client_diagnostic_submit(text,text,text,text,jsonb) from public;
grant execute on function public.client_diagnostic_lookup(text) to anon;
grant execute on function public.client_diagnostic_submit(text,text,text,text,jsonb) to anon;
