-- Restore tenant-scoped reading of GIE360 originals.
-- The prior policy checked storage.foldername(o.name), i.e. the organization's
-- display name, not the storage object's path.
DROP POLICY IF EXISTS gie360_original_read ON storage.objects;
CREATE POLICY gie360_original_read
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'gie360-import-originals'
  AND EXISTS (
    SELECT 1
    FROM public.gie360_organizations org
    WHERE org.id::text = (storage.foldername(storage.objects.name))[1]
      AND private.gie360_can_access(org.id)
  )
);
