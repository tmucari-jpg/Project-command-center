#!/usr/bin/env bash
set -euo pipefail
[[ "${PGHOST:-}" == "127.0.0.1" || "${PGHOST:-}" == "localhost" ]] || { echo "local PostgreSQL only" >&2; exit 1; }
[[ "${PGDATABASE:-}" == "pcc_diagnostic_ci" ]] || { echo "disposable database only" >&2; exit 1; }
: "${PGPASSWORD:?missing disposable password}"
psql -X -v ON_ERROR_STOP=1 -q -c "CREATE DATABASE pcc_gie360_client_ci"
export PGDATABASE=pcc_gie360_client_ci
psql -X -v ON_ERROR_STOP=1 -q -f tests/fixtures/gie360-client-membership-fixture.sql
psql -X -v ON_ERROR_STOP=1 -q -f ../supabase/migrations/20261109090500_gie360_existing_client_membership.sql
query() { psql -X -v ON_ERROR_STOP=1 -qAt -c "$1"; }
owner='11111111-1111-4111-8111-111111111111'
org='22222222-2222-4222-8222-222222222222'
accept() { query "SET ROLE authenticated; SET request.jwt.claim.sub='$owner'; SELECT public.gie360_link_existing_client('$org'::uuid,'$1');"; }
[[ "$(accept 'CLIENT@example.invalid')" == "t" ]] || { echo "Confirmed separate client not linked" >&2; exit 1; }
[[ "$(accept 'client@example.invalid')" == "t" ]] || { echo "Idempotent association failed" >&2; exit 1; }
[[ "$(query "SELECT count(*) FROM public.gie360_memberships;")" == 1 ]] || { echo "Duplicate membership" >&2; exit 1; }
[[ "$(accept 'pending@example.invalid')" == "f" ]] || { echo "Unconfirmed client linked" >&2; exit 1; }
[[ "$(accept 'missing@example.invalid')" == "f" ]] || { echo "Nonexistent client linked" >&2; exit 1; }
if accept 'manager@example.invalid' >/dev/null 2>&1; then echo "Manager linked as own client" >&2; exit 1; fi
if query "SET ROLE authenticated; SET request.jwt.claim.sub='99999999-9999-4999-8999-999999999999'; SELECT public.gie360_link_existing_client('$org'::uuid,'client@example.invalid');" >/dev/null 2>&1; then
 echo "Cross-tenant membership unexpectedly permitted" >&2; exit 1
fi
[[ "$(query "SELECT count(*) FROM public.gie360_memberships;")" == 1 ]] || exit 1
echo "GIE360 separate client account: authorization, confirmation, idempotency PASS"
