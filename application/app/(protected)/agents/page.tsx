import { Bot, ShieldCheck } from "lucide-react";
import { createAgentRun } from "@/app/(protected)/mutations";
import { Field, Select, TextArea } from "@/components/form-fields";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { Card, EmptyState, primaryButtonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { AGENT_REGISTRY, AGENT_TYPES } from "@/lib/agentic-core";
import { formatDateTime } from "@/lib/format";

export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();

  const [{ data: projects }, { data: runs }, { data: approvals }] = await Promise.all([
    supabase.from("projects").select("id,title").eq("user_id", user.id).order("title"),
    supabase
      .from("agent_runs")
      .select("id,agent_type,prompt_code,objective,status,qa_status,created_at,projects(title)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("approval_requests")
      .select("id,action_type,description,status,created_at")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Fase 3"
        title="Agentic Core"
        description="Orquestração controlada: agentes especializados, execução rastreável, QA/PASS e aprovação humana."
      />
      <FlashMessage error={params.error} created={params.created} />

      <div className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
        <Card className="p-5">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-950">
            <Bot size={19} /> Novo agent run
          </h2>
          <form action={createAgentRun} className="mt-5 space-y-4">
            <Select label="Projecto" name="project_id" defaultValue="">
              <option value="">Transversal / sem projecto</option>
              {(projects ?? []).map((project) => (
                <option key={project.id} value={project.id}>{project.title}</option>
              ))}
            </Select>
            <Select label="Agente" name="agent_type" defaultValue="command">
              {AGENT_TYPES.map((type) => (
                <option key={type} value={type}>{AGENT_REGISTRY[type].label}</option>
              ))}
            </Select>
            <Field label="Prompt oficial, se aplicável" name="prompt_code" placeholder="Ex.: P01, T09, E14" />
            <TextArea label="Objectivo" name="objective" />
            <button className={primaryButtonClass} type="submit">Criar run</button>
          </form>
        </Card>

        <Card>
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-950">Agentes disponíveis</h2>
          </div>
          <div className="grid gap-3 p-5 md:grid-cols-2">
            {AGENT_TYPES.map((type) => {
              const agent = AGENT_REGISTRY[type];
              return (
                <div key={type} className="rounded-xl border border-slate-200 p-4">
                  <p className="font-semibold text-slate-950">{agent.label}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{agent.purpose}</p>
                  <p className="mt-3 text-xs text-slate-500">
                    Prompts: {agent.defaultPromptCodes.join(", ")}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <div className="border-b border-slate-200 p-5">
            <h2 className="font-semibold text-slate-950">Runs recentes</h2>
          </div>
          <div className="p-5">
            {!runs?.length ? <EmptyState>Ainda não existem agent runs.</EmptyState> : (
              <div className="space-y-3">
                {runs.map((run) => {
                  const relation = Array.isArray(run.projects) ? run.projects[0] : run.projects;
                  return (
                    <article key={run.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-950">{run.objective}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {AGENT_REGISTRY[run.agent_type as keyof typeof AGENT_REGISTRY]?.label ?? run.agent_type}
                            {" · "}
                            {relation?.title ?? "Transversal"}
                            {" · "}
                            {formatDateTime(run.created_at)}
                          </p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                          {run.status}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className="border-b border-slate-200 p-5">
            <h2 className="inline-flex items-center gap-2 font-semibold text-slate-950">
              <ShieldCheck size={18} /> Aprovações humanas
            </h2>
          </div>
          <div className="p-5">
            {!approvals?.length ? (
              <EmptyState>Sem aprovações pendentes.</EmptyState>
            ) : (
              <div className="space-y-3">
                {approvals.map((approval) => (
                  <div key={approval.id} className="rounded-xl border border-amber-200 bg-amber-50/40 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                      {approval.action_type.replaceAll("_", " ")}
                    </p>
                    <p className="mt-2 text-sm text-slate-800">{approval.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-6 p-5">
        <p className="text-sm leading-6 text-slate-600">
          Pagamentos, mensagens/publicações externas, eliminações, alterações estratégicas/de preço, permissões e acções irreversíveis ficam bloqueadas até aprovação humana explícita.
        </p>
      </Card>
    </>
  );
}
