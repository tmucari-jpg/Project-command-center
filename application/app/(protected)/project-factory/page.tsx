import { AdaptiveProjectIntake } from "@/components/adaptive-project-intake";
import { FlashMessage } from "@/components/flash-message";
import { ClientDiagnosticTracker, type ClientDiagnosticTrackingRow } from "@/components/client-diagnostic-tracker";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export default async function ProjectFactoryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();

  const { data: requests } = await supabase
    .from("client_diagnostic_requests")
    .select("factory_case_id,client_name,client_organization,status,expires_at,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const requestCounts = new Map<string, number>();
  const latestByCase = new Map<string, NonNullable<typeof requests>[number]>();

  for (const request of requests ?? []) {
    requestCounts.set(request.factory_case_id, (requestCounts.get(request.factory_case_id) ?? 0) + 1);
    if (!latestByCase.has(request.factory_case_id)) latestByCase.set(request.factory_case_id, request);
  }

  const caseIds = Array.from(latestByCase.keys());
  const { data: cases } = caseIds.length
    ? await supabase
        .from("project_factory_cases")
        .select("id,title")
        .eq("user_id", user.id)
        .in("id", caseIds)
    : { data: [] as Array<{ id: string; title: string }> };

  const caseTitles = new Map((cases ?? []).map((item) => [item.id, item.title]));
  const diagnosticRows: ClientDiagnosticTrackingRow[] = Array.from(latestByCase.values())
    .map((request) => ({
      factory_case_id: request.factory_case_id,
      title: caseTitles.get(request.factory_case_id) ?? "Caso PCC",
      client_name: request.client_name,
      client_organization: request.client_organization,
      status: request.status,
      expires_at: request.expires_at,
      created_at: request.created_at,
      request_count: requestCounts.get(request.factory_case_id) ?? 1,
    }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <>
      <PageHeader eyebrow="Projectos" title="Novo projecto" />
      <FlashMessage
        error={params.error}
        created={params.created}
        message={params.created ? "Novo projecto recebido. A avaliação foi iniciada." : undefined}
      />

      <div className="max-w-6xl">
        <ClientDiagnosticTracker rows={diagnosticRows} />
        <Card className="overflow-hidden p-0">
          <div className="border-b border-[var(--cc-border)] bg-[var(--cc-surface-muted)] px-5 py-5 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#146453]">
                  Ponto de partida
                </p>
                <h2 className="mt-1 text-xl font-semibold text-[var(--cc-foreground)]">
                  Defina como quer começar
                </h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--cc-secondary)]">
                  Preencha directamente no PCC ou gere um questionário para recolher primeiro a informação essencial.
                </p>
              </div>
              <div className="rounded-full border border-[#e2d3ae] bg-white px-3 py-1.5 text-xs font-semibold text-[#8b6a25]">
                Diagnóstico adaptativo
              </div>
            </div>
          </div>

          <AdaptiveProjectIntake />
        </Card>
      </div>
    </>
  );
}
