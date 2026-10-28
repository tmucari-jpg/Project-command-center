# PCC local-only validation. No link, push, reset, deployment or production queries.
[CmdletBinding()]
param([switch]$StartApp)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$app = Join-Path $repo 'application'
$results = [System.Collections.Generic.List[object]]::new()
$reportDirectory = Join-Path $repo 'tmp/local-validation'
New-Item -ItemType Directory -Force -Path $reportDirectory | Out-Null
$reportPath = Join-Path $reportDirectory ("PCC-validation-{0}-{1}.json" -f (Get-Date -Format 'yyyyMMdd-HHmmss'),[guid]::NewGuid().ToString('N').Substring(0,8))
$names = @('NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','NEXT_PUBLIC_SITE_URL','PCC_ARTIFACT_GENERATION_ENABLED','PCC_GROQ_FREE_TIER','OPENAI_API_KEY','QWEN_API_KEY','GROQ_API_KEY','GEMINI_API_KEY','GOOGLE_API_KEY','GEMINI_MODEL','PCC_GEMINI_FREE_TIER','PCC_GEMINI_DATA_PROCESSING_ACCEPTED','MOONSHOT_API_KEY','N8N_WEBHOOK_URL','BRAVE_SEARCH_API_KEY','PCC_ADMIN_EMAILS')
$saved = @{}
$locationPushed = $false
$completed = $false
function Record([string]$Name,[string]$State,[string]$Detail) { $results.Add([pscustomobject]@{name=$Name;status=$State;detail=$Detail}) }
function Run-Checked([string]$Command,[string[]]$Arguments,[string]$Label) {
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) { Record $Label 'failed' "Exit code: $LASTEXITCODE"; throw "Falhou: $Label" }
  Record $Label 'passed' 'Processo terminou sem erro.'
}
try {
  if ($PSVersionTable.PSVersion.Major -lt 7) { throw 'Use PowerShell 7 (pwsh).' }
  foreach ($command in @('node','npm','npx','docker')) {
    if (-not (Get-Command $command -ErrorAction SilentlyContinue)) { throw "Requisito indisponivel: $command" }
  }
  if ((& node -p 'process.versions.node.split(".")[0]') -ne '24') { throw 'Esta baseline exige Node 24.' }
  # Next.js can reload secrets from dotenv when process values are blank: reject such files.
  foreach ($directory in @($repo,$app)) {
    foreach ($filename in @('.env','.env.local','.env.development','.env.development.local','.env.production','.env.production.local','.env.test','.env.test.local')) {
      if (Test-Path (Join-Path $directory $filename)) { throw "Ficheiro de ambiente existente: $filename. Use uma copia de testes sem ficheiros dotenv; nao foi alterado nenhum ficheiro." }
    }
  }
  if ($env:DOCKER_HOST -and $env:DOCKER_HOST -notmatch '^(unix://|npipe://)') { throw 'DOCKER_HOST remoto recusado.' }
  $context = (& docker context inspect | ConvertFrom-Json)[0]
  if ($LASTEXITCODE -ne 0 -or $context.Endpoints.docker.Host -notmatch '^(unix://|npipe://)') { throw 'Use um motor Docker local (socket Unix ou named pipe).' }
  Run-Checked 'docker' @('info','--format','{{.ServerVersion}}') 'docker-engine'
  $network = 'pcc-local-validation'
  $networkJson = & docker network inspect $network 2>$null
  if ($LASTEXITCODE -ne 0) { Run-Checked 'docker' @('network','create','-o','com.docker.network.bridge.host_binding_ipv4=127.0.0.1',$network) 'local-network-create' }
  else {
    $networkInfo = ($networkJson | ConvertFrom-Json)[0]
    if ($networkInfo.Options.'com.docker.network.bridge.host_binding_ipv4' -ne '127.0.0.1') { throw 'Rede existente sem restricao loopback. Nenhuma rede foi eliminada.' }
  }
  foreach ($name in $names) { $saved[$name] = [Environment]::GetEnvironmentVariable($name,'Process'); [Environment]::SetEnvironmentVariable($name,'','Process') }
  Push-Location $repo; $locationPushed = $true
  Run-Checked 'npx' @('--yes','supabase@2.122.0','start','--network-id',$network) 'supabase-local-start'
  $raw = & npx --yes supabase@2.122.0 status --output json
  if ($LASTEXITCODE -ne 0) { throw 'Estado local indisponivel.' }
  $status = ($raw -join "`n") | ConvertFrom-Json
  $url = [string]$status.API_URL; $uri = [Uri]$url
  if ($uri.Scheme -ne 'http' -or $uri.Host -notin @('127.0.0.1','localhost') -or $uri.Port -ne 54321) { throw 'Backend recusado: apenas loopback:54321.' }
  # Existing local stacks also need pending migrations; never reset or apply remotely.
  Run-Checked 'npx' @('--yes','supabase@2.122.0','migration','up','--local') 'local-migrations'
  $key = [string]$status.PUBLISHABLE_KEY
  if (-not $key) { $key = [string]$status.ANON_KEY }
  if (-not $key) { throw 'Chave publica local em falta.' }
  $env:NEXT_PUBLIC_SUPABASE_URL = $url
  $env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = $key
  $env:NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'
  $env:PCC_ARTIFACT_GENERATION_ENABLED = 'true'
  $env:PCC_GROQ_FREE_TIER = 'false'
  $env:PCC_GEMINI_FREE_TIER = 'false'
  $env:PCC_GEMINI_DATA_PROCESSING_ACCEPTED = 'false'
  $health = Invoke-WebRequest -Uri "$url/auth/v1/health" -Headers @{apikey=$key} -TimeoutSec 20
  if ($health.StatusCode -ne 200) { throw 'Auth local indisponivel.' }
  Record 'auth-health' 'passed' 'HTTP 200; nao equivale a login autenticado.'
  Push-Location $app
  try {
    Run-Checked 'npm' @('ci') 'dependencies'
    foreach ($check in @('typecheck','test','lint','icons:validate','ui:standard','build')) { Run-Checked 'npm' @('run',$check) $check }
    Run-Checked 'npm' @('audit','--omit=dev','--audit-level=moderate') 'dependency-audit'
  } finally { Pop-Location }
  $completed = $true
} catch {
  Record 'orchestration' 'blocked' $_.Exception.Message
  Write-Warning $_.Exception.Message
} finally {
  foreach ($pending in @('authenticated-auth-storage-e2e','physical-device-installation','webgpu-inference','full-backup-restore')) { Record $pending 'blocked' 'Necessita de execucao e evidencia propria; nao foi presumido PASS.' }
  [pscustomobject]@{createdAt=(Get-Date -Format o);scope='local-only';automatedChecksCompleted=$completed;fullyValidated=$false;checks=@($results.ToArray())} | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $reportPath -Encoding utf8
  Write-Host "Relatorio: $reportPath"
  if ($locationPushed) { Pop-Location }
}
try {
  if ($completed -and $StartApp) {
    Push-Location $app
    try { Run-Checked 'npm' @('run','dev','--','--hostname','127.0.0.1') 'dev-server' } finally { Pop-Location }
  }
} finally {
  foreach ($name in $saved.Keys) { [Environment]::SetEnvironmentVariable($name,$saved[$name],'Process') }
}
if (-not $completed) { exit 1 }
