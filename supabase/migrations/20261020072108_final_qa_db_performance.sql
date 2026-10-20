create index if not exists idx_project_gate_events_created_by
  on public.project_gate_events(created_by);

create index if not exists idx_project_governance_dependencies_user_id
  on public.project_governance_dependencies(user_id);

create index if not exists idx_project_governance_risks_owner_id
  on public.project_governance_risks(owner_id);

alter policy "Users can create own gate events"
  on public.project_gate_events
  with check ((select auth.uid()) = user_id);

alter policy "Users can view own gate events"
  on public.project_gate_events
  using ((select auth.uid()) = user_id);
