-- Non-destructive indexes added after Supabase advisor review.
-- Keeps repository migrations aligned with the production database.

create index if not exists idx_ai_commands_user_id on public.ai_commands(user_id);
create index if not exists idx_ai_interactions_user_id on public.ai_interactions(user_id);
create index if not exists idx_automation_jobs_orchestrator_route_id on public.automation_jobs(orchestrator_route_id);
create index if not exists idx_automation_jobs_workflow_id on public.automation_jobs(workflow_id);
create index if not exists idx_blockers_action_id on public.blockers(action_id);
create index if not exists idx_blockers_deliverable_id on public.blockers(deliverable_id);
create index if not exists idx_blockers_project_id on public.blockers(project_id);
create index if not exists idx_evidence_action_id on public.evidence(action_id);
create index if not exists idx_evidence_deliverable_id on public.evidence(deliverable_id);
create index if not exists idx_evidence_project_id on public.evidence(project_id);
create index if not exists idx_ideas_project_id on public.ideas(project_id);
create index if not exists idx_integrations_user_id on public.integrations(user_id);
create index if not exists idx_metrics_objective_id on public.metrics(objective_id);
create index if not exists idx_metrics_project_id on public.metrics(project_id);
