# Production Operations — Project Command Center

Date: 2026-10-08
Scope: Current cloud production release

## 1. Release owner

Production changes must be traceable to:
- Git commit;
- Vercel deployment;
- Supabase migration where applicable;
- production acceptance evidence.

## 2. Daily operational checks

Check:
- production URL availability;
- authentication errors;
- Supabase project health;
- failed integrations;
- security events;
- critical application/runtime logs;
- failed automation jobs;
- unusual rate-limit events.

## 3. Change control

For normal changes:
1. branch from `main`;
2. implement minimal change;
3. run CI;
4. use Preview where appropriate;
5. review security/data impact;
6. merge only after PASS;
7. confirm production deployment;
8. run smoke test.

High-risk changes additionally require:
- backup before change;
- explicit rollback target;
- confirmation before destructive actions.

## 4. Incident response

For a critical incident:
1. stop further changes;
2. assess user/data impact;
3. preserve logs and evidence;
4. revoke compromised credentials if applicable;
5. rollback code or restore data when needed;
6. verify RLS/auth;
7. run smoke tests;
8. document cause and remediation;
9. resume only after approval.

## 5. Monitoring sources

Current sources:
- Vercel deployment/runtime state;
- GitHub CI status;
- Supabase project health/advisors/logs;
- application audit/security-event tables.

## 6. Known operational constraints

- Supabase Free plan does not provide the Pro daily-backup safety net.
- Leaked-password protection is unavailable on the current Supabase plan.
- Local Qwen/KoboldCPP and real offline sync are outside the current cloud-release acceptance scope.
- Authenticated UI smoke must be performed with a real operator session.

## 7. Escalation criteria

Treat as critical:
- cross-user data exposure;
- auth bypass;
- compromised secret;
- irreversible data loss;
- failed migration affecting production;
- prolonged production outage;
- corrupted audit/security records.

## 8. Current status

**OPERATIONS READINESS: PARTIAL PASS**

Cloud monitoring/deployment controls are available.
Full PASS requires:
- evidenced current database backup;
- authenticated end-to-end operator smoke test.
