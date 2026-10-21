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
    Stop-WithError "Release changed locally during validation at $Checkpoint. Expected=$ExpectedCommit Local=$localCommit"
  }

  $remoteLine = git ls-remote origin refs/heads/main
  if ($LASTEXITCODE -ne 0 -or -not $remoteLine) {
    Stop-WithError "Could not verify authoritative origin/main at checkpoint $Checkpoint."
  }
  $remoteCommit = ($remoteLine -split "\s+")[0].Trim()

  if ($remoteCommit -ne $ExpectedCommit) {
    Stop-WithError "Release changed during validation at $Checkpoint. Expected=$ExpectedCommit Remote=$remoteCommit. Restart smoke on the new verified commit."
  }

  Write-Pass "Release lock intact at $Checkpoint -> $ExpectedCommit"
}


function Get-EnvFileValue([string]$Path, [string]$Name) {
  if (-not (Test-Path $Path)) { return $null }
  $pattern = "^\s*" + [regex]::Escape($Name) + "\s*=\s*(.*)\s*$"

  foreach ($line in Get-Content $Path) {
    if ($line -match $pattern) {
      $value = $Matches[1].Trim()
      if (
        ($value.StartsWith('"') -and $value.EndsWith('"')) -or
        ($value.StartsWith("'") -and $value.EndsWith("'"))
      ) {
        $value = $value.Substring(1, $value.Length - 2)
      }
      return $value
    }
  }

  return $null
}

function Invoke-Status(
  [string]$Uri,
  [string]$Method = "GET",
  [string]$Body = $null,
  [hashtable]$Headers = $null
) {
  try {
    $args = @{
      Uri = $Uri
      Method = $Method
      MaximumRedirection = 0
      UseBasicParsing = $true
      ErrorAction = "Stop"
    }

    if ($Headers) { $args.Headers = $Headers }
    if ($Body -ne $null) {
      $args.Body = $Body
      $args.ContentType = "application/json"
    }

    $response = Invoke-WebRequest @args
    return @{
      Status = [int]$response.StatusCode
      Headers = $response.Headers
      Content = $response.Content
    }
  }
  catch {
    $response = $_.Exception.Response
    if ($response) {
      $status = $null
      try { $status = [int]$response.StatusCode } catch {}
      $location = $null
      try { $location = $response.Headers["Location"] } catch {}

      return @{
        Status = $status
        Headers = @{ Location = $location }
        Content = ""
      }
    }
    throw
  }
}

function Assert-Status([string]$Label, [hashtable]$Result, [int[]]$Allowed) {
  if ($Allowed -notcontains $Result.Status) {
    Stop-WithError "$Label returned HTTP $($Result.Status); expected one of $($Allowed -join ', ')."
  }
  Write-Pass "$Label -> HTTP $($Result.Status)"
}

function Assert-ProtectedRedirect([string]$BaseUrl, [string]$Path) {
  $result = Invoke-Status -Uri ($BaseUrl.TrimEnd("/") + $Path)

  if (@(301,302,303,307,308) -notcontains $result.Status) {
    Stop-WithError "$Path did not redirect without authentication. HTTP $($result.Status)"
  }

  $location = $null
  if ($result.Headers -and $result.Headers.ContainsKey("Location")) {
    $location = [string]$result.Headers["Location"]
  }

  if ($location -and $location -notmatch "/auth/login") {
    Stop-WithError "$Path redirected to unexpected location: $location"
  }

  Write-Pass "$Path protected"
}

function Convert-SecureToPlain([Security.SecureString]$Secure) {
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  }
  finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
}


