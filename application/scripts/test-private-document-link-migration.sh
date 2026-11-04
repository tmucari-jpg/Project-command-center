#!/usr/bin/env bash
set -euo pipefail
: "${PGHOST:?local test host required}"
: "${PGDATABASE:?disposable database required}"
: "${PGUSER:?test user required}"
: "${PGPASSWORD:?test password required}"
if [[ "$PGHOST" != "127.0.0.1" && "$PGHOST" != "localhost" ]]; then
  echo "Refusing non-local PostgreSQL target" >&2; exit 1
fi
psql -X -q -v ON_ERROR_STOP=1 -f tests/fixtures/private-document-link-fixture.sql
psql -X -q -v ON_ERROR_STOP=1 -f ../supabase/migrations/20261104140000_deliverable_private_working_edit_url.sql
query() { psql -X -qAt -v ON_ERROR_STOP=1 -c "$1"; }
query "SET ROLE authenticated; SET request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
UPDATE public.deliverables SET working_edit_url='https://example.org/manager-edit' WHERE title='PCC work document';" >/dev/null
got="$(query "SELECT artifact_url || '|' || working_edit_url FROM public.deliverables LIMIT 1;")"
if [[ "$got" != 'https://example.org/client-read-only|https://example.org/manager-edit' ]]; then
  echo "Manager reference unexpectedly replaced client delivery URL" >&2; exit 1
fi
anon_count="$(query 'SET ROLE anon; SELECT count(*) FROM public.deliverables;')"
if [[ "$anon_count" != "0" ]]; then
  echo "Anonymous users unexpectedly see manager deliverables" >&2; exit 1
fi
other_count="$(query "SET ROLE authenticated; SET request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
SELECT count(*) FROM public.deliverables;")"
if [[ "$other_count" != "0" ]]; then
  echo "Other workspace unexpectedly sees private edit URLs" >&2; exit 1
fi
owner_count="$(query "SET ROLE authenticated; SET request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
SELECT count(*) FROM public.deliverables WHERE working_edit_url='https://example.org/manager-edit';")"
if [[ "$owner_count" != "1" ]]; then
  echo "Manager cannot retrieve own private edit URL" >&2; exit 1
fi
echo "Private editor link: existing delivery preserved, anonymous and other users denied, owner allowed — PASS"
