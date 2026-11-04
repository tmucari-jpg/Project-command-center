#!/usr/bin/env bash
set -euo pipefail

# Runs exclusively against a disposable PostgreSQL database configured by CI.
: "${PGHOST:?isolated PGHOST required}"
: "${PGDATABASE:?isolated PGDATABASE required}"
: "${PGUSER:?isolated PGUSER required}"
: "${PGPASSWORD:?isolated PGPASSWORD required}"
if [[ "$PGHOST" != "127.0.0.1" && "$PGHOST" != "localhost" ]]; then
  echo "Refusing non-local PostgreSQL target" >&2; exit 1
fi

psql -X -v ON_ERROR_STOP=1 -q -f tests/fixtures/diagnostic-renewal-fixture.sql
psql -X -v ON_ERROR_STOP=1 -q -f ../supabase/migrations/20261104123000_atomic_client_diagnostic_renewal.sql

owner="11111111-1111-4111-8111-111111111111"
caseid="22222222-2222-4222-8222-222222222222"
other="33333333-3333-4333-8333-333333333333"

query() { psql -X -v ON_ERROR_STOP=1 -qAt -c "$1"; }
issue() {
  local who="$1" hash="$2" variant="$3"
  query "SET ROLE authenticated;
SET request.jwt.claim.sub='$who';
SELECT public.issue_client_diagnostic_request_atomic(
 '$owner'::uuid, '$caseid'::uuid,
 repeat('$hash',64),'$variant',NULL,NULL,NULL,
 now()+interval '7 days'
);" 
}
assert_count() {
  local label="$1" expected="$2" sql="$3" got
  got="$(query "$sql")"
  if [[ "$got" != "$expected" ]]; then
    echo "$label: expected $expected, got $got" >&2; exit 1
  fi
}

# Successful legacy PCC issue.
issue "$owner" a executive-v3 > /dev/null
assert_count "first active" 1 "SELECT count(*) FROM public.client_diagnostic_requests WHERE status='active';"
assert_count "submitted preserved" 1 "SELECT count(*) FROM public.client_diagnostic_requests WHERE status='submitted';"

# Reusing a token hash must fail and roll back revocation of the active link.
if issue "$owner" a executive-v3 > /dev/null 2>&1; then
  echo "Duplicate token unexpectedly accepted" >&2; exit 1
fi
assert_count "rollback keeps old link" 1 "SELECT count(*) FROM public.client_diagnostic_requests WHERE status='active' AND token_hash=repeat('a',64);"

# New PCC x GIE360 questionnaire variant, preserving the old submitted request.
issue "$owner" b executive-v3-gie360 > /dev/null
assert_count "gie variant" 1 "SELECT count(*) FROM public.client_diagnostic_requests WHERE status='active' AND questionnaire_version='executive-v3-gie360';"
assert_count "replaced previous" 1 "SELECT count(*) FROM public.client_diagnostic_requests WHERE status='revoked' AND token_hash=repeat('a',64);"
assert_count "submitted still preserved" 1 "SELECT count(*) FROM public.client_diagnostic_requests WHERE status='submitted';"

# Two separate connections race to renew the same case, and the row lock
# must serialize them so only one final token remains active.
issue "$owner" c executive-v3 > /tmp/pcc_atomic_c.out &
pid1=$!
issue "$owner" d executive-v3-gie360 > /tmp/pcc_atomic_d.out &
pid2=$!
wait "$pid1"
wait "$pid2"
assert_count "concurrent final active" 1 "SELECT count(*) FROM public.client_diagnostic_requests WHERE status='active';"
assert_count "concurrent token count" 2 "SELECT count(*) FROM public.client_diagnostic_requests WHERE token_hash IN (repeat('c',64),repeat('d',64));"
assert_count "no deleted submissions" 1 "SELECT count(*) FROM public.client_diagnostic_requests WHERE status='submitted';"

# A non-owner must not issue a replacement.
if issue "$other" e executive-v3 > /dev/null 2>&1; then
  echo "Unauthorized user unexpectedly issued diagnostic link" >&2; exit 1
fi
assert_count "nonowner cannot revoke" 1 "SELECT count(*) FROM public.client_diagnostic_requests WHERE status='active';"
echo "Atomic diagnostic renewal: both variants, rollback, concurrency and ownership PASS"
