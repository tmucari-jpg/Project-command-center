param(
  [string]$RepoPath = "D:\03_PROJECTS\Project-Command-Center",
  [int]$Port = 3000
)

$ErrorActionPreference = "Stop"

function Write-Step([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Stop-WithError([string]$Message) {
  Write-Host ""
  Write-Host "ERRO: $Message" -ForegroundColor Red
  exit 1
}

Write-Step "Validar repositório"
if (-not (Test-Path $RepoPath)) {
  Stop-WithError "Repositório não encontrado em $RepoPath"
}

Set-Location $RepoPath

if (-not (Test-Path ".git")) {
  Stop-WithError "$RepoPath não é um repositório Git."
}

$dirty = git status --porcelain
if ($dirty) {
  Write-Host "Foram detectadas alterações locais não commitadas:" -ForegroundColor Yellow
  $dirty | ForEach-Object { Write-Host "  $_" }
  Stop-WithError "Sincronização interrompida para não sobrescrever trabalho local."
}

$currentBranch = (git branch --show-current).Trim()
$currentCommit = (git rev-parse HEAD).Trim()
Write-Host "Branch actual: $currentBranch"
Write-Host "Commit actual: $currentCommit"

Write-Step "Guardar ponto de recuperação"
$recoveryDir = Join-Path $RepoPath ".local-recovery"
New-Item -ItemType Directory -Force -Path $recoveryDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$recoveryFile = Join-Path $recoveryDir "before-sync-$stamp.txt"
@(
  "timestamp=$((Get-Date).ToString('o'))"
  "branch=$currentBranch"
  "commit=$currentCommit"
) | Set-Content -Encoding UTF8 $recoveryFile
Write-Host "Ponto de recuperação: $recoveryFile"

Write-Step "Sincronizar main por fast-forward"
git fetch origin
if ($LASTEXITCODE -ne 0) { Stop-WithError "git fetch falhou." }

git checkout main
if ($LASTEXITCODE -ne 0) { Stop-WithError "Não foi possível mudar para main." }

git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) {
  Stop-WithError "git pull --ff-only falhou. Não foi feito reset nem overwrite."
}

$finalCommit = (git rev-parse HEAD).Trim()
Write-Host "Commit sincronizado: $finalCommit" -ForegroundColor Green

Write-Step "Validar Node e npm"
$node = Get-Command node -ErrorAction SilentlyContinue
$npm = Get-Command npm -ErrorAction SilentlyContinue

if (-not $node) { Stop-WithError "Node.js não encontrado no PATH desta sessão." }
if (-not $npm) { Stop-WithError "npm não encontrado no PATH desta sessão." }

$nodeVersion = (& node -v).Trim()
$npmVersion = (& npm -v).Trim()
Write-Host "Node: $nodeVersion"
Write-Host "npm:  $npmVersion"

$major = [int](($nodeVersion -replace '^v','').Split('.')[0])
if ($major -lt 22) {
  Stop-WithError "Node $nodeVersion é inferior ao mínimo operacional esperado (22)."
}

Write-Step "Validar configuração local sem expor secrets"
$appPath = Join-Path $RepoPath "application"
$envPath = Join-Path $appPath ".env.local"
if (-not (Test-Path $envPath)) {
  Stop-WithError "application\.env.local não existe. O ficheiro é necessário para o runtime local."
}
Write-Host ".env.local encontrado. Conteúdo não será mostrado."

Set-Location $appPath

Write-Step "Instalar dependências exactamente do lockfile"
npm ci
if ($LASTEXITCODE -ne 0) { Stop-WithError "npm ci falhou." }

Write-Step "Typecheck"
npm run typecheck
if ($LASTEXITCODE -ne 0) { Stop-WithError "Typecheck falhou." }

Write-Step "Testes"
npm test
if ($LASTEXITCODE -ne 0) { Stop-WithError "Testes falharam." }

Write-Step "Lint"
npm run lint
if ($LASTEXITCODE -ne 0) { Stop-WithError "Lint falhou." }

Write-Step "Build"
npm run build
if ($LASTEXITCODE -ne 0) { Stop-WithError "Build falhou." }

Write-Step "Smoke test local"
$stdout = Join-Path $recoveryDir "runtime-$stamp.out.log"
$stderr = Join-Path $recoveryDir "runtime-$stamp.err.log"

$npmCmd = (Get-Command npm.cmd -ErrorAction SilentlyContinue)
if (-not $npmCmd) {
  $npmCmd = (Get-Command npm -ErrorAction SilentlyContinue)
}
if (-not $npmCmd) { Stop-WithError "npm executable não encontrado para iniciar o runtime." }

$process = Start-Process -FilePath $npmCmd.Source -ArgumentList @("run","dev","--","-p",$Port) -WorkingDirectory $appPath -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru

try {
  $ready = $false
  for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    try {
      $resp = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/login" -MaximumRedirection 0 -ErrorAction Stop
      if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 400) {
        $ready = $true
        break
      }
    } catch {
      $status = $_.Exception.Response.StatusCode.value__
      if ($status -ge 200 -and $status -lt 400) {
        $ready = $true
        break
      }
    }
  }

  if (-not $ready) {
    Write-Host "STDOUT: $stdout"
    Write-Host "STDERR: $stderr"
    Stop-WithError "Aplicação local não respondeu em http://127.0.0.1:$Port/login"
  }

  Write-Host "Login route respondeu." -ForegroundColor Green

  try {
    $dashboard = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/dashboard" -MaximumRedirection 0 -ErrorAction Stop
    Write-Host "Dashboard status: $($dashboard.StatusCode)"
  } catch {
    $status = $_.Exception.Response.StatusCode.value__
    if ($status -in 301,302,303,307,308) {
      Write-Host "Dashboard protegido redireccionou sem login, como esperado. Status: $status" -ForegroundColor Green
    } else {
      throw
    }
  }
}
finally {
  if ($process -and -not $process.HasExited) {
    Stop-Process -Id $process.Id -Force
  }
}

Write-Step "Resultado"
Write-Host "PASS — sincronização + Node + npm ci + typecheck + tests + lint + build + smoke test local." -ForegroundColor Green
Write-Host "Commit validado: $finalCommit"
Write-Host "Logs runtime: $stdout"
Write-Host "               $stderr"
