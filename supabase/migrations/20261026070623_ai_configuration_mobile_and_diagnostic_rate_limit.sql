-- AI configuration validity, mobile release formats and diagnostic rate limiting.

alter table public.ai_provider_profiles
  add column if not exists configuration_status text not null default 'unverified',
  add column if not exists availability_reason text not null default 'unknown';

alter table public.ai_provider_profiles
  drop constraint if exists ai_provider_profiles_configuration_status_check;
alter table public.ai_provider_profiles
  add constraint ai_provider_profiles_configuration_status_check
  check (configuration_status in ('unverified','valid','invalid'));

alter table public.ai_provider_profiles
  drop constraint if exists ai_provider_profiles_availability_reason_check;
alter table public.ai_provider_profiles
  add constraint ai_provider_profiles_availability_reason_check
  check (availability_reason in ('healthy','quota','rate_limit','auth','model','endpoint','network','provider','unknown'));

update public.ai_provider_profiles
set configuration_status = 'valid', availability_reason = 'quota'
where lower(coalesce(last_health_message,'')) ~ '(quota|credits remaining|insufficient_quota|add funds|billing)'
  and last_health_status in ('degraded','offline');

update public.ai_provider_profiles
set configuration_status = 'valid', availability_reason = 'healthy'
where last_health_status = 'healthy';

alter table public.pcc_official_documents
  drop constraint if exists pcc_official_documents_document_key_check;
alter table public.pcc_official_documents
  add const¶»§q«^