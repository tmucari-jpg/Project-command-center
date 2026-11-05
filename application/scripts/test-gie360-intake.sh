#!/usr/bin/env bash
set -euo pipefail
: "${PGHOST:?local database required}"
: "${PGDATABASE:?disposable test database required}"
: "${PGPASSWORD:?local test password required}"
[[ "$PGHOST" == "127.0.0.1" || "$PGHOST" == "localhost" ]] || { echo "Local PostgreSQL only" >&2; exit 1; }
[[ "$PGDATABASE" == "pcc_diagnostic_ci" ]] || { echo "Refusing non-CI database" >&2; exit 1; }

psql -X -v ON_ERROR_STOP=1 -q -c "CREATE DATABASE pcc_gie360_intake_ci"
export PGDATABASE=pcc_gie360_intake_ci
psql -X -v ON_ERROR_STOP=1 -q -f tests/fixtures/gie360-intake-fixture.sql
psql -X -v ON_ERROR_STOP=1 -q -f ../supabase/migrations/20261105093400_gie360_intake_from_diagnostic.sql
query() { psql -X -v ON_ERROR_STOP=1 -qAt -c "$1"; }
owner="11111111-1111-4111-8111-111111111111"
caseid="22222222-2222-4222-8222-222222222222"
first="$(query "SET ROLE authenticated;SET request.jwt.claim.sub='$owner';SELECT public.gie360_intake_from_diagnostic('$caseid'::uuid);")"
second="$(query "SET ROLE authenticated;SET request.jwt.claim.sub='$owner';SELECT public.gie360_intake_from_diagnostic('$caseid'::uuid);")"
[[ "$first" == "$second" ]] || { echo "Intake must be idempotent" >&2; exit 1; }
[[ "$(query "SELECT count(*) FROM public.gie360_organizations")" == 1 ]] || exit 1
[[ "$(query "SELECT count(*) FROM public.gie360_assessments")" == 1 ]] || exit 1
[[ "$(query "SELECT count(*) FROM public.gie360_projects")" == 1 ]] || exit 1
[[ "$(query "SELECT company_profile->>'contact_phone' FROM public.gie360_organizations")" == "+258000000000" ]] || exit 1
[[ "$(query "SELECT status FROM public.gie360_projects")" == "awaiting_scope" ]] || exit 1
if query "SET ROLE authenticated;SET request.jwt.claim.sub='55555555-5555-4555-8555-555555555555';SELECT public.gie360_intake_from_diagnostic('$caseid'::uuid);" >/dev/null 2>&1; then
  echo "Non-owner transfer unexpectedly succeeded" >&2; exit 1
fi
if query "SET ROLE authenticated;SET request.jwt.claim.sub='$owner';SELECT public.gie360_intake_from_diagnostic('33333333-3333-4333-8333-333333333333'::uuid);" >/dev/null 2>&1; then
  echo "Unapproved transfer unexpectedly succeeded" >&2; exit 1
fi
echo "GIE360 intake: owner, approved diagnostic, no-email, phone, idempotency PASS"
