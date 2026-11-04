-- Used only in disposable CI PostgreSQL, after the diagnostic fixture.
CREATE TABLE public.deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid NOT NULL,
  title text NOT NULL,
  artifact_url text,
  status text NOT NULL DEFAULT 'pending',
  acceptance_status text NOT NULL DEFAULT 'pending'
);
ALTER TABLE public.deliverables ENABLE ROW LEVEL SECURITY;
CREATE POLICY deliverable_owner ON public.deliverables
FOR ALL TO authenticated
USING (user_id=auth.uid())
WITH CHECK (user_id=auth.uid());
-- Real project also has broad table grants; RLS must still block anon.
GRANT SELECT, INSERT, UPDATE ON public.deliverables TO anon, authenticated;
INSERT INTO public.deliverables(user_id,project_id,title,artifact_url)
VALUES('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','PCC work document','https://example.org/client-read-only');
