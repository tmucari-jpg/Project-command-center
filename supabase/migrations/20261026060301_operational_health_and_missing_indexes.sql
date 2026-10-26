alter table public.ai_provider_profiles
  add column if not exists last_health_message text;

create index if not exists idx_client_diagnostic_external_sources_factory_case_id
  on public.client_diagnostic_external_sources(factory_case_id);

create index if not exists idx_project_change_requests_baseline_id
  on public.project_change_requests(baseline_id);

create index if not exists idx_project_change_requests_created_by
  on public.project_change_requests(created_by);

create index if not exists idx_project_change_requests_user_id
  on public.project_change_requests(user_id);

create index if not exists idx_project_commitment_baselines_created_by
  on public.project_commitment_baselines(created_by);

create index if not exists idx_project_commitment_baselines_user_id
  on public.project_commitment_baselines(user_id);