function Invoke-NpmProcess(
  [string]$Label,
  [string[]]$Arguments,
  [string]$WorkingDirectory
) {
  $npmCmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if (-not $npmCmd) {
    Stop-WithError "npm.cmd was not found in PATH."
  }

  $safeLabel = ($Label -replace '[^A-Za-z0-9._-]', '-').Trim('-')
  $stdoutPath = Join-Path $script:backupRoot "npm-$($script:stamp)-$safeLabel.out.log"
  $stderrPath = Join-Path $script:backupRoot "npm-$($script:stamp)-$safeLabel.err.log"

  Write-Host "RUN  - $Label" -ForegroundColor Cyan

  Clear-SmokePort -Port $Port -RepoPath $RepoPath

  $startArgs = @{
    FilePath = $npmCmd.Source
    ArgumentList = $Arguments
    WorkingDirectory = $WorkingDirectory
    RedirectStandardOutput = $stdoutPath
    RedirectStandardError = $stderrPath
    PassThru = $true
    WindowStyle = "Hidden"
  }

  $process = Start-Process @startArgs
  $started = Get-Date
  $lastHeartbeat = -10

  while (-not $process.HasExited) {
    Start-Sleep -Seconds 2
    $process.Refresh()
    $elapsed = [int]((Get-Date) - $started).TotalSeconds
    if (($elapsed - $lastHeartbeat) -ge 10) {
      Write-Host "      $Label still running... ${elapsed}s" -ForegroundColor DarkGray
      $lastHeartbeat = $elapsed
    }
  }

  $exitCode = [int]$process.ExitCode

  if ($exitCode -eq 0) {
    Write-Pass "$Label"
    $tail = @(Get-Content $stdoutPath -Tail 8 -ErrorAction SilentlyContinue)
    if ($tail.Count -gt 0) {
      $tail | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }
    }
  }
  else {
    Write-Host "FAIL - $Label exited with code $exitCode" -ForegroundColor Red
    Write-Host "      stdout: $stdoutPath" -ForegroundColor Yellow
    Write-Host "      stderr: $stderrPath" -ForegroundColor Yellow

    $outTail = @(Get-Content $stdoutPath -Tail 60 -ErrorAction SilentlyContinue)
    $errTail = @(Get-Content $stderrPath -Tail 60 -ErrorAction SilentlyContinue)

    if ($outTail.Count -gt 0) {
      Write-Host "---- npm stdout tail ----" -ForegroundColor Yellow
      $outTail | ForEach-Object { Write-Host $_ }
    }
    if ($errTail.Count -gt 0) {
      Write-Host "---- npm stderr tail ----" -ForegroundColor Yellow
      $errTail | ForEach-Object { Write-Host $_ }
    }
  }

  return $exitCode
}

function New-IsolatedValidationWorktree(
  [string]$RepoPath,
  [string]$ReleaseCommit,
  [string]$WorktreePath,
  [string]$SourceEnvPath
) {
  $parent = Split-Path $WorktreePath -Parent
  New-Item -ItemType Directory -Force -Path $parent | Out-Null

  if (Test-Path $WorktreePath) {
    Stop-WithError "Isolated validation path already exists: $WorktreePath"
  }

  Write-Host "INFO - Creating isolated validation worktree: $WorktreePath" -ForegroundColor Yellow
  & git -C $RepoPath worktree add --detach $WorktreePath $ReleaseCommit | Out-Host
  if ($LASTEXITCODE -ne 0) {
    Stop-WithError "Could not create isolated validation worktree at $WorktreePath."
  }

  $appPath = Join-Path $WorktreePath "application"
  if (-not (Test-Path $appPath)) {
    Stop-WithError "Isolated validation worktree does not contain application/: $WorktreePath"
  }

  if ($SourceEnvPath -and (Test-Path $SourceEnvPath)) {
    Copy-Item $SourceEnvPath (Join-Path $appPath ".env.local") -Force
  }

  return $appPath
}

function Stop-ProcessesForPath([string]$Path) {
  if (-not $Path) { return }

  try {
    $escapedPath = [regex]::Escape($Path)
    $matches = @(
      Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object {
          $_.ProcessId -ne $PID -and
          $_.CommandLine -and
          $_.CommandLine -match $escapedPath
        }
    )

    foreach ($proc in $matches) {
      Write-Warn "Stopping process PID $($proc.ProcessId) using isolated worktree: $($proc.Name)"
      & taskkill.exe /PID $proc.ProcessId /T /F 2>$null | Out-Null
    }

    if ($matches.Count -gt 0) {
      Start-Sleep -Seconds 2
    }
  }
  catch {
    Write-Warn "Could not enumerate/stop processes using isolated worktree: $($_.Exception.Message)"
  }
}

function Remove-IsolatedValidationWorktree(
  [string]$RepoPath,
  [string]$WorktreePath
) {
  if (-not $WorktreePath) { return }

  for ($attempt = 1; $attempt -le 3; $attempt++) {
    & git -C $RepoPath worktree remove --force $WorktreePath 2>$null
    if ($LASTEXITCODE -eq 0) {
      Write-Pass "Removed isolated validation worktree: $WorktreePath"
      return
    }
    Start-Sleep -Seconds 2
  }

  try { & git -C $RepoPath worktree prune | Out-Null } catch {}
  Write-Warn "Could not fully remove isolated validation worktree after 3 attempts: $WorktreePath"
}

function Initialize-IsolatedValidationApp(
  [string]$RepoPath,
  [string]$ReleaseCommit,
  [string]$SourceEnvPath,
  [string]$Label
) {
  $tempBase = Join-Path ([System.IO.Path]::GetTempPath()) "PCC_SMOKE"
  New-Item -ItemType Directory -Force -Path $tempBase | Out-Null
  $worktreePath = Join-Path $tempBase ("$($script:stamp)-" + $Label)

  $appPath = New-IsolatedValidationWorktree -RepoPath $RepoPath -ReleaseCommit $ReleaseCommit -WorktreePath $worktreePath -SourceEnvPath $SourceEnvPath
  $script:validationWorktrees += $worktreePath

  return @{ WorktreePath = $worktreePath; AppPath = $appPath }
}

