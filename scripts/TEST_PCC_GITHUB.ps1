# One integrated remote validation; no local Docker, deployment, database reset or production access.
[CmdletBinding()]
param(
  [ValidatePattern('^[a-f0-9]{40}$')][string]$ExpectedCommit,
  [string]$OutputDirectory,
  [ValidateRange(1,90)][int]$TimeoutMinutes = 45
)
$ErrorActionPreference = 'Stop'
$repository = 'tmucari-jpg/Project-command-center'
$branch = 'pcc-validation/october-2026'
$workflowPath = '.github/workflows/pcc-isolated-validation.yml'
$runId = $null
$reportPath = $null
function Invoke-GhJson([string[]]$Arguments) {
  $raw = & gh @Arguments
  if ($LASTEXITCODE -ne 0) { throw "GitHub CLI falhou: gh $($Arguments -join ' ')" }
  return ($raw -join "`n") | ConvertFrom-Json
}
try {
  if ($PSVersionTable.PSVersion.Major -lt 7) { throw 'Use PowerShell 7 (pwsh).' }
  if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw 'Falta GitHub CLI (gh). Instale a partir de https://cli.github.com e execute gh auth login; depois repita este comando. Docker nao e necessario.' }
  & gh auth status --hostname github.com
  if ($LASTEXITCODE -ne 0) { throw 'Autenticacao GitHub indisponivel. Execute gh auth login e repita.' }
  $escapedBranch = [Uri]::EscapeDataString($branch)
  $head = Invoke-GhJson @('api', "repos/$repository/branches/$escapedBranch")
  $commit = [string]$head.commit.sha
  if ($commit -notmatch '^[a-f0-9]{40}$') { throw 'Referencia de testes invalida.' }
  if ($ExpectedCommit -and $ExpectedCommit -ne $commit) { throw "A branch mudou. Esperado: $ExpectedCommit; actual: $commit. Nenhum teste foi iniciado." }
  $runs = Invoke-GhJson @('api', "repos/$repository/actions/runs?branch=$escapedBranch&event=push&per_page=100")
  $run = @($runs.workflow_runs | Where-Object { $_.path -eq $workflowPath -and $_.head_sha -eq $commit -and $_.head_branch -eq $branch } | Sort-Object id -Descending) | Select-Object -First 1
  if (-not $run) { throw 'Ainda nao existe execucao push para este commit de testes. Confirme que o workflow esta publicado na branch de validacao; nao foi alterada a main.' }
  $runId = [string]$run.id
  $attempt = [int]$run.run_attempt
  if (-not $OutputDirectory) { $OutputDirectory = Join-Path (Split-Path $PSScriptRoot -Parent) ('tmp/github-validation/{0}-{1}' -f (Get-Date -Format 'yyyyMMdd-HHmmss'), [guid]::NewGuid().ToString('N').Substring(0,8)) }
  New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
  $reportPath = Join-Path $OutputDirectory 'launcher-result.json'
  Write-Host "PCC + GIE360 | Branch de testes: $branch"
  Write-Host "Commit: $commit"
  Write-Host "Execucao: https://github.com/$repository/actions/runs/$runId"
  # A workflow existing only on a test branch cannot always receive workflow_dispatch.
  # Re-running its exact push run avoids adding a launcher workflow to main.
  if ($run.status -eq 'completed') {
    & gh api --method POST "repos/$repository/actions/runs/$runId/rerun" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel repetir o teste isolado. Verifique permissoes Actions do utilizador GitHub.' }
    $attempt++
  }
  $deadline = (Get-Date).AddMinutes($TimeoutMinutes)
  $lastProgress = [datetime]::MinValue
  do {
    $state = Invoke-GhJson @('api', "repos/$repository/actions/runs/$runId")
    if ($state.head_sha -ne $commit -or $state.head_branch -ne $branch) { throw 'A execucao nao corresponde a referencia de testes.' }
    if ((Get-Date).Subtract($lastProgress).TotalSeconds -ge 30) {
      Write-Host ('Aguardar: estado={0}; tentativa={1}' -f $state.status,$state.run_attempt)
      $lastProgress = Get-Date
    }
    if ([int]$state.run_attempt -ge $attempt -and $state.status -eq 'completed') { break }
    if ((Get-Date) -gt $deadline) { throw 'Tempo de espera esgotado; o teste remoto nao foi cancelado. Consulte o link da execucao.' }
    Start-Sleep -Seconds 5
  } while ($true)
  $downloadPath = Join-Path $OutputDirectory 'evidence'
  $artifact = "pcc-validation-${commit}-attempt-$($state.run_attempt)"
  & gh run download $runId --repo $repository --name $artifact --dir $downloadPath
  $downloaded = $LASTEXITCODE -eq 0
  [pscustomobject]@{
    repository=$repository; branch=$branch; commit=$commit; runId=$runId; attempt=$state.run_attempt
    conclusion=$state.conclusion; evidenceDownloaded=$downloaded
    fullyValidated=$false; productionChanged=$false
    pending=@('IA real com chave autorizada','WebGPU real','PWA Android/iOS no dispositivo','APK assinada no dispositivo','Restauro completo do backup','Aceitacao funcional e fiscal')
  } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $reportPath -Encoding utf8
  Write-Host "Relatorio: $reportPath"
  if ($state.conclusion -ne 'success') { throw "Validacao automatizada terminou com estado: $($state.conclusion). Consulte as evidencias e o link acima." }
  if (-not $downloaded) { throw 'O teste terminou, mas nao foi possivel descarregar as evidencias; nao foi declarado validado.' }
  $scopePath = Join-Path $downloadPath 'validation-run.json'
  if (-not (Test-Path -LiteralPath $scopePath)) { throw 'Falta o relatorio de cobertura da execucao; nao foi declarado validado.' }
  $scope = Get-Content -LiteralPath $scopePath -Raw | ConvertFrom-Json
  if ($scope.commit -ne $commit -or -not $scope.automatedChecksPassed) { throw 'Relatorio de cobertura inconsistente ou verificacoes incompletas.' }
  Write-Host 'PASS - validacao automatizada integrada concluida. A main e a producao nao foram alteradas.' -ForegroundColor Green
  Write-Host 'Pendente: IA real com chave autorizada, WebGPU, instalacao fisica PWA/APK, restauro completo e aceitacao funcional/fiscal.' -ForegroundColor Yellow
} catch {
  Write-Error $_.Exception.Message
  exit 1
}
