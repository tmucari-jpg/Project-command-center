# Backup & Recovery — Project Command Center

Date: 2026-10-08
Scope: Current cloud production release

## 1. Current platform constraint

The Supabase organization is on the Free plan.

Supabase documentation states that automatic daily backups are provided for Pro, Team and Enterprise projects. For Free plan projects, Supabase recommends regular manual exports using `supabase db dump` and keeping off-site backups.

Therefore, the current release must not assume automatic platform backup coverage.

## 2. Backup strategy

### Database
Before any risky schema/data change:
1. create a logical backup with Supabase CLI / pg_dump;
2. store the backup outside the production project;
3. record timestamp, project ref and source commit;
4. verify that the file is readable;
5. keep at least one recent known-good backup before destructive changes.

### Code
- GitHub `main` is the source of truth for released code.
- Release commits must remain identifiable.
- Production deployments are tied to Git commits.
- Previous Vercel deployments provide a code rollback path.

### Storage
If Supabase Storage becomes material to production, database backups alone are not sufficient. Object backup/recovery must be handled separately.

## 3. Recovery sequence

Incident
→ stop risky changes
→ identify affected release/data
→ protect current evidence/logs
→ select recovery point
→ restore database or rollback code
→ verify authentication and RLS
→ run smoke test
→ resume service only after verification

## 4. Code rollback

Current approved release commit:
`c8c64dc339bf80eaf812353ea5643ff1cc9cf783`

Previous known production deployment:
`dpl_XrcegPMwygog5Xqjqq8CwuycBvTd`

Vercel rollback/promotion must target a known-good production deployment, followed by smoke testing.

## 5. Database recovery

For the current Free plan:
- recovery depends on an exported logical backup;
- automatic daily restore points must not be assumed;
- any destructive migration requires a fresh backup first.

After upgrade to Supabase Pro:
- enable and verify automatic daily backups;
- consider PITR if business criticality justifies it.

## 6. Evidence required

A backup control is PASS only when:
- an actual logical dump exists;
- it is stored off the production database;
- timestamp and source commit are recorded;
- restore/readability has been tested or verified.

## 7. Current status

**BACKUP GATE: REQUIRES_FIX**

Reason: backup strategy is defined, but an actual current logical database dump has not yet been evidenced through the available connected tools.

This is the main operational blocker remaining before declaring full production acceptance.
