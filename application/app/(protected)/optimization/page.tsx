import { Gauge, Repeat2, WalletCards } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, EmptyState } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { calculateToolGovernanceScore, optimizationStatus } from "@/lib/optimization";

export default async function OptimizationPage() {
  const { supabase, user } = await requireUser();

  const [
    { data: projects },
    { data: actions },
    { data: blockers },
    { data: metrics },
    { data: providers },
  ] = await Promise.all([
    supabase.from("projects").select("id,status,progress").eq("user_id", user.id),
    supabase.from("actions").select("id,status").eq("user_id", user.id),
    supabase.from("blockers").select("id,status").eq("user_id", user.id),
    supabase.from("metrics").select("id,name,current_value,target_value").eq("user_id", user.id),
    supabase.from("ai_provider_profiles").select("id,mode,cost_class,enabled").eq("user_id", user.id),
  ]);

  const activeProjects = (projects ?? []).filter((item) => ["planning","active","at_risk","on_hold"].includes(item.status));
  const openActions = (actions ?? []).filter((item) => !["completed","cancelled"].includes(item.status));
  const openBlockers = (blockers ?? []).filter((item) => !["resolved","ignored"].includes(item.status));
  const localProviders = (providers ?? []).filter((item) => item.enabled && item.mode === "local");

  const governanceScore = calculateToolGovernanceScore({
    localFirst: localProviders.length > 0,
    workOnlyWhenJustified: true,
    secretsProtected: true,
    destructiveActionsGated: true,
  });

  return (
    <>
      <PageHeader
        eyebrow="Fase 7"
        title="Optimização"
        description="Melhoria contínua, disciplina de custos e controlo operacional sem criar novas fontes de verdade."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4"><p className="text-xs text-slate-500">Projectos activos</p><p className="mt-1 text-2xl font-semibold">{activeProjects.length}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500">Acções abertas</p><p className="mt-1 text-2xl font-semibold">{openActions.length}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500">Bloqueios activos</p><p className="mt-1 text-2xl font-semibold">{openBlockers.length}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500">Tool governance</p><p className="mt-1 text-2xl font-semibold">{governanceScore}%</p></Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <div className="border-b border-slate-200 p-5">
            <h2 className="inline-flex items-center gap-2 font-semibold text-slate-950"><Gauge size={18} /> Métricas com alvo</h2>
          </div>
          <div className="p-5">
            {!metrics?.length ? <EmptyState>Sem métricas registadas.</EmptyState> : (
              <div className="space-y-3">
                {metrics.map((metric) => {
                  const status = optimizationStatus({
                    key: metric.id,
                    label: metric.name,
                    current: Number(metric.current_value ?? 0),
                    target: metric.target_value === null ? null : Number(metric.target_value),
                    direction: "higher_better",
                  });
                  return (
                    <div key={metric.id} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-slate-950">{metric.name}</p>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">{status}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Actual {metric.current_value ?? "—"} · alvo {metric.target_value ?? "DADO EM FALTA"}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="inline-flex items-center gap-2 font-semibold text-slate-950"><WalletCards size={18} /> Cost Control / Tool Governance</h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
            <p>• Conversa, scripts locais e ferramentas específicas primeiro.</p>
            <p>• Work apenas quando o ganho de capacidade/tempo justificar créditos.</p>
            <p>• Providers locais devem ser preferidos quando adequados e disponíveis.</p>
            <p>• Não duplicar bases, pipelines, prompt libraries ou project registries.</p>
            <p>• Não apagar nem substituir sem recuperação validada.</p>
          </div>
        </Card>
      </div>

      <Card className="mt-6 p-5">
        <h2 className="inline-flex items-center gap-2 font-semibold text-slate-950"><Repeat2 size={18} /> Continuous Improvement</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          A optimização deve partir de métricas reais, falhas de QA, bloqueios, custos e feedback. Alterações estratégicas permanecem sujeitas a decisão humana.
        </p>
      </Card>
    </>
  );
}
