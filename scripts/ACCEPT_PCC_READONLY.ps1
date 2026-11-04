# PCC operational acceptance: read-only, no database writes and no deployment.
# Run with PowerShell 7 from the repository root. Required environment variables:
# PCC_SUPABASE_URL, PCC_SUPABASE_PUBLISHABLE_KEY, PCC_ACCEPTANCE_ACCESS_TOKEN
param(
  [string]$ProductionUrl = "https://project-command-center-amsoluction1.vercel.app",
  [string]$ReportPath = "PCC_ACCEPTANCE_RESULT.json"
)
$ErrorActionPreference = "Stop"
if ($PSVersionTable.PSVersion.Major -lt 7) { throw "PowerShell 7+ required" }
$results = [System.Collections.Generic.List[object]]::new()
function Record([string]$Name, [string]$Status, [string]$Detail) {
  $results.Add([pscustomobject]@{ check=$Name; status=$Status; detail=$Detail })
  Write-Host "$Status - $Name - $Detail"
}
function HttpCode([string]$Url, [hashtable]$Headers=@{}) {
  try {
    $r=Invoke-WebRequest -Uri $Url -Headers $Headers -SkipHttpErrorCheck -MaximumRedirection 0 -TimeoutSec 25
    return [int]$r.StatusCode
  } catch { return 0 }
}
$base = $ProductionUrl.TrimEnd('/')
$login = HttpCode "$base/auth/login"
if ($login -eq 200) { Record "production-login" "PASS" "HTTP 200" } else { Record "production-login" "FAIL" "HTTP $login" }
foreach ($path in @('/deliverables','/factory-library','/gie360')) {
  $status = HttpCode "$base$path"
  if ($status -in @(301,302,303,307,308,401,403)) {
    Record "anonymous-protection:$path" "PASS" "HTTP $status"
  } elseif ($status -eq 0) {
    Record "anonymous-protection:$path" "BLOCKED" "Network/proxy could not determine status"
  } else {
    Record "anonymous-protection:$path" "FAIL" "Unexpected HTTP $status"
  }
}
$url = $env:PCC_SUPABASE_URL
$key = $env:PCC_SUPABASE_PUBLISHABLE_KEY
$token = $env:PCC_ACCEPTANCE_ACCESS_TOKEN
if (-not $url -or -not $key -or -not $token) {
  Record "authenticated-P06" "BLOCKED" "Set PCC_SUPABASE_URL, PCC_SUPABASE_PUBLISHABLE_KEY and PCC_ACCEPTANCE_ACCESS_TOKEN locally. Do not paste tokens into chat."
} else {
  $url = $url.TrimEnd('/')
  $headers = @{apikey=$key; Authorization="Bearer $token"; Accept="application/json"}
  try {
    # RLS authorizes reading only the operator's accessible artefacts.
    $artifacts = @(Invoke-RestMethod -Uri "$url/rest/v1/generated_deliverable_artifacts?select=id,document_kind,files&document_kind=eq.presentation" -Headers $headers -TimeoutSec 30)
    if ($artifacts.Count -eq 0) {
      Record "authenticated-P06" "BLOCKED" "No presentation artifacts visible to this authenticated operator"
    } else {
      $passed = 0
      foreach ($artifact in $artifacts) {
        if (-not $artifact.files.pptx.path -or -not $artifact.files.pptx.sha256) {
          Record "P06-artifact" "FAIL" "Missing storage path or SHA-256 metadata"; continue
        }
        $path = [string]$artifact.files.pptx.path
        $expected = ([string]$artifact.files.pptx.sha256).ToLowerInvariant()
        $encoded = (($path -split '/') | ForEach-Object { [uri]::EscapeDataString($_) }) -join '/'
        $tmp = [System.IO.Path]::GetTempFileName()
        try {
          # Private bucket download through JWT. Response body never enters the report.
          $req = Invoke-WebRequest -Uri "$url/storage/v1/object/authenticated/pcc-deliverable-artifacts/$encoded" -Headers $headers -OutFile $tmp -SkipHttpErrorCheck -PassThru -TimeoutSec 45
          if ([int]$req.StatusCode -ne 200) { Record "P06-artifact" "FAIL" "Private storage HTTP $($req.StatusCode)"; continue }
          $actual = (Get-FileHash -Path $tmp -Algorithm SHA256).Hash.ToLowerInvariant()
          if ($actual -eq $expected) { $passed++; Record "P06-artifact" "PASS" "Authenticated download SHA-256 matched" }
          else { Record "P06-artifact" "FAIL" "SHA-256 mismatch" }
        } finally { Remove-Item $tmp -Force -ErrorAction SilentlyContinue }
      }
      Record "authenticated-P06" $(if($passed -eq $artifacts.Count){"PASS"}else{"FAIL"}) "$passed/$($artifacts.Count) authenticated downloadable presentation artifacts verified"
    }
  } catch {
    Record "authenticated-P06" "BLOCKED" "Auth/RLS/network failed; check credentials and authorized account. No secret details logged."
  }
}
# Real client-role acceptance requires a separate authorized client identity, not a synthetic approval.
Record "client-role-external-permissions" "BLOCKED" "Needs a distinct authorized client session and actual external-provider permission test"
Record "diagnostic-to-GIE360-client" "BLOCKED" "Needs a genuinely reviewed diagnostic and authorized client; do not create fictional approvals"
Record "GIE360-live-AI" "BLOCKED" "No read-only AI execution endpoint established; prior isolated CI covers code only"
$report = [pscustomobject]@{
  project="PCC"; kind="operational-read-only"; timestamp_utc=(Get-Date).ToUniversalTime().ToString('o')
  source_commit=(git rev-parse HEAD 2>$null); checks=@($results)
}
$report | ConvertTo-Json -Depth 7 | Set-Content -Path $ReportPath -Encoding utf8
Write-Host "Report saved: $ReportPath"
if (@($results | Where-Object status -eq 'FAIL').Count -gt 0) { exit 1 }
if (@($results | Where-Object status -eq 'BLOCKED').Count -gt 0) { exit 2 }
exit 0
