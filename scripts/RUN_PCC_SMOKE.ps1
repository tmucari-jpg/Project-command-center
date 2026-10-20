# Canonical PCC smoke launcher.
# Purpose: synchronize first, then execute the smoke script from the verified current main commit.
param(
  [string]$RepoPath = "D:\03_PROJECTS\Project-Command-Center",
  [int]$Port = 3000,
  [string]$ProductionUrl = "",
  [switch]$SkipAuthenticatedDataSmoke,
  [switch]$SkipProductionProbe
)

$ErrorActionPreference = "Stop"

if ($PSVersionTable.PSEdition -ne "Core" -or $PSVersionTable.PSVersion.Major -lt 7) {
  Write-Host ""
  Write-Host "FAIL - PCC smoke requires PowerShell 7+ (pwsh), not Windows PowerShell 5.1." -ForegroundColor Red
  Write-Host "Run: pwsh -NoProfile -ExecutionPolicy Bypass -File .\scripts\RUN_PCC_SMOKE.ps1" -ForegroundColor Yellow
  exit 1
}

$pwshExe = Join-Path $PSHOME "pwsh.exe"
if (-not (Test-Path $pwshExe)) {
  Write-Host ""
  Write-Host "FAIL - Could not resolve pwsh.exe from PSHOME: $PSHOME" -ForegroundColor Red
  exit 1
}

function Fail([string]$Message) {
  Write-Host ""
  Write-Host "FAIL - $Message" -ForegroundColor Red
  exit 1
}

function Pass([string]$Message) {
  Write-Host "PASS - $Message" -ForegroundColor Green
}

if (-not (Test-Path $RepoPath)) {
  Fail "Repository not found: $RepoPath"
}

Set-Location $RepoPath
if (-not (Test-Path ".git")) {
  Fail "$RepoPath is not a Git repository."
}

$autoStashedGitignore = $false
$stashMessage = "PCC-auto-pre-smoke-gitignore-" + (Get-Date -Format "yyyyMMdd-HHmmss")

try {
  Write-Host ""
  Write-Host "==> PCC canonical smoke preflight" -ForegroundColor Cyan

  $originUrl = (git remote get-url origin).Trim()
  if ($LASTEXITCODE -ne 0 -or -not $originUrl) {
    Fail "Could not read Git origin."
  }

  if ($originUrl -notmatch "tmucari-jpg/Project-command-center") {
    Fail "Unexpected origin repository: $originUrl"
  }
  Pass "Correct repository origin"

  $dirtyLines = @(git status --porcelain)
  if ($dirtyLines.Count -gt 0) {
    $dirtyPaths = @(
      $dirtyLines | ForEach-Object {
        if ($_.Length -ge 4) { $_.Substring(3).Trim() }
      } | Where-Object { $_ }
    )

    $onlyGitignore = ($dirtyPaths.Count -gt 0) -and (@($dirtyPaths | Where-Object { $_ -ne ".gitignore" }).Count -eq 0)

    if ($onlyGitignore) {
      Write-Host "INFO - Only .gitignore has local changes. It will be stashed automatically and restored after the smoke." -ForegroundColor Yellow
      git stash push -m $stashMessage -- .gitignore | Out-Host
      if ($LASTEXITCODE -ne 0) {
        Fail "Could not auto-stash .gitignore."
      }
      $autoStashedGitignore = $true
    }
    else {
      Write-Host "Local changes detected:" -ForegroundColor Yellow
      $dirtyLines | ForEach-Object { Write-Host "  $_" }
      Fail "Preflight stopped because files other than .gitignore have local changes."
    }
  }
  else {
    Pass "Working tree clean"
  }

  $remoteLine = git ls-remote origin refs/heads/main
  if ($LASTEXITCODE -ne 0 -or -not $remoteLine) {
    Fail "Could not read authoritative origin/main."
  }
  $remoteMain = ($remoteLine -split "\s+")[0].Trim()

  git fetch --prune origin "+refs/heads/main:refs/remotes/origin/main"
  if ($LASTEXITCODE -ne 0) {
    Fail "Could not fetch authoritative origin/main."
  }

  $trackingMain = (git rev-parse origin/main).Trim()
  if ($trackingMain -ne $remoteMain) {
    Fail "Remote tracking ref is stale after fetch. authoritative=$remoteMain tracking=$trackingMain"
  }

  git checkout main
  if ($LASTEXITCODE -ne 0) {
    Fail "Could not checkout main."
  }

  git merge --ff-only origin/main
  if ($LASTEXITCODE -ne 0) {
    Fail "Could not fast-forward main. No reset/force was used."
  }

  $localMain = (git rev-parse HEAD).Trim()
  if ($localMain -ne $remoteMain) {
    Fail "Local main is not current after synchronization. local=$localMain remote=$remoteMain"
  }
  Pass "Local main matches authoritative remote: $localMain"

  $smokePath = Join-Path $RepoPath "scripts\FULL_SMOKE_POWERSHELL.ps1"
  if (-not (Test-Path $smokePath)) {
    Fail "Smoke script missing after synchronization: $smokePath"
  }

  $changedSmoke = git diff --name-only HEAD -- scripts/FULL_SMOKE_POWERSHELL.ps1
  if ($changedSmoke) {
    Fail "Smoke script differs from the verified main commit."
  }
  Pass "Current smoke script verified"

  Write-Host ""
  Write-Host "==> Starting FULL smoke from the verified commit" -ForegroundColor Cyan

  $args = @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", $smokePath,
    "-RepoPath", $RepoPath,
    "-Port", [string]$Port,
    "-AfterSyncRelaunch"
  )
  if ($ProductionUrl) { $args += @("-ProductionUrl", $ProductionUrl) }
  if ($SkipAuthenticatedDataSmoke) { $args += "-SkipAuthenticatedDataSmoke" }
  if ($SkipProductionProbe) { $args += "-SkipProductionProbe" }

  & $pwshExe @args
  $smokeExit = $LASTEXITCODE

  if ($smokeExit -ne 0) {
    Fail "Full smoke returned exit code $smokeExit."
  }

  Write-Host ""
  Pass "Canonical PCC smoke completed"
}
finally {
  if ($autoStashedGitignore) {
    Write-Host ""
    Write-Host "==> Restoring local .gitignore change" -ForegroundColor Cyan
    $stashList = @(git stash list)
    $match = $stashList | Where-Object { $_ -like "*$stashMessage*" } | Select-Object -First 1
    if ($match) {
      $stashRef = ($match -split ":")[0]
      git stash pop $stashRef | Out-Host
      if ($LASTEXITCODE -ne 0) {
        Write-Host "WARN - .gitignore stash could not be restored automatically. The stash was kept for manual recovery." -ForegroundColor Yellow
      }
      else {
        Pass ".gitignore restored"
      }
    }
  }
}
