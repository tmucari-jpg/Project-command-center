# PCC Supabase Logical Backup Runbook

## Purpose
Create a current off-production logical backup for the Project Command Center before final Production Acceptance.

## Current platform constraint
The Supabase organization is on the Free plan. Supabase recommends Free-plan projects regularly export their database using the CLI `db dump` command and maintain off-site backups.

## What the automated Windows script creates
`scripts/backup-supabase.ps1` creates a timestamped backup folder containing:

- `roles.sql`
- `schema.sql`
- `data.sql`
- `SHA256SUMS.txt`
- `backup-manifest.txt`

The database connection string is never written to the backup files.

## Prerequisites
- Supabase CLI installed.
- Docker Desktop installed and running.
- A writable off-production destination, preferably the designated encrypted pen drive or another controlled backup location.
- The current database connection string from Supabase Dashboard > Connect. Use the Session pooler connection string by default.

## One-session execution

In PowerShell, set the database URL only for the current shell session:

```powershell
$env:SUPABASE_DB_URL = "<connection-string-from-Supabase-Connect>"
$env:PCC_RELEASE_COMMIT = "c8c64dc339bf80eaf812353ea5643ff1cc9cf783"
.\scripts\backup-supabase.ps1 -DestinationRoot "E:\PCC-Backups"
Remove-Item Env:SUPABASE_DB_URL
```

Replace `E:\PCC-Backups` with the actual off-production backup destination.

Do not paste the connection string into GitHub, chat, documentation, screenshots, or source files.

## Pass criteria
The backup is PASS when:

1. the script prints `BACKUP PASS`;
2. roles/schema/data files are non-empty;
3. SHA-256 checksums exist;
4. `backup-manifest.txt` records timestamp and release commit;
5. the folder is stored outside the production database;
6. the connection string has been removed from the PowerShell session after completion.

## Restore procedure
For disaster recovery, create a fresh Supabase project and follow the current Supabase CLI restore documentation. Restore roles/schema/data using the documented sequence and verify application migrations, Auth configuration, Edge Functions and environment settings separately.

Supabase-managed `auth` and `storage` schemas have special restore considerations. The CLI dump excludes platform-managed objects; customizations to managed schemas must come from migrations/diff as documented by Supabase. Storage objects themselves are not part of a database logical dump.

## Production Acceptance evidence
After a successful run, record only:

- backup timestamp;
- backup folder name/location class (for example, encrypted pen drive);
- release commit;
- checksum file present;
- verification result.

Never commit the backup contents to the repository.
