# PCC full smoke - PowerShell only, safe for Windows PowerShell 5+
param(
  [string]$RepoPath = "D:\03_PROJECTS\Project-Command-Center",
  [int]$Port = 3000,
  [string]$ProductionUrl = "",
  [switch]$SkipAuthenticatedDataSmoke,
  [switch]$SkipProductionProbe
)

$ErrorActionPreference = "Stop"

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

  Write-Step "2/12 Sync main safely"

  git fetch origin
  if ($LASTEXITCODE -ne 0) { Stop-WithError "git fetch failed." }

  git checkout main
  if ($LASTEXITCODE -ne 0) { Stop-WithError "Could not checkout main." }

  git pull --ff-only origin main
  if ($LASTEXITCODE -ne 0) {
    Stop-WithError "git pull --ff-only failed. No reset or force operation was used."
  }

  $releaseCommit = (git rev-parse HEAD).Trim()
  Write-Pass "main synchronized at $releaseCommit"

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

  $appPath = Join-Path $RepoPath "application"
  $envPath = Join-Path $appPath ".env.local"

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

  Set-Location $appPath

  Write-Step "4/12 Install and run all CI-equivalent checks"

  npm ci
  if ($LASTEXITCODE -ne 0) { Stop-WithError "npm ci failed." }

  npm run ui:standard
  if ($LASTEXITCODE -ne 0) { Stop-WithError "UI standard validation failed." }

  npm run typecheck
  if ($LASTEXITCODE -ne 0) { Stop-WithError "Typecheck failed." }

  npm test
  if ($LASTEXITCODE -ne 0) { Stop-WithError "Automated tests failed." }

  npm run lint
  if ($LASTEXITCODE -ne 0) { Stop-WithError "Lint failed." }

  npm audit --omit=dev --audit-level=high
  if ($LASTEXITCODE -ne 0) { Stop-WithError "Production dependency audit failed." }

  npm run build
  if ($LASTEXITCODE -ne 0) { Stop-WithError "Production build failed." }

  Write-Pass "CI-equivalent validation complete"

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

    $projects = @(Invoke-SupabaseRest -BaseUrl $supabaseUrl -ApiKey $supabaseKey -AccessToken $accessToken -Path "projects?select=id,title,status,progress,owner_id,next_action,next_review_date,review_cadence_days,governance_gate,governance_gate_status&order=created_at.desc")

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

    $deliverables = @(Invoke-SupabaseRest -BaseUrl $supabaseUrl -ApiKey $supabaseKey -AccessToken $accessToken -Path "deliverables?select=id,project_id,title,status,owner_id")
    $missingOwner = @($deliverables | Where-Object { -not $_.owner_id })

    if ($missingOwner.Count -gt 0) {
      Stop-WithError "$($missingOwner.Count) deliverable(s) without owner detected."
    }

    Write-Pass "Deliverable ownership integrity"

    $blockingDeps = @(Invoke-SupabaseRest -BaseUrl $supabaseUrl -ApiKey $supabaseKey -AccessToken $accessToken -Path "project_governance_dependencies?select=id,project_id,status,kind,blocks_progress&blocks_progress=eq.true&status=in.(pending,resolving)")

    if ($blockingDeps.Count -gt 0) {
      Stop-WithError "$($blockingDeps.Count) blocking governance dependency/dependencies detected."
    }

    Write-Pass "No blocking governance dependencies"

    $actions = @(Invoke-SupabaseRest -BaseUrl $supabaseUrl -ApiKey $supabaseKey -AccessToken $accessToken -Path "actions?select=id,project_id,title,status,due_at,is_next_action")
    $blockers = @(Invoke-SupabaseRest -BaseUrl $supabaseUrl -ApiKey $supabaseKey -AccessToken $accessToken -Path "blockers?select=id,project_id,title,status")
    $evidence = @(Invoke-SupabaseRest -BaseUrl $supabaseUrl -ApiKey $supabaseKey -AccessToken $accessToken -Path "evidence?select=id,project_id,title,evidence_type")
    $metrics = @(Invoke-SupabaseRest -BaseUrl $supabaseUrl -ApiKey $supabaseKey -AccessToken $accessToken -Path "metrics?select=id,project_id,name,current_value,target_value")
    $providers = @(Invoke-SupabaseRest -BaseUrl $supabaseUrl -ApiKey $supabaseKey -AccessToken $accessToken -Path "ai_provider_profiles?select=id,provider,label,enabled,last_health_status,mode,model_hint")

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

  try {
    Stop-Transcript | Out-Null
  }
  catch {}
}
