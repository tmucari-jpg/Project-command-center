-- ============================================================
-- OPERATIONAL QA HARDENING
-- Revoke direct RPC access to trigger-only SECURITY DEFINER helpers
-- and add covering indexes for newly introduced foreign keys.
-- ============================================================

revoke all on function public.enforce_phase1_owned_relationships() from public, anon, authenticated;
revoke all on function public.enforce_phase2_owned_project() from public, anon, authenticated;
revoke all on function public.enforce_subscription_project_owner() from public, anon, authenticated;
revoke all on function public.enforce_agentic_owned_relationships() from public, anon, authenticated;
revoke all on function public.enforce_intelligence_project_owner() from public, anon, authenticated;
revoke all on function public.enforce_sync_project_owner() from public, anon, authenticated;
revoke all on function public.enforce_security_project_owner() from public, anon, authenticated;

create index if not exists idx_subscription_plans_user_id on public.subscription_plans(user_id);
create index if not exists idx_payment_channels_user_id on public.payment_channels(user_id);
create index if not exists idx_subscription_funnel_metrics_user_id on public.subscription_funnel_metrics(user_id);

create index if not exists idx_approval_requests_project_id on public.approval_requests(project_id);
create index if not exists idx_approval_requests_agent_run_id on public.approval_requests(agent_run_id);

create index if not exists idx_execution_steps_user_id on public.execution_steps(user_id);
create index if not exists idx_execution_steps_project_id on public.execution_steps(project_id);
create index if not exists idx_execution_steps_approval_request_id on public.execution_steps(approval_request_id);

create index if not exists idx_sync_queue_project_id on public.sync_queue(project_id);