function Invoke-IsolatedNpmCi(
  [string]$RepoPath,
  [string]$ReleaseCommit,
  [string]$SourceEnvPath
) {
  $first = Initialize-IsolatedValidationApp -RepoPath $RepoPath -ReleaseCommit $ReleaseCommit -SourceEnvPath $SourceEnvPath -Label "primary"
  $firstExit = Invoke-NpmProcess -Label "4.1 npm ci - isolated primary" -Arguments @("ci") -WorkingDirectory $first.AppPath

  if ($firstExit -eq 0) {
    return $first
  }

  Write-Warn "Primary isolated npm ci failed. The partial worktree will not be repaired or reused."
  Write-Warn "Creating one completely fresh isolated worktree for the single retry."

  $second = Initialize-IsolatedValidationApp -RepoPath $RepoPath -ReleaseCommit $ReleaseCommit -SourceEnvPath $SourceEnvPath -Label "retry"
  $secondExit = Invoke-NpmProcess -Label "4.1 npm ci - isolated retry" -Arguments @("ci") -WorkingDirectory $second.AppPath

  if ($secondExit -ne 0) {
    Stop-WithError "npm ci failed in two independent clean worktrees. This is no longer treated as a stale node_modules problem."
  }

  Write-Pass "npm ci succeeded in fresh isolated retry worktree"
  return $second
}

function Clear-SmokePort([int]$Port, [string]$RepoPath) {
  try {
    $listeners = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
  }
  catch {
    $listeners = @()
  }

  if ($listeners.Count -eq 0) {
    Write-Pass "Port $Port is free before runtime start"
    return
  }

  foreach ($listener in $listeners) {
    $ownerPid = [int]$listener.OwningProcess
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$ownerPid" -ErrorAction SilentlyContinue
    $commandLine = if ($proc) { [string]$proc.CommandLine } else { "" }

    if ($commandLine -like "*PCC_SMOKE*" -or $commandLine -like "*$RepoPath*") {
      Write-Warn "Port $Port is held by stale PCC runtime PID $ownerPid. Terminating its process tree."
      & taskkill.exe /PID $ownerPid /T /F 2>$null | Out-Null
      Start-Sleep -Seconds 2
    }
    else {
      Stop-WithError "Port $Port is already in use by unrelated PID $ownerPid. CommandLine=$commandLine"
    }
  }

  $remaining = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
  if ($remaining.Count -gt 0) {
    Stop-WithError "Port $Port is still occupied after PCC stale-runtime cleanup."
  }

  Write-Pass "Port $Port cleared for current smoke runtime"
}

function ConvertTo-RestRows([object]$Response) {
  if ($null -eq $Response) {
    return @()
  }

  if ($Response -is [System.Array]) {
    return @($Response | ForEach-Object { $_ })
  }

  return @($Response)
}

function Invoke-SupabaseRest(
  [string]$BaseUrl,
  [string]$ApiKey,
  [string]$AccessToken,
  [string]$Path,
  [string]$Method = "GET",
  [object]$Payload = $null,
  [string]$Prefer = $null
) {
  $headers = @{
    apikey = $ApiKey
    Authorization = "Bearer $AccessToken"
    Accept = "application/json"
  }

  if ($Prefer) { $headers.Prefer = $Prefer }

  $args = @{
    Uri = ($BaseUrl.TrimEnd("/") + "/rest/v1/" + $Path)
    Method = $Method
    Headers = $headers
    ErrorAction = "Stop"
  }

  if ($Payload -ne $null) {
    $args.ContentType = "application/json"
    $args.Body = ($Payload | ConvertTo-Json -Depth 12 -Compress)
  }

  return Invoke-RestMethod @args
}

if (-not (Test-Path $RepoPath)) {
  Stop-WithError "Repository not found: $RepoPath"
}

Set-Location $RepoPath

if (-not (Test-Path ".git")) {
  Stop-WithError "$RepoPath is not a Git repository."
}

$backupRoot = "D:\07_BACKUPS\PROJECT_COMMAND_CENTER_RUNTIME"
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$reportFile = Join-Path $backupRoot "full-smoke-$stamp.txt"

Start-Transcript -Path $reportFile -Force | Out-Null

$runtimeProcess = $null
$smokeActionId = $null
$supabaseUrl = $null
$supabaseKey = $null
$accessToken = $null
$validationWorktrees = @()

