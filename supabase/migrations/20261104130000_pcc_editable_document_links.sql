-- Private manager-only reference index. Stores links, not document bytes.
-- Applied only with the single authorized PCC release; not executed on production here.
CREATE TABLE IF NOT EXISTS public.pcc_editable_document_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 2 AND 180),
  category text NOT NULL DEFAULT 'working' CHECK (category IN ('working','commercial','technical','project','other')),
  external_edit_url text NOT NULL CHECK (external_edit_url ~ '^https://[^[:space:]]+$' AND length(external_edit_url)<=2048),
  version_label text CHECK (version_label IS NULL OR length(version_label)<=80),
  notes text CHECK (notes IS NULL OR length(notes)<=1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pcc_editable_document_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.pcc_editable_document_links FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pcc_editable_document_links TO authenticated;

CREATE POLICY "PCC managers view own document links"
ON public.pcc_editable_document_links FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id AND (SELECT private.is_global_admin()));

CREATE POLICY "PCC managers create own document links"
ON public.pcc_editable_document_links FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id AND (SELECT private.is_global_admin()));

CREATE POLICY "PCC managers edit own document links"
ON public.pcc_editable_document_links FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = user_id AND (SELECT private.is_global_admin()))
WITH CHECK ((SELECT auth.uid()) = user_id AND (SELECT private.is_global_admin()));

CREATE POLICY "PCC managers delete own document links"
ON public.pcc_editable_document_links FOR DELETE TO authenticated
USING ((SELECT auth.uid()) = user_id AND (SELECT private.is_global_admin()));

CREATE INDEX IF NOT EXISTS idx_pcc_editable_document_links_owner
ON public.pcc_editable_document_links (user_id, category, updated_at DESC);
