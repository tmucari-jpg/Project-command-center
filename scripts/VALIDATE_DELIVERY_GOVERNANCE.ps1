$ErrorActionPreference = "Stop"

$migration = Get-Content "../supabase/migrations/20261023143000_delivery_commitment_acceptance.sql" -Raw
$mutations = Get-Content "./app/(protected)/mutations.ts" -Raw
$commitment = Get-Content "./app/(protected)/projects/[id]/commitment/page.tsx" -Raw
$deliverables = Get-Content "./app/(protected)/deliverables/page.tsx" -Raw
$projectDetail = Get-Content "./app/(protected)/projects/[id]/page.tsx" -Raw
$offlineClient = Get-Content "./lib/offline-client.ts" -Raw
$logoutButton = Get-Content "./components/logout-button.tsx" -Raw
$manualEntry = Get-Content "./components/manual-entry.tsx" -Raw
$vercel = Get-Content "./vercel.json" -Raw

foreach ($token in @(
  "project_commitment_baselines",
  "project_change_requests",
  "deliverable_acceptance_events",
  "project_closure_assessments",
  "qa_status",
  "cost_classification",
  "'sales'",
  "'marketing'",
  "'monetization'",
  "'security'"
)) {
  if (-not $migration.Contains($token)) {
    Write-Error "Delivery governance migration is missing: $token"
    exit 1
  }
}

foreach ($token in @(
  "G3 bloqueado: o cliente ainda não aprovou",
  'deliverable.qa_status !== "passed"',
  "Todos os entregáveis precisam de aceitação do cliente",
  "Custos externos, directos do cliente ou de âmbito adicional",
  "upsertProjectClosureAssessment",
  "project_change_requests"
)) {
  if (-not $mutations.Contains($token)) {
    Write-Error "Protected delivery governance rule is missing: $token"
    exit 1
  }
}

foreach ($token in @(
  "Definição do Projecto e Compromisso de Entrega",
  "Validação do cliente",
  "Custos externos e trabalhos paralelos",
  "Pedido de Alteração",
  "Preparação do G5"
)) {
  if (-not $commitment.Contains($token)) {
    Write-Error "Commitment/G5 experience is missing: $token"
    exit 1
  }
}

foreach ($token in @(
  "QA antes da entrega",
  "Aceitação do cliente",
  "Regra de fecho: entregar"
)) {
  if (-not $deliverables.Contains($token)) {
    Write-Error "Deliverable QA/acceptance experience is missing: $token"
    exit 1
  }
}

foreach ($token in @(
  "Pontos de atenção e riscos",
  "Adicionar dependência / obrigação",
  "blocks_progress",
  'owner_role === "client"'
)) {
  if (-not $projectDetail.Contains($token)) {
    Write-Error "Blind-spot treatment is missing from project details: $token"
    exit 1
  }
}

foreach ($token in @("clearOfflineData", "project-command-center-v7")) {
  if (-not $offlineClient.Contains($token)) {
    Write-Error "Offline security guard is missing: $token"
    exit 1
  }
}

foreach ($token in @("getOfflineQueue", "clearOfflineData", "alteração(ões) ainda por sincronizar")) {
  if (-not $logoutButton.Contains($token)) {
    Write-Error "Secure logout guard is missing: $token"
    exit 1
  }
}

if ($manualEntry.Contains("Rever / editar campos")) {
  Write-Error "Summary-level manual edit wording returned; edits must live inside details."
  exit 1
}

if (-not $vercel.Contains('"audit/pcc-ready-20261023": false')) {
  Write-Error "PCC readiness audit branch must not trigger Vercel preview deployments."
  exit 1
}

Write-Host "PCC delivery governance guard: PASS"
