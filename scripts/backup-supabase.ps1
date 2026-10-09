param(
  [Parameter(Mandatory = $true)]
  [string]$DestinationRoot
)

$ErrorActionPreference = "Stop"

function Require-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command '$Name' was not found."
  }
}

Require-Command "supabase"
Require-Command "docker"

if (-not $env:SUPABASE_DB_URL) {
  throw "SUPABASE_DB_URL is not set in this PowerShell session."
}

docker info *> $null
if ($LASTEXITCODE -ne 0) {
  throw "Docker Desktop is not running."
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path $DestinationRoot "PCC-Supabase-$timestamp"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

$roles = Join-Path $backupDir "roles.sql"
$schema = Join-Path $backupDir "schema.sql"
$data = Join-Path $backupDir "data.sql"

Write-Host "Creating logical backup in $backupDir"

& supabase db dump --db-url $env:SUPABASE_DB_URL -f $roles --role-only
if ($LASTEXITCODE -ne 0) { throw "Roles dump failed." }

& supabase db dump --db-url $env:SUPABASE_DB_URL -f $schema
if ($LASTEXITCODE -ne 0) { throw "Schema dump failed." }

& supabase db dump --db-url $env:SUPABASE_DB_URL -f $data --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"
if ($LASTEXITCODE -ne 0) { throw "Data dump failed." }

$files = @($roles, $schema, $data)
foreach ($file in $files) {
  $item = Get-Item $file
  if ($item.Length -le 0) {
    throw "Backup verification failed: $($item.Name) is empty."
  }
}

$hashes = foreach ($file in $files) {
  $hash = Get-FileHash -Algorithm SHA256 $file
  "$($hash.Hash)  $([System.IO.Path]::GetFileName($file))"
}
$hashes | Set-Content (Join-Path $backupDir "SHA256SUMS.txt") -Encoding UTF8

$releaseCommit = if ($env:PCC_RELEASE_COMMIT) {
  $env:PCC_RELEASE_COMMIT
} else {
  "c8c64dc339bf80eaf812353ea5643ff1cc9cf783"
}

$manifest = @"
Project: Project Command Center
Supabase project ref: fhjvvskapyvtyrbsxozz
Backup type: logical
Created: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss K")
Release commit: $releaseCommit
Files:
- roles.sql
- schema.sql
- data.sql
- SHA256SUMS.txt
Verification:
- all dump files are non-empty
- SHA-256 checksums generated
Security:
- database connection string is NOT stored in this backup
"@

$manifest | Set-Content (Join-Path $backupDir "backup-manifest.txt") -Encoding UTF8

Write-Host ""
Write-Host "BACKUP PASS"
Write-Host "Location: $backupDir"
Write-Host "Manifest: $(Join-Path $backupDir 'backup-manifest.txt')"
Write-Host "Checksums: $(Join-Path $backupDir 'SHA256SUMS.txt')"
