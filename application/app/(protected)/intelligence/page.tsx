import { Lightbulb, Radar, ShieldCheck } from "lucide-react";
import { createIntelligenceSignal } from "@/app/(protected)/mutations";
import { Field, Select, TextArea } from "@/components/form-fields";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { Card, EmptyState, primaryButtonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

export default async function IntelligencePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();

  const [{ data: projects }, { data: signals }, { data: decisions }, { data: evidence }] = await Promise.all([
    supabase.from("projects").select("id,title").eq("user_id", user.id).order("title"),
    supabase
      .from("intelligence_signals")
      .select("id,title,summary,signal_type,confidence,status,action_hint,source_reference,created_at,projects(title)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("decisions").select("id", { count: "exact" }).eq("user_id", user.id),
    supabase.from("evidence").select("id", { count: "exact" }).eq("user_id", user.id),
  ]);

  const opportunities = (signals ?? []).filter((item) => item.signal_type === "opportunity" && item.status !== "dismissed");
  const briefing = (signals ?? []).filter((item) => item.signal_type === "briefing");

  return (
    <>
      <PageHeader
        eyebrow="Fase 4"
        title="Intelligence"
        description="Briefing interno, Opportunity Radar e sinais ligados a evidência e decisões."
      />
      <FlashMessage error={params.error} created={params.created} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4"><p className="text-xs text-slate-500">Sinais</p><p className="mt-1 text-2xl font-semibold">{signals?.length ?? 0}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500">Oportunidades</p><p className="mt-1 text-2xl font-semibold">{opportunities.length}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500">Decisões</p><p className="mt-1 text-2xl font-semibold">{decisions?.length ?? 0}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500">Evidências</p><p className="mt-1 text-2xl font-semibold">{evidence?.length ?? 0}</p></Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
        <Card className="p-5">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-950"><Radar size={19} /> Novo sinal</h2>
          <form action={createIntelligenceSignal} className="mt-5 space-y-4">
            <Select label="Projecto" name="project_id" defaultValue="">
              <option value="">Transversal</option>
              {(projects ?? []).map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
            </Select>
            <Select label="Tipo" name="signal_type" defaultValue="briefing">
              <option value="briefing">Briefing</option>
              <option value="opportunity">Oportunidade</option>
              <option value="risk">Risco</option>
              <option value="market">Mercado</option>
              <option value="customer">Cliente</option>
              <option value="operational">Operacional</option>
            </Select>
            <Field label="Título" name="title" required />
            <TextArea label="Resumo" name="summary" />
            <Field label="Fonte / referência" name="source_reference" />
            <Select label="Confiança" name="confidence" defaultValue="unverified">
              <option value="unverified">Não verificado</option>
              <option value="low">Baixa</option>
              <option value="medium">Média</option>
              <option value="high">Alta</option>
              <option value="verified">Verificado</option>
            </Select>
            <Select label="Estado" name="status" defaultValue="new">
              <option value="new">Novo</option>
              <option value="reviewed">Revisto</option>
              <option value="actionable">Accionável</option>
              <option value="dismissed">Descartado</option>
              <option value="converted">Convertido</option>
            </Select>
            <TextArea label="Acção sugerida" name="action_hint" />
            <button className={primaryButtonClass} type="submit">Registar sinal</button>
          </form>
        </Card>

        <div className="space-y-6">
          <Card>
            <div className="border-b border-slate-200 p-5">
              <h2 className="inline-flex items-center gap-2 font-semibold text-slate-950"><Lightbulb size={18} /> Opportunity Radar</h2>
            </div>
            <div className="p-5">
              {!opportunities.length ? <EmptyState>Sem oportunidades activas.</EmptyState> : (
                <div className="space-y-3">
                  {opportunities.map((item) => {
                    const relation = Array.isArray(item.projects) ? item.projects[0] : item.projects;
                    return (
                      <article key={item.id} className="rounded-xl border border-slate-200 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-slate-950">{item.title}</p>
                            <p className="mt-1 text-xs text-slate-500">{relation?.title ?? "Transversal"} · {item.confidence}</p>
                          </div>
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">{item.status}</span>
                        </div>
                        {item.summary && <p className="mt-3 text-sm leading-6 text-slate-700">{item.summary}</p>}
                        {item.action_hint && <p className="mt-2 text-sm text-blue-700">Próxima acção: {item.action_hint}</p>}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>

          <Card>
            <div className="border-b border-slate-200 p-5">
              <h2 className="inline-flex items-center gap-2 font-semibold text-slate-950"><ShieldCheck size={18} /> Intelligence Briefing</h2>
            </div>
            <div className="p-5">
              {!briefing.length ? <EmptyState>Sem sinais de briefing registados.</EmptyState> : (
                <div className="space-y-3">
                  {briefing.slice(0, 12).map((item) => (
                    <article key={item.id} className="rounded-xl border border-slate-200 p-4">
                      <p className="font-medium text-slate-950">{item.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{formatDateTime(item.created_at)} · {item.confidence}</p>
                      {item.summary && <p className="mt-2 text-sm leading-6 text-slate-700">{item.summary}</p>}
                    </article>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      <Card className="mt-6 p-5">
        <p className="text-sm text-slate-600">
          Evidence Layer e Decision Engine reutilizam as tabelas canónicas de Evidências e Decisões. O Intelligence não cria fontes paralelas.
        </p>
      </Card>
    </>
  );
}
