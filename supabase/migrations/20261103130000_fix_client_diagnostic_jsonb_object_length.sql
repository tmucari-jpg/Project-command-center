-- Fix a PostgreSQL-incompatible JSONB size check in the live diagnostic RPC.
-- Preserve the existing hardened function, permissions and diagnostic workflow.
-- PostgreSQL does not provide jsonb_object_length(jsonb); jsonb_object_keys is native.
DO $migration$
DECLARE
  v_oid oid;
  v_definition text;
  v_old text := 'jsonb_object_length(p_answers)';
BEGIN
  SELECT 'public.client_diagnostic_submit(text,text,text,text,jsonb)'::regprocedure::oid INTO v_oid;
  SELECT pg_get_functiondef(v_oid) INTO v_definition;

  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Unexpected diagnostic RPC definition; review it rather than overwriting an unknown implementation';
  END IF;

  v_definition := replace(v_definition, v_old, '(select count(*) from jsonb_object_keys(p_answers))');
  EXECUTE v_definition;
END
$migration$;
