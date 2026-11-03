-- Replace the PostgreSQL-incompatible JSONB key count in the currently deployed
-- diagnostic RPC. Never overwrite unrelated function changes.
DO $migration$
DECLARE
  v_definition text;
  v_old text := 'jsonb_object_length(p_answers)';
  v_new text := '(select count(*) from jsonb_object_keys(p_answers))';
BEGIN
  SELECT pg_get_functiondef('public.client_diagnostic_submit(text,text,text,text,jsonb)'::regprocedure)
    INTO v_definition;

  IF position(v_old IN v_definition) > 0 THEN
    EXECUTE replace(v_definition, v_old, v_new);
  ELSIF position(v_new IN v_definition) > 0 THEN
    RAISE NOTICE 'Diagnostic RPC already corrected; no operation required';
  ELSE
    RAISE EXCEPTION 'Unexpected diagnostic RPC definition; manual review is required';
  END IF;
END
$migration$;
