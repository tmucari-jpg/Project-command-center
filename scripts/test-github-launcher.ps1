# Offline contract test: the real launcher must rerun the exact test SHA, ignore a stale
# completed attempt and download that attempt's evidence. No GitHub/network calls.
$ErrorActionPreference = 'Stop'
$global:PccLauncherTestState = @{commit='0123456789abcdef0123456789abcdef01234567';rerunRequested=$false;runReads=0;downloaded=$false;requests=[System.Collections.Generic.List[string]]::new()}
$directory = Join-Path ([System.IO.Path]::GetTempPath()) ('pcc-launcher-test-' + [guid]::NewGuid().ToString('N'))
function global:gh {
  $arguments = @($args | ForEach-Object { [string]$_ })
  $global:LASTEXITCODE = 0
  $global:PccLauncherTestState.requests.Add(($arguments -join ' '))
  if ($arguments[0] -eq 'auth' -and $arguments[1] -eq 'status') { return 'Offline mock: authenticated' }
  if ($arguments[0] -eq 'api') {
    if ($arguments[1] -eq '--method' -and $arguments[2] -eq 'POST' -and $arguments[3] -eq 'repos/tmucari-jpg/Project-command-center/actions/runs/1001/rerun') { $global:PccLauncherTestState.rerunRequested = $true; return }
    $endpoint = $arguments[1]
    if ($endpoint -eq 'repos/tmucari-jpg/Project-command-center/branches/pcc-validation%2Foctober-2026') { return (@{commit=@{sha=$global:PccLauncherTestState.commit}} | ConvertTo-Json -Compress) }
    if ($endpoint -eq 'repos/tmucari-jpg/Project-command-center/actions/runs?branch=pcc-validation%2Foctober-2026&event=push&per_page=100') {
      return (@{workflow_runs=@(@{id=1001;path='.github/workflows/pcc-isolated-validation.yml';head_sha=$global:PccLauncherTestState.commit;head_branch='pcc-validation/october-2026';run_attempt=1;status='completed'})} | ConvertTo-Json -Depth 5 -Compress)
    }
    if ($endpoint -eq 'repos/tmucari-jpg/Project-command-center/actions/runs/1001') {
      $global:PccLauncherTestState.runReads++
      $attempt = if ($global:PccLauncherTestState.runReads -eq 1) { 1 } else { 2 }
      return (@{head_sha=$global:PccLauncherTestState.commit;head_branch='pcc-validation/october-2026';run_attempt=$attempt;status='completed';conclusion='success'} | ConvertTo-Json -Compress)
    }
  }
  if ($arguments[0] -eq 'run' -and $arguments[1] -eq 'download') {
    if (-not $global:PccLauncherTestState.rerunRequested -or $global:PccLauncherTestState.runReads -lt 2) { throw 'The launcher accepted a stale completed attempt.' }
    $nameIndex = [array]::IndexOf($arguments,'--name')
    if ($arguments[$nameIndex+1] -ne "pcc-validation-$($global:PccLauncherTestState.commit)-attempt-2") { throw 'Wrong evidence version requested.' }
    $dirIndex = [array]::IndexOf($arguments,'--dir')
    $target = $arguments[$dirIndex+1]
    New-Item -ItemType Directory -Force -Path $target | Out-Null
    @{commit=$global:PccLauncherTestState.commit;automatedChecksPassed=$true;fullyValidated=$false} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $target 'validation-run.json') -Encoding utf8
    $global:PccLauncherTestState.downloaded = $true
    return
  }
  throw "Unexpected command (no production/default-branch operation allowed): $($arguments -join ' ')"
}
try {
  & (Join-Path $PSScriptRoot 'TEST_PCC_GITHUB.ps1') -ExpectedCommit $global:PccLauncherTestState.commit -OutputDirectory $directory -TimeoutMinutes 1
  if (-not $global:PccLauncherTestState.downloaded) { throw 'No matching test evidence was downloaded.' }
  $report = Get-Content -LiteralPath (Join-Path $directory 'launcher-result.json') -Raw | ConvertFrom-Json
  if ($report.fullyValidated -or $report.productionChanged -or $report.attempt -ne 2) { throw 'The report overstates validation or does not identify its exact attempt.' }
  Write-Host 'PASS - offline launcher contract: test branch, pinned SHA, fresh attempt and matching evidence.'
} finally {
  Remove-Item Function:\gh -ErrorAction SilentlyContinue
  Remove-Variable -Name PccLauncherTestState -Scope Global -ErrorAction SilentlyContinue
  if (Test-Path -LiteralPath $directory) { Remove-Item -LiteralPath $directory -Recurse -Force }
}
