-- Client diagnostic response flow: automatic triage + internal alert.

alter table public.client_diagnostic_requests
  add column if not exists triage_missing_information text[] not null default '{}'::text[],
  add column if not exists triage_points_to_confirm text[] not null default '{}'::text[],
  add column if not exists triaged_at timestamptz;

alter table public.client_diagnostic_requests
  drop constraint if exists client_diagnostic_requests_status_check;

alter table public.client_diagnostic_requests
  add constraint client_diagnostic_requests_status_check
  check (
    status in (
      'active',
      'opened',
      'submitted',
      'analyzing',
      'clarification_needed',
      'reviewed',
      'incorporated',
      'revoked',
      'expired'
    )
  );

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
$$;

revoke all on function public.client_diagnostic_submit(text,text,text,text,jsonb) from public;
grant execute on function public.client_diagnostic_submit(text,text,text,text,jsonb) to anon;

comment on column public.client_diagnostic_requests.triage_missing_information is
  'Deterministic missing-information flags generated automatically when the client submits the questionnaire.';
comment on column public.client_diagnostic_requests.triage_points_to_confirm is
  'Deterministic points requiring confirmation, based only on the client-declared answers.';
comment on column public.client_diagnostic_requests.triaged_at is
  'Timestamp when the automatic deterministic triage completed.';
