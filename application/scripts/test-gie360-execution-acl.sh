#!/usr/bin/env bash
set -euo pipefail
[[ "${PGHOST:-}" == "127.0.0.1" || "${PGHOST:-}" == "localhost" ]] || { echo "Refusing nonlocal database" >&2; exit 1; }
[[ "${PGDATABASE:-}" == "pcc_diagnostic_ci" ]] || { echo "Disposable CI database only" >&2; exit 1; }
: "${PGPASSWORD:?missing test-only password}"
psql -X -v ON_ERROR_STOP=1 -q -c "CREATE DATABASE pcc_gie360_execution_acl_ci"
export PGDATABASE=pcc_gie360_execution_acl_ci
psql -X -v ON_ERROR_STOP=1 -q <<'SQL'
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
END $$;
CREATE SCHEMA private;
CREATE FUNCTION private.gie360_activate_project(uuid) RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$ SELECT $1 $$;
CREATE FUNCTION private.gie360_create_work_item(uuid,text,text,text) RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$ SELECT $1 $$;
CREATE FUNCTION private.gie360_progress_work_item(uuid,text,text) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT true $$;
CREATE FUNCTION private.gie360_transfer_approved_case(uuid,uuid) RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$ SELECT $1 $$;
CREATE FUNCTION private.gie360_finish_ai_request(uuid,text,text,text) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT true $$;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC,authenticated,anon;
GRANT USAGE ON SCHEMA private TO authenticated;
SQL
psql -X -v ON_ERROR_STOP=1 -q -f ../supabase/migrations/20261109103000_gie360_execution_private_rpc_acl.sql
psql -X -v ON_ERROR_STOP=1 -q <<'SQL'
DO $$
DECLARE v_procedure regprocedure;
BEGIN
 FOREACH v_procedure IN ARRAY ARRAY[
  'private.gie360_activate_project(uuid)'::regprocedure,
  'private.gie360_create_work_item(uuid,text,text,text)'::regprocedure,
  'private.gie360_progress_work_item(uuid,text,text)'::regprocedure,
  'private.gie360_transfer_approved_case(uuid,uuid)'::regprocedure,
  'private.gie360_finish_ai_request(uuid,text,text,text)'::regprocedure
 ] LOOP
  IF NOT has_function_privilege('authenticated',v_procedure,'EXECUTE') THEN
   RAISE EXCEPTION 'Missing authenticated execution grant for %',v_procedure;
  END IF;
  IF has_function_privilege('anon',v_procedure,'EXECUTE') THEN
   RAISE EXCEPTION 'Private RPC may not be public or anonymous: %',v_procedure;
  END IF;
 END LOOP;
END $$;
SQL
echo "GIE360 protected operational wrappers: private EXECUTE grants verified without anon access"
