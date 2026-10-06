import { createExecutionArenaTrial } from "@/app/(protected)/mutations";
import { Field, Select, TextArea } from "@/components/form-fields";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { Card, EmptyState, primaryButtonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { arenaOutcomeScore } from "@/lib/execution-arena";

export default async function ExecutionArenaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();

  const [{ data: factoryCases }, { data: routes }, { data: trials, error }] = await Promise.all([
    supabase
      .from("project_factory_cases")
      .select("id,title")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("orchestrator_routes")
      .select("id,objective,selected_agent,strategy")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("execution_arena_trials")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Project Factory"
        title="Execution Arena"
        description="Compara execuções reais por qualidade, factualidade, sucesso da tarefa, tempo, custo e correcção humana. A Arena mede resultados; não mantém rankings estáticos de modelos."
      />
      <FlashMessage
        error={params.error ?? error?.message}
        created={params.created}
        message="Resultado registado na Execution Arena."
      />

      <div className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Registar execução</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
            Use a mesma tarefa/cenário para comparar candidatos diferentes em condições equivalentes.
          </p>

          <form action={createExecutionArenaTrial} className="mt-5 space-y-4">
            <Select label="Caso da Project Factory" name="factory_case_id" defaultValue="">
              <option value="">Sem caso associado</option>
              {(factoryCases ?? []).map((item) => (
                <option key={item.id} value={item.id}>{item.title}</option>
              ))}
            </Select>

            <Select label="Rota do Orchestrator" name="orchestrator_route_id" defaultValue="">
              <option value="">Sem rota associada</option>
              {(routes ?? []).map((route) => (
                <option key={route.id} value={route.id}>
                  {route.objective} · {route.selected_agent} · {route.strategy}
                </option>
              ))}
            </Select>

            <TextArea label="Cenário / tarefa testada" name="scenario" required />
            <Field label="Nome do candidato" name="candidate_label" required placeholder="Ex.: Pesquisa rápida A" />
            <Field label="Modelo / provider usado" name="model_label" placeholder="Ex.: local, cloud, modelo X" />
            <Select label="Agente" name="agent_type" defaultValue="research">
              <option value="command">Command</option>
              <option value="research">Research</option>
              <option value="business">Business</option>
              <option value="marketing">Marketing</option>
              <option value="product">Product</option>
              <option value="qa">QA</option>
              <option value="analytics">Analytics</option>
            </Select>
            <Field label="Estratégia" name="strategy" required placeholder="Ex.: research_then_verify" />
            <Field label="Ferramenta principal" name="tool_label" placeholder="Ex.: web, n8n, Supabase" />

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Qualidade (0–100)" name="quality_score" type="number" min={0} max={100} required />
              <Field label="Factualidade (0–100)" name="factuality_score" type="number" min={0} max={100} required />
              <Field label="Sucesso da tarefa (0–100)" name="task_success_score" type="number" min={0} max={100} required />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tempo (ms)" name="duration_ms" type="number" min={0} />
              <Field label="Correcção humana (min)" name="human_correction_minutes" type="number" min={0} />
              <Field label="Custo" name="cost_amount" type="number" min={0} step="0.0001" />
              <Field label="Moeda" name="cost_currency" placeholder="USD, MZN..." />
            </div>

            <TextArea label="Notas de revisão" name="review_notes" />
            <button className={primaryButtonClass} type="submit">Registar resultado</button>
          </form>
        </Card>

        <Card>
          <div className="border-b border-[var(--cc-border)] p-5">
            <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Resultados medidos</h2>
          </div>
          <div className="p-5">
            {!trials?.length ? (
              <EmptyState>Ainda não existem testes na Execution Arena.</EmptyState>
            ) : (
              <div className="space-y-4">
                {trials.map((trial) => {
                  const score = arenaOutcomeScore({
                    qualityScore: trial.quality_score,
                    factualityScore: trial.factuality_score,
                    taskSuccessScore: trial.task_success_score,
                  });
                  return (
                    <article
                      key={trial.id}
                      className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface-strong)] p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-[var(--cc-foreground)]">{trial.candidate_label}</h3>
                          <p className="mt-1 text-sm text-[var(--cc-secondary)]">
                            {trial.model_label || "modelo não indicado"} · {trial.agent_type} · {trial.strategy}
                          </p>
                        </div>
                        <span className="rounded-full bg-[var(--cc-surface-muted)] px-3 py-1 text-xs font-semibold text-[var(--cc-foreground)]">
                          Outcome {score}/100
                        </span>
                      </div>

                      <p className="mt-3 text-sm leading-6 text-[var(--cc-foreground)]">{trial.scenario}</p>

                      <div className="mt-4 grid gap-2 text-xs text-[var(--cc-secondary)] sm:grid-cols-3">
                        <p>Qualidade: <strong>{trial.quality_score}</strong></p>
                        <p>Factualidade: <strong>{trial.factuality_score}</strong></p>
                        <p>Task success: <strong>{trial.task_success_score}</strong></p>
                        <p>Tempo: <strong>{trial.duration_ms == null ? "—" : `${trial.duration_ms} ms`}</strong></p>
                        <p>Custo: <strong>{trial.cost_amount == null ? "—" : `${trial.cost_amount} ${trial.cost_currency ?? ""}`}</strong></p>
                        <p>Correcção humana: <strong>{trial.human_correction_minutes == null ? "—" : `${trial.human_correction_minutes} min`}</strong></p>
                      </div>

                      {trial.review_notes && (
                        <p className="mt-3 text-xs leading-5 text-[var(--cc-secondary)]">{trial.review_notes}</p>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
