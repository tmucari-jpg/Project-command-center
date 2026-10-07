alter table public.automation_jobs
  add column if not exists callback_token_hash text,
  add column if not exists result jsonb not null default '{}'::jsonb;

comment on column public.automation_jobs.callback_token_hash is
  'SHA-256 hash of the one-time callback token sent to n8n. Never store the plaintext token.';
comment on column public.automation_jobs.result is
  'Structured execution result returned by the n8n completion callback.';