try {
  Write-Step "1/12 Validate repository state"

  $dirty = git status --porcelain
  if ($dirty) {
    Write-Host "Local uncommitted changes were found:" -ForegroundColor Yellow
    $dirty | ForEach-Object { Write-Host "  $_" }
    Stop-WithError "Smoke stopped to avoid overwriting local work."
  }

  $beforeCommit = (git rev-parse HEAD).Trim()
  Write-Host "Current commit: $beforeCommit"

  Write-Step "2/12 Verify locked release"

  if ($ExpectedReleaseCommit) {
    $branchName = (git rev-parse --abbrev-ref HEAD).Trim()
    if ($branchName -ne "main") {
      Stop-WithError "Locked smoke must run on main. Current branch: $branchName"
    }

    $localCommit = (git rev-parse HEAD).Trim()
    if ($localCommit -ne $ExpectedReleaseCommit) {
      Stop-WithError "Local release differs from launcher lock. Expected=$ExpectedReleaseCommit Local=$localCommit"
    }

    $remoteLine = git ls-remote origin refs/heads/main
    if ($LASTEXITCODE -ne 0 -or -not $remoteLine) {
      Stop-WithError "Could not read authoritative origin/main SHA."
    }
    $remoteMain = ($remoteLine -split "\s+")[0].Trim()

    if ($remoteMain -ne $ExpectedReleaseCommit) {
      Stop-WithError "Release changed before validation started. Expected=$ExpectedReleaseCommit Remote=$remoteMain. Restart via RUN_PCC_SMOKE.ps1."
    }

    $releaseCommit = $ExpectedReleaseCommit
    Write-Pass "Release locked at $releaseCommit"
  }
  else {
    Write-Warn "No launcher release lock supplied. Running compatibility synchronization for direct invocation."

    $remoteLine = git ls-remote origin refs/heads/main
    if ($LASTEXITCODE -ne 0 -or -not $remoteLine) {
      Stop-WithError "Could not read the authoritative origin/main SHA."
    }
    $remoteMain = ($remoteLine -split "\s+")[0].Trim()

    git fetch --prune origin "+refs/heads/main:refs/remotes/origin/main"
    if ($LASTEXITCODE -ne 0) { Stop-WithError "git fetch of authoritative main failed." }

    $trackingMain = (git rev-parse origin/main).Trim()
    if ($trackingMain -ne $remoteMain) {
      Stop-WithError "origin/main is stale after fetch. Remote=$remoteMain tracking=$trackingMain"
    }

    git checkout main
    if ($LASTEXITCODE -ne 0) { Stop-WithError "Could not checkout main." }

    git merge --ff-only origin/main
    if ($LASTEXITCODE -ne 0) {
      Stop-WithError "Fast-forward to authoritative origin/main failed. No reset or force operation was used."
    }

    $releaseCommit = (git rev-parse HEAD).Trim()
    if ($releaseCommit -ne $remoteMain) {
      Stop-WithError "Local main is not the authoritative remote main. Local=$releaseCommit remote=$remoteMain"
    }

    Write-Pass "main synchronized and verified at $releaseCommit"

    if ($releaseCommit -ne $beforeCommit -and -not $AfterSyncRelaunch) {
      Write-Warn "The repository changed during this run. Relaunching the UPDATED smoke script from disk so an old in-memory script cannot continue."
      try { Stop-Transcript | Out-Null } catch {}

      $relaunchArgs = @(
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-File", $PSCommandPath,
        "-RepoPath", $RepoPath,
        "-Port", [string]$Port,
        "-AfterSyncRelaunch",
        "-ExpectedReleaseCommit", $releaseCommit
      )
      if ($ProductionUrl) { $relaunchArgs += @("-ProductionUrl", $ProductionUrl) }
      if ($SkipAuthenticatedDataSmoke) { $relaunchArgs += "-SkipAuthenticatedDataSmoke" }
      if ($SkipProductionProbe) { $relaunchArgs += "-SkipProductionProbe" }

      & $pwshExe @relaunchArgs
      exit $LASTEXITCODE
    }
  }

  Assert-ReleaseUnchanged -ExpectedCommit $releaseCommit -Checkpoint "pre-runtime"

  Write-Step "3/12 Validate runtime and environment"

  $node = Get-Command node -ErrorAction SilentlyContinue
  $npm = Get-Command npm -ErrorAction SilentlyContinue

  if (-not $node) { Stop-WithError "Node.js was not found in PATH." }
  if (-not $npm) { Stop-WithError "npm was not found in PATH." }

  $nodeVersion = (& node -v).Trim()
  $npmVersion = (& npm -v).Trim()

  Write-Host "Node: $nodeVersion"
  Write-Host "npm:  $npmVersion"

  $major = [int](($nodeVersion -replace '^v','').Split('.')[0])
  if ($major -lt 22) {
    Stop-WithError "Node $nodeVersion is below the minimum expected version 22."
  }

  $sourceAppPath = Join-Path $RepoPath "application"
  $envPath = Join-Path $sourceAppPath ".env.local"

  if (-not (Test-Path $envPath)) {
    Stop-WithError "application\.env.local is missing."
  }

  $requiredPublicEnv = @(
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
  )

  foreach ($key in $requiredPublicEnv) {
    $value = Get-EnvFileValue -Path $envPath -Name $key
    if (-not $value) { Stop-WithError "$key is missing from .env.local." }
    Write-Pass "$key present"
  }

  $supabaseUrl = Get-EnvFileValue -Path $envPath -Name "NEXT_PUBLIC_SUPABASE_URL"
  $supabaseKey = Get-EnvFileValue -Path $envPath -Name "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"

  if (-not $ProductionUrl) {
    $ProductionUrl = Get-EnvFileValue -Path $envPath -Name "NEXT_PUBLIC_SITE_URL"
  }

  Set-Location $RepoPath

  Write-Step "4/12 Install and run all CI-equivalent checks in isolated release worktree"

  $isolated = Invoke-IsolatedNpmCi -RepoPath $RepoPath -ReleaseCommit $releaseCommit -SourceEnvPath $envPath
  $appPath = [string]$isolated.AppPath
  Write-Pass "CI validation isolated from operator working copy"

  $exit = Invoke-NpmProcess -Label "4.2 UI standard" -Arguments @("run","ui:standard") -WorkingDirectory $appPath
  if ($exit -ne 0) { Stop-WithError "UI standard validation failed with exit code $exit." }

  $exit = Invoke-NpmProcess -Label "4.3 typecheck" -Arguments @("run","typecheck") -WorkingDirectory $appPath
  if ($exit -ne 0) { Stop-WithError "Typecheck failed with exit code $exit." }

  $exit = Invoke-NpmProcess -Label "4.4 tests" -Arguments @("test") -WorkingDirectory $appPath
  if ($exit -ne 0) { Stop-WithError "Automated tests failed with exit code $exit." }

  $exit = Invoke-NpmProcess -Label "4.5 lint" -Arguments @("run","lint") -WorkingDirectory $appPath
  if ($exit -ne 0) { Stop-WithError "Lint failed with exit code $exit." }

  $exit = Invoke-NpmProcess -Label "4.6 production dependency audit" -Arguments @("audit","--omit=dev","--audit-level=high") -WorkingDirectory $appPath
  if ($exit -ne 0) { Stop-WithError "Production dependency audit failed with exit code $exit." }

  $exit = Invoke-NpmProcess -Label "4.7 build" -Arguments @("run","build") -WorkingDirectory $appPath
  if ($exit -ne 0) { Stop-WithError "Production build failed with exit code $exit." }

  Write-Pass "CI-equivalent validation complete"
  Assert-ReleaseUnchanged -ExpectedCommit $releaseCommit -Checkpoint "post-CI"

  Write-Step "5/12 Start production-mode local runtime"

  $stdout = Join-Path $backupRoot "full-smoke-$stamp.out.log"
  $stderr = Join-Path $backupRoot "full-smoke-$stamp.err.log"

  $npmCmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if (-not $npmCmd) {
    $npmCmd = Get-Command npm -ErrorAction SilentlyContinue
  }

  if (-not $npmCmd) {
    Stop-WithError "npm executable was not found."
  }

  $startArgs = @{
    FilePath = $npmCmd.Source
    ArgumentList = @("run","start","--","-p",$Port)
    WorkingDirectory = $appPath
    RedirectStandardOutput = $stdout
    RedirectStandardError = $stderr
    PassThru = $true
  }

  $runtimeProcess = Start-Process @startArgs
  $baseLocal = "http://127.0.0.1:$Port"
  $ready = $false

  for ($i = 0; $i -lt 45; $i++) {
    Start-Sleep -Seconds 1
    $runtimeProcess.Refresh()
    if ($runtimeProcess.HasExited) {
      Stop-WithError "Current runtime process exited before readiness (exit code $($runtimeProcess.ExitCode)). See $stderr"
    }
    try {
      $probe = Invoke-Status -Uri "$baseLocal/auth/login"
      if ($probe.Status -eq 200) {
        $ready = $true
        break
      }
    }
    catch {}
  }

  if (-not $ready) {
    Stop-WithError "Local production runtime did not become ready. See $stderr"
  }

  Write-Pass "Local production runtime ready"

  Write-Step "6/12 Smoke public and PWA assets"

  Assert-Status "Login page" (Invoke-Status "$baseLocal/auth/login") @(200)
  Assert-Status "Offline page" (Invoke-Status "$baseLocal/offline.html") @(200)
  Assert-Status "Service worker" (Invoke-Status "$baseLocal/sw.js") @(200)
  Assert-Status "Web manifest" (Invoke-Status "$baseLocal/manifest.webmanifest") @(200)
  Assert-Status "PCC logo" (Invoke-Status "$baseLocal/brand/pcc-logo.png") @(200)

  Write-Step "7/12 Smoke all protected application routes"

  $protectedRoutes = @(
    "/dashboard",
    "/objectives",
    "/project-factory",
    "/projects",
    "/agenda",
    "/actions",
    "/deliverables",
    "/focus",
    "/blockers",
    "/metrics",
    "/decisions",
    "/evidence",
    "/admin",
    "/bot-ia",
    "/ai-providers",
    "/agents",
    "/orchestrator",
    "/automation",
    "/execution-arena"
  )

  foreach ($route in $protectedRoutes) {
    Assert-ProtectedRedirect -BaseUrl $baseLocal -Path $route
  }

  Write-Step "8/12 Smoke API authentication guards"

  Assert-Status "Offline bootstrap rejects anonymous access" (Invoke-Status "$baseLocal/api/offline/bootstrap") @(401)
  Assert-Status "Offline sync rejects anonymous access" (Invoke-Status "$baseLocal/api/offline/sync" "POST" '{"items":[]}') @(401)
  Assert-Status "AI assist rejects anonymous access" (Invoke-Status "$baseLocal/api/ai/assist") @(401)

  Write-Step "9/12 Probe production deployment"

  if ($SkipProductionProbe) {
    Write-Warn "Production probe skipped by parameter."
  }
  elseif (-not $ProductionUrl) {
    Write-Warn "NEXT_PUBLIC_SITE_URL not found and -ProductionUrl not supplied. Production HTTP probe skipped."
  }
  else {
    $prod = $ProductionUrl.TrimEnd("/")
    Assert-Status "Production login" (Invoke-Status "$prod/auth/login") @(200)
    Assert-Status "Production offline page" (Invoke-Status "$prod/offline.html") @(200)
    Assert-Status "Production service worker" (Invoke-Status "$prod/sw.js") @(200)
    Assert-ProtectedRedirect -BaseUrl $prod -Path "/dashboard"
    Assert-ProtectedRedirect -BaseUrl $prod -Path "/projects"
    Assert-ProtectedRedirect -BaseUrl $prod -Path "/bot-ia"
    Write-Pass "Production public/protection probe complete"
  }

  Assert-ReleaseUnchanged -ExpectedCommit $releaseCommit -Checkpoint "pre-authenticated-data"

  Write-Step "10/12 Authenticated Supabase and RLS smoke using real PCC data"

  if ($SkipAuthenticatedDataSmoke) {
    Write-Warn "Authenticated data smoke skipped by parameter."
  }
  else {
    Write-Host "Credentials are used only in this PowerShell process and are not written to the report." -ForegroundColor Yellow

    $email = Read-Host "PCC operator email"
    $securePassword = Read-Host "PCC operator password" -AsSecureString
    $plainPassword = Convert-SecureToPlain $securePassword

    try {
      $authHeaders = @{
        apikey = $supabaseKey
        "Content-Type" = "application/json"
      }

      $authBody = @{
        email = $email
        password = $plainPassword
      } | ConvertTo-Json -Compress

      $auth = Invoke-RestMethod -Uri ($supabaseUrl.TrimEnd("/") + "/auth/v1/token?grant_type=password") -Method Post -Headers $authHeaders -Body $authBody -ErrorAction Stop
    }
    finally {
      $plainPassword = $null
      $securePassword = $null
    }

    if (-not $auth.access_token -or -not $auth.user.id) {
      Stop-WithError "Authenticated Supabase smoke could not obtain a valid session."
    }

    $accessToken = [string]$auth.access_token
    $userId = [string]$auth.user.id
    Write-Pass "Operator authentication"

    $projectsResponse = Invoke-SupabaseRest -BaseUrl $supabaseUrl -ApiKey $supabaseKey -AccessToken $accessToken -Path "projects?select=id,title,status,progress,owner_id,next_action,next_review_date,review_cadence_days,governance_gate,governance_gate_status&order=created_at.desc"
    $projects = @(ConvertTo-RestRows -Response $projectsResponse)

    Write-Pass "Project RLS read returned $($projects.Count) row(s)"
    if ($projects.Count -gt 0) {
      Write-Host ("INFO - Project titles visible to operator: " + ((@($projects | ForEach-Object { [string]$_.title })) -join " | ")) -ForegroundColor DarkGray
    }

    $expectedProjects = @(
      "Gestor de Actividades",
      "Gestor de Vendas",
      "MAANA",
      "RHENGU",
      "Briefing Diario"
    )

    $normalizedTitles = @{}

    foreach ($p in $projects) {
      $key = ([string]$p.title).Normalize([Text.NormalizationForm]::FormD) -replace "\p{Mn}",""
      $normalizedTitles[$key] = $p
    }

    foreach ($expected in $expectedProjects) {
      if (-not $normalizedTitles.ContainsKey($expected)) {
        Stop-WithError "Expected real project not found: $expected"
      }
      Write-Pass "Real project present: $expected"
    }

    $deliverables = @(ConvertTo-RestRows -Response (Invoke-SupabaseRest -BaseUrl $supabaseUrl -ApiKey $supabaseKey -AccessToken $accessToken -Path "deliverables?select=id,project_id,title,status,owner_id"))
    $missingOwner = @($deliverables | Where-Object { -not $_.owner_id })

    if ($missingOwner.Count -gt 0) {
      Stop-WithError "$($missingOwner.Count) deliverable(s) without owner detected."
    }

    Write-Pass "Deliverable ownership integrity"

    $blockingDeps = @(ConvertTo-RestRows -Response (Invoke-SupabaseRest -BaseUrl $supabaseUrl -ApiKey $supabaseKey -AccessToken $accessToken -Path "project_governance_dependencies?select=id,project_id,status,kind,blocks_progress&blocks_progress=eq.true&status=in.(pending,resolving)"))

    if ($blockingDeps.Count -gt 0) {
      Stop-WithError "$($blockingDeps.Count) blocking governance dependency/dependencies detected."
    }

    Write-Pass "No blocking governance dependencies"

    $actions = @(ConvertTo-RestRows -Response (Invoke-SupabaseRest -BaseUrl $supabaseUrl -ApiKey $supabaseKey -AccessToken $accessToken -Path "actions?select=id,project_id,title,status,due_at,is_next_action"))
    $blockers = @(ConvertTo-RestRows -Response (Invoke-SupabaseRest -BaseUrl $supabaseUrl -ApiKey $supabaseKey -AccessToken $accessToken -Path "blockers?select=id,project_id,title,status"))
    $evidence = @(ConvertTo-RestRows -Response (Invoke-SupabaseRest -BaseUrl $supabaseUrl -ApiKey $supabaseKey -AccessToken $accessToken -Path "evidence?select=id,project_id,title,evidence_type"))
    $metrics = @(ConvertTo-RestRows -Response (Invoke-SupabaseRest -BaseUrl $supabaseUrl -ApiKey $supabaseKey -AccessToken $accessToken -Path "metrics?select=id,project_id,name,current_value,target_value"))
    $providers = @(ConvertTo-RestRows -Response (Invoke-SupabaseRest -BaseUrl $supabaseUrl -ApiKey $supabaseKey -AccessToken $accessToken -Path "ai_provider_profiles?select=id,provider,label,enabled,last_health_status,mode,model_hint"))

    Write-Pass "RLS reads: actions=$($actions.Count), blockers=$($blockers.Count), evidence=$($evidence.Count), metrics=$($metrics.Count), AI profiles=$($providers.Count)"

    $targetProject = $normalizedTitles["Gestor de Actividades"]
    $smokeActionId = [guid]::NewGuid().ToString()
    $smokeTitle = "[SMOKE] PowerShell $stamp"

    $actionPayload = @{
      id = $smokeActionId
      user_id = $userId
      project_id = $targetProject.id
      title = $smokeTitle
      description = "Temporary PCC full smoke action. Safe to delete."
      priority = "low"
      status = "pending"
      actual_minutes = 0
      is_next_action = $false
    }

    $created = @(Invoke-SupabaseRest -BaseUrl $supabaseUrl -ApiKey $supabaseKey -AccessToken $accessToken -Path "actions" -Method "POST" -Payload $actionPayload -Prefer "return=representation")

    if ($created.Count -ne 1 -or $created[0].id -ne $smokeActionId) {
      Stop-WithError "Temporary smoke action was not created correctly."
    }

    Write-Pass "Authenticated CREATE through RLS"

    $updated = @(Invoke-SupabaseRest -BaseUrl $supabaseUrl -ApiKey $supabaseKey -AccessToken $accessToken -Path ("actions?id=eq." + $smokeActionId) -Method "PATCH" -Payload @{ status = "in_progress" } -Prefer "return=representation")

    if ($updated.Count -ne 1 -or $updated[0].status -ne "in_progress") {
      Stop-WithError "Temporary smoke action was not updated correctly."
    }

    Write-Pass "Authenticated UPDATE through RLS"

    $readBack = @(Invoke-SupabaseRest -BaseUrl $supabaseUrl -ApiKey $supabaseKey -AccessToken $accessToken -Path ("actions?id=eq." + $smokeActionId + "&select=id,title,status,project_id"))

    if ($readBack.Count -ne 1 -or $readBack[0].project_id -ne $targetProject.id) {
      Stop-WithError "Temporary smoke action did not persist with the correct project relation."
    }

    Write-Pass "Authenticated persistence and project relation"

    Invoke-SupabaseRest -BaseUrl $supabaseUrl -ApiKey $supabaseKey -AccessToken $accessToken -Path ("actions?id=eq." + $smokeActionId) -Method "DELETE" -Prefer "return=minimal" | Out-Null

    $verifyDelete = @(Invoke-SupabaseRest -BaseUrl $supabaseUrl -ApiKey $supabaseKey -AccessToken $accessToken -Path ("actions?id=eq." + $smokeActionId + "&select=id"))

    if ($verifyDelete.Count -ne 0) {
      Stop-WithError "Temporary smoke action cleanup failed."
    }

    $smokeActionId = $null
    Write-Pass "Authenticated DELETE and cleanup through RLS"
  }

  Assert-ReleaseUnchanged -ExpectedCommit $releaseCommit -Checkpoint "post-authenticated-data"

  Write-Step "11/12 AI runtime configuration probe"

  $openAIKey = Get-EnvFileValue -Path $envPath -Name "OPENAI_API_KEY"
  $openAIModel = Get-EnvFileValue -Path $envPath -Name "OPENAI_MODEL"

  if ($openAIKey) {
    if (-not $openAIModel) {
      $openAIModel = "gpt-6-luna"
    }

    try {
      $aiHeaders = @{ Authorization = "Bearer $openAIKey" }
      $encodedModel = [uri]::EscapeDataString($openAIModel)
      $aiResult = Invoke-WebRequest -Uri ("https://api.openai.com/v1/models/" + $encodedModel) -Headers $aiHeaders -UseBasicParsing -ErrorAction Stop

      if ([int]$aiResult.StatusCode -eq 200) {
        Write-Pass "OpenAI credential/model probe: $openAIModel"
      }
      else {
        Write-Warn "OpenAI model probe returned HTTP $($aiResult.StatusCode)."
      }
    }
    catch {
      Write-Warn "OpenAI runtime probe failed: $($_.Exception.Message)"
    }
  }
  else {
    Write-Warn "OPENAI_API_KEY not found in .env.local; real AI runtime probe skipped."
  }

  Assert-ReleaseUnchanged -ExpectedCommit $releaseCommit -Checkpoint "final"

  Write-Step "12/12 Final result"

  Write-Host ""
  Write-Host "FULL PCC POWERSHELL SMOKE: PASS" -ForegroundColor Green
  Write-Host "Release commit: $releaseCommit"
  Write-Host "Report: $reportFile"
  Write-Host "Runtime stdout: $stdout"
  Write-Host "Runtime stderr: $stderr"
  Write-Host ""
  Write-Host "Validated:" -ForegroundColor Green
  Write-Host "- clean and safe Git synchronization"
  Write-Host "- npm ci, UI standard, typecheck, tests, lint, dependency audit and build"
  Write-Host "- production-mode local runtime"
  Write-Host "- login, PWA/offline assets and service worker"
  Write-Host "- protection of all major PCC routes"
  Write-Host "- authentication guards on offline and AI APIs"
  Write-Host "- production public/protection routes when configured"
  Write-Host "- authenticated Supabase session, RLS reads and temporary CRUD cleanup"
  Write-Host "- presence of the five real PCC projects"
  Write-Host "- deliverable ownership and blocking governance dependencies"
  Write-Host "- AI runtime credential/model probe when configured"
  Write-Host ""
  Write-Host "Pixel-level visual review and real phone rendering cannot be proven by HTTP-only PowerShell." -ForegroundColor Yellow
  Write-Host "They remain a separate visual acceptance item, not a functional smoke failure." -ForegroundColor Yellow
}
finally {
  if ($smokeActionId -and $supabaseUrl -and $supabaseKey -and $accessToken) {
    try {
      Invoke-SupabaseRest -BaseUrl $supabaseUrl -ApiKey $supabaseKey -AccessToken $accessToken -Path ("actions?id=eq." + $smokeActionId) -Method "DELETE" -Prefer "return=minimal" | Out-Null
      Write-Warn "Emergency cleanup removed the temporary smoke action."
    }
    catch {
      Write-Warn "Emergency cleanup could not remove temporary smoke action $smokeActionId."
    }
  }

  if ($runtimeProcess -and -not $runtimeProcess.HasExited) {
    Stop-Process -Id $runtimeProcess.Id -Force
  }

  foreach ($worktreePath in @($validationWorktrees | Select-Object -Unique)) {
    Stop-ProcessesForPath -Path $worktreePath
    Remove-IsolatedValidationWorktree -RepoPath $RepoPath -WorktreePath $worktreePath
  }

  try {
    Stop-Transcript | Out-Null
  }
  catch {}
}
