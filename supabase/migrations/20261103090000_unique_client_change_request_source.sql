-- Enforce one internal change request per public-link response, including concurrent submissions.
-- Additive migration; apply only in an authorized environment after review.
alter table public.project_change_requests
  add column if not exists source_client_decision_id uuid
  references public.project_client_status_decisions(id) on delete restrict;
create unique index if not exists project_change_requests_source_decision_once
  on public.project_change_requests (source_client_decision_id)
  where source_client_decision_id is not null;
