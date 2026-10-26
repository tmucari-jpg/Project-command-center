# PCC full smoke - PowerShell 7+ only
param(
  [string]$RepoPath = "D:\03_PROJECTS\Project-Command-Center",
  [int]$Port = 3000,
  [string]$ProductionUrl = "",
  [switch]$SkipAuthenticatedDataSmoke,
  [switch]$SkipProductionProbe,
  [switch]$AfterSyncRelaunch,
  [string]$ExpectedReleaseCommit = ""
)

$ErrorActionPreference = "Stop"

if ($PSVersionTable.PSEdition -ne "Core" -or $PSVersionTable.PSVersion.Major -lt 7) {
  Write-Host ""
  Write-Host "FAIL - PCC smoke requires PowerShell 7+ (pwsh), not Windows PowerShell 5.1." -ForegroundColor Red
  exit 1
}

$pwshExe = Join-Path $PSHOME "pwsh.exe"
if (-not (Test-Path $pwshExe)) {
  Write-Host ""
  Write-Host "FAIL - Could not resolve pwsh.exe from PSHOME: $PSHOME" -ForegroundColor Red
  exit 1
}

function Write-Step([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Pass([string]$Message) {
  Write-Host "PASS - $Message" -ForegroundColor Green
}

function Write-Warn([string]$Message) {
  Write-Host "WARN - $Message" -ForegroundColor Yellow
}

function Stop-WithError([string]$Message) {
  Write-Host ""
  Write-Host "FAIL - $Message" -ForegroundColor Red
  exit 1
}

function Assert-ReleaseUnchanged([string]$ExpectedCommit, [string]$Checkpoint) {
  if (-not $ExpectedCommit) { return }

  $localCommit = (git rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0 -or $localCommit -ne $ExpectedCommit) {
    Stop-WithError "Release changed locally during validation at $Checkpoint. Expected=¶»§q«^