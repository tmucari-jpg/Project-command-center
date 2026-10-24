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

      <div className="max-w-5xl">
        <ClientDiagnosticTracker rows={diagnosticRows} />
        <Card className="p-5 sm:p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-[var(--cc-foreground)]">
              Defina o ponto de partida
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--cc-secondary)]">
              O PCC adapta as perguntas ao tipo de situação e recolhe o contexto necessário para iniciar G1 e preparar G2. Não precisa escolher ferramentas nem modos de trabalho.
            </p>
          </div>

          <AdaptiveProjectIntake />
        </Card>
      </div>
    </>
  );
}
