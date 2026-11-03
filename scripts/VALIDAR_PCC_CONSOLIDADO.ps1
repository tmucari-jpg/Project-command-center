# PCC consolidated release gate - read-only, no deployment, no Docker.
[CmdletBinding()]
param(
  [string]$Repository = 'tmucari-jpg/Project-command-center',
  [string]$Branch = 'recovery/gie360-20261028',
  [string]$ReportPath = (Join-Path (Get-Location) 'pcc-release-gate.json')
)
$ErrorActionPreference = 'Stop'
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw 'GitHub CLI gh nao encontrado. Instale cli.github.com.' }
& gh auth status --hostname github.com 2>$null
if ($LASTEXITCODE -ne 0) { throw 'GitHub nao autenticado. Execute gh auth login.' }
function Get-Gh([string]$Path) {
  $raw = & gh api $Path
  if ($LASTEXITCODE -ne 0) { throw "Erro GitHub: $Path" }
  return ($raw -join "`n" | ConvertFrom-Json)
}
$head = Get-Gh "repos/$Repository/branches/$([uri]::EscapeDataString($Branch))"
$sha = [string]$head.commit.sha
$runs = Get-Gh "repos/$Repository/actions/runs?branch=$([uri]::EscapeDataString($Branch))&per_page=100"
$matching = @($runs.workflow_runs | Where-Object { $_.head_sha -eq $sha -and $_.conclusion -eq 'success' -and $_.path -like '*pcc-isolated-validation.yml' })
# An isolated CI run on a validation branch with exactly this commit is also admissible.
if ($matching.Count -eq 0) {
  $all = Get-Gh "repos/$Repository/actions/runs?per_page=100"
  $matching = @($all.workflow_runs | Where-Object { $_.head_sha -eq $sha -and $_.conclusion -eq 'success' -and $_.path -like '*pcc-isolated-validation.yml' })
}
$ci = $matching.Count -gt 0
$report = [ordered]@{
  generated_at = (Get-Date).ToUniversalTime().ToString('o')
  repository = $Repository
  branch = $Branch
  sha = $sha
  automated_tests_pass = $ci
  approved_visual_questionnaires = 'manual_evidence_required'
  real_gie360_routing = 'manual_evidence_required'
  external_share_approval = 'manual_evidence_required'
  gemini_real_response = 'manual_evidence_required'
  real_mobile_offline = 'manual_evidence_required'
  release_authorized = $false
  deployment_executed = $false
}
$directory = Split-Path -Parent $ReportPath
if ($directory -and -not (Test-Path $directory)) { New-Item -Path $directory -ItemType Directory -Force | Out-Null }
$report | ConvertTo-Json -Depth 4 | Set-Content -Path $ReportPath -Encoding utf8
$report | Format-Table -AutoSize
Write-Host "Relatorio: $ReportPath"
if (-not $ci) { Write-Error 'Sem CI SUCCESS para o ultimo commit. Publicacao bloqueada.'; exit 1 }
Write-Host 'CI verificada. Publicacao permanece bloqueada ate evidencias reais e aprovacao explicita.'
