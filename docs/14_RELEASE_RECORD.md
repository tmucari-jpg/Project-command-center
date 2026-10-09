# Release Record — Project Command Center

VERSION: Cloud Production Release 2026-10-09
DATE: 2026-10-09
COMMIT: c8c64dc339bf80eaf812353ea5643ff1cc9cf783
DEPLOYMENT: Vercel production — READY
PROJECT: project-command-center
PRODUCTION ALIAS: project-command-center-seven-xi.vercel.app

## Test result

PASS:
- GitHub CI install
- typecheck
- automated tests
- lint
- production build
- Vercel deployment
- production login route
- unauthenticated dashboard protection
- RLS SELECT isolation
- RLS UPDATE isolation
- RLS DELETE isolation
- mobile login usability
- Supabase project health

PASS — authenticated smoke and database persistence:
- authenticated dashboard loaded;
- project created successfully;
- action created and updated to in_progress;
- evidence created successfully;
- logout completed;
- direct database verification confirmed the project, action and evidence persist after logout.

OBSERVED FUNCTIONAL FOLLOW-UP:
- the smoke-test action persisted, but its project_id is null. This does not invalidate persistence, but entity-linking behavior should be reviewed separately.

DEFERRED ACCESS CHECK:
- automatic re-login after logout was blocked by unavailable saved credentials; access/session handling will be addressed separately as agreed.

PASS — logical backup gate:
- logical backup created 2026-10-09;
- stored on removable/off-production storage;
- readability verified using pg_restore --list;
- SHA-256: CA3772BA30B8C814FB163AB888DA1D6CA39DFF9F1C2EA82DCDA978CDF3286990

## Security result

**APPROVED FOR CURRENT CLOUD PRODUCTION RELEASE**

See:
- `docs/16_SECURITY_GATE_CURRENT.md`

Accepted platform limitation:
- leaked-password protection unavailable on current Supabase Free plan.

Deferred release capability:
- Qwen/KoboldCPP local runtime and real offline sync.

## Rollback plan

Code:
- rollback/promote a previously known-good Vercel production deployment tied to a Git commit.

Database:
- restore from a verified logical backup.
- current Free-plan release must create and retain a logical dump before risky production changes.

## Known issues / limitations

2. Authenticated re-login automation is deferred to the separate access workstream; persistence has been independently verified in the database.
3. Leaked-password protection requires Supabase Pro.
4. Local/private AI runtime is not included in this cloud production acceptance.

## Production acceptance status

**PRODUCTION ACCEPTANCE: APPROVED**

Reason:
The security gate is approved, production is live/healthy, authenticated smoke operations passed, and persistence was verified directly in the database.

Production acceptance criteria for the current cloud release are satisfied:
1. Security Gate approved.
2. Production is live/healthy.
3. Authenticated smoke passed.
4. Persistence verified directly in PostgreSQL.
5. Current logical backup created off-production with readability and checksum evidence.

The separate access/re-login workstream remains a follow-up and is not being treated as a persistence failure.

Once both are recorded, this release can move to:

**PRODUCTION ACCEPTANCE: APPROVED**
