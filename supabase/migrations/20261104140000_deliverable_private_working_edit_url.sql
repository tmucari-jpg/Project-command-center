-- Private manager editing reference on existing deliverables; no file duplication.
-- Pending the single authorized production migration.
ALTER TABLE public.deliverables
  ADD COLUMN IF NOT EXISTS working_edit_url text;

ALTER TABLE public.deliverables
  ADD CONSTRAINT deliverables_working_edit_url_https_check
  CHECK (
    working_edit_url IS NULL OR
    (working_edit_url ~ '^https://[^[:space:]]+$' AND length(working_edit_url) <= 2048)
  );

-- Existing RLS protects this owner-scoped column. Deny direct anonymous
-- column access explicitly; the customer portal only reads approved snapshots.
REVOKE SELECT (working_edit_url), INSERT (working_edit_url), UPDATE (working_edit_url)
  ON public.deliverables FROM anon;

COMMENT ON COLUMN public.deliverables.working_edit_url IS
  'Internal edit-only reference. Never include in client share snapshots or public output.';
