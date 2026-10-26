import Link from "next/link";
import { Bot, Database, Download, Gauge, HardDrive, Repeat2, Smartphone, WalletCards, Wifi } from "lucide-react";
import { OperationalReadinessCheck } from "@/components/operational-readiness-check";
import { PageHeader } from "@/components/page-header";
import { Card, EmptyState, secondaryButtonClass } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { calculateToolGovernanceScore, optimizationStatus } from "@/lib/optimization";
import { formatDateTime } from "@/lib/format";

function validationLabel(status?: string | null) {
  if (status === "passed") return "Validado operacionalmente";
  if (status === "failed") return "Falhou validação";
  if (status === "partial") return "Validação parcial";
  return "Não validado";
}

export default async function OptimizationPage() {
  const { supabase, user } = await requireAdmin();

  const [
    { data: projects, error: projectsError },
    { data: actions, error: actionsError },
    { data: blockers, error: blockersError },
    { data: metrics, error: metricsError },
    { data: providers, error: providersError },
    { data: validations, error: validationsError },
    { data: officialDocuments, error: documentsError },
  ] = await Promise.all([
    supabase.from("projects").select("id,status,progress").eq("user_id", user.id),
    supabase.from("actions").select("id,status").eq("user_id", user.id),
    supabase.from("blockers").select("id,status").eq("user_id", user.id),
    supabase.from("metrics").select("id,name,current_value,target_value").eq("user_id", user.id),
    supabase.from("ai_provider_profiles").select("id,provider,label,mode,cost_class,enabled,last_health_status,last_health_message,last_health_at").eq("user_id", user.id).order("priority"),
    supabase.from("operational_validation_runs").select("id,scope,status,release_sha,details,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
    supabase.from("pcc_official_documents").select("id,status,document_key,format,created_at").eq("user_id", user.id).eq("status", "current"),
  ]);

  const dbError = projectsError ?? actionsError ?? blockersError ?? metricsError ?? providersError ?? validationsError ?? documentsError;
  const activeProjects = (projects ?? []).filter((item) => ["planning","active","at_risk","on_hold"].includes(item.status));
  const openActions = (actions ?? []).filter((item) => !["completed","cancelled"].includes(item.status));
  const openBlockers = (blockers ?? []).filter((item) => !["resolved","ignored"].includes(item.status));
  const localProviders = (providers ?? []).filter((item) => item.enabled && item.mode === "local");
  const healthyProviders = (providers ?? []).filter((item) => item.enabled && item.last_health_status === "healthy");
  const releaseSha = process.env.VERCEL_GIT_COMMIT_SHA ?? null;

  const latestByScope = new Map<string, NonNullable<typeof validations>[number]>();
  for (const item of validations ?? []) {
    if (!latestByScope.has(item.scope)) latestByScope.set(item.scope, item);
  }

  const offlineValidation = latestByScope.get("offline_device");
  const androidValidation = latestByScope.get("mobile_android");
  const iosValidation = latestByScope.get("mobile_ios");
  const botiaValidation = latestByScope.get("botia");

  const governanceScore = calculateToolGovernanceScore({
    localFirst: localProviders.length > 0,
    workOnlyWhenJustified: true,
    secretsProtected: true,
    destructiveActionsGated: true,
  });

  return (
    <>
      <PageHeader eyebrow="Administração" title="Optimização & Saúde Operacional" />

      <Card className="mb-6 p-5">
        <p className="font-semibold text-[var(--cc-foreground)]">Critério de validação</p>
        <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
          “Validado em código” significa que a lógica compila e passa testes. “Operacional em pleno” exige execução real end-to-end em produção com evidência. O PCC não promove uma função de um nível para o outro sem prova.
        </p>
        <p className="mt-2 text-xs text-[var(--cc-secondary)]">Release: {releaseSha ? releaseSha.slice(0, 12) : "não disponível no runtime"}</p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2"><Database size={18} /><p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-secondary)]">Base de dados</p></div>
          <p className="mt-2 text-lg font-semibold text-[var(--cc-foreground)]">{dbError ? "Requer atenção" : "Operacional"}</p>
          <p className="mt-1 text-xs text-[var(--cc-secondary)]">{dbError?.message ?? "Consultas críticas responderam neste carregamento."}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2"><Bot size={18} /><p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-secondary)]">IA</p></div>
          <p className="mt-2 text-lg font-semibold text-[var(--cc-foreground)]">{healthyProviders.length ? "Provider saudável" : "Não operacional"}</p>
          <p className="mt-1 text-xs text-[var(--cc-secondary)]">{healthyProviders.length ? `${healthyProviders.length} provider(s) saudável(is).` : "É necessária uma validação real do provider."}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2"><Wifi size={18} /><p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-secondary)]">Offline</p></div>
          <p className="mt-2 text-lg font-semibold text-[var(--cc-foreground)]">{validationLabel(offlineValidation?.status)}</p>
          <p className="mt-1 text-xs text-[var(--cc-secondary)]">O self-test local não substitui o ciclo offline → reabertura → sincronização real.</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2"><Download size={18} /><p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-secondary)]">Documentos</p></div>
          <p className="mt-2 text-lg font-semibold text-[var(--cc-foreground)]">{officialDocuments?.length ?? 0} versão(ões) actual(is)</p>
          <Link href="/official-documents" className="mt-2 inline-block text-xs font-semibold text-[var(--cc-accent)] hover:underline">Abrir arquivo oficial</Link>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="inline-flex items-center gap-2 font-semibold text-[var(--cc-foreground)]"><HardDrive size={18} /> Providers de IA</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">Estado real guardado pela última chamada de health executada no runtime do PCC.</p>
            </div>
            <Link href="/ai-providers" className={secondaryButtonClass}>Validar IA</Link>
          </div>
          <div className="mt-4 space-y-3">
            {(providers ?? []).map((provider) => (
              <div key={provider.id} className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--cc-foreground)]">{provider.label}</p>
                  <span className="text-xs font-semibold text-[var(--cc-secondary)]">{provider.last_health_status ?? "unknown"}</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-[var(--cc-secondary)]">{provider.last_health_message ?? "Sem diagnóstico persistido."}</p>
                <p className="mt-1 text-[11px] text-[var(--cc-tertiary)]">{provider.last_health_at ? formatDateTime(provider.last_health_at) : "Nunca validado"}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-[var(--cc-secondary)]">BotIA end-to-end: {validationLabel(botiaValidation?.status)}</p>
        </Card>

        <Card className="p-5">
          <h2 className="inline-flex items-center gap-2 font-semibold text-[var(--cc-foreground)]"><Smartphone size={18} /> Mobile nativo</h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--cc-secondary)]">
            <p><strong className="text-[var(--cc-foreground)]">Android APK/AAB:</strong> {validationLabel(androidValidation?.status)}. A PWA existe, mas assinatura nativa, package identity e Digital Asset Links ainda precisam de uma release assinada real.</p>
            <p><strong className="text-[var(--cc-foreground)]">iPhone:</strong> {validationLabel(iosValidation?.status)}. Safari → Adicionar ao Ecrã Principal continua disponível; TestFlight/App Store exige assinatura Apple e uma app com utilidade suficiente para revisão.</p>
            <p>O logótipo/ícone reutiliza os assets PCC já protegidos; esta frente não autoriza qualquer redesenho da identidade.</p>
          </div>
        </Card>
      </div>

      <Card className="mt-6 p-5"><OperationalReadinessCheck /></Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <div className="border-b border-[var(--cc-border)] p-5"><h2 className="inline-flex items-center gap-2 font-semibold text-[var(--cc-foreground)]"><Gauge size={18} /> Métricas com alvo</h2></div>
          <div className="p-5">
            {!metrics?.length ? <EmptyState>Sem métricas registadas.</EmptyState> : (
              <div className="space-y-3">{metrics.map((metric) => {
                const status = optimizationStatus({ key: metric.id, label: metric.name, current: Number(metric.current_value ?? 0), target: metric.target_value === null ? null : Number(metric.target_value), direction: "higher_better" });
                return <div key={metric.id} className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-3">
                  <div className="flex items-center justify-between gap-3"><p className="text-sm font-medium text-[var(--cc-foreground)]">{metric.name}</p><span className="rounded-full bg-[var(--cc-surface-muted)] px-2 py-1 text-xs font-semibold">{status}</span></div>
                  <p className="mt-1 text-xs text-[var(--cc-secondary)]">Actual {metric.current_value ?? "—"} · alvo {metric.target_value ?? "DADO EM FALTA"}</p>
                </div>;
              })}</div>
            )}
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="inline-flex items-center gap-2 font-semibold text-[var(--cc-foreground)]"><WalletCards size={18} /> Controlo de custos e ferramentas</h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--cc-secondary)]">
            <p>• Conversa, scripts locais e ferramentas específicas primeiro.</p><p>• Usar recursos adicionais apenas quando o ganho de capacidade ou tempo justificar o custo.</p><p>• Ferramentas locais devem ser preferidas quando adequadas e disponíveis.</p><p>• Não duplicar bases, fluxos, bibliotecas de instruções ou registos de projectos.</p><p>• Não apagar nem substituir sem recuperação validada.</p>
          </div>
          <p className="mt-4 text-xs text-[var(--cc-secondary)]">Governação de ferramentas: {governanceScore}% · projectos activos {activeProjects.length} · acções abertas {openActions.length} · bloqueios {openBlockers.length}</p>
        </Card>
      </div>

      <Card className="mt-6 p-5">
        <h2 className="inline-flex items-center gap-2 font-semibold text-[var(--cc-foreground)]"><Repeat2 size={18} /> Melhoria contínua</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--cc-secondary)]">A optimização parte de métricas reais, falhas de QA, bloqueios, custos, health dos serviços e evidência operacional. Alterações estratégicas permanecem sujeitas a decisão humana.</p>
      </Card>
    </>
  );
}
