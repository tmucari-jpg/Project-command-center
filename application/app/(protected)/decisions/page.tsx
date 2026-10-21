import Link from "next/link";
import { recordProjectClosureDecision } from "@/app/(protected)/mutations";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { StatusProgressForm } from "@/components/status-progress-form";
import { Card, EmptyState, primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/format";

function deliverableStage(item: {
  status: string;
  progress: number | null;
}, evidenceCount: number) {
  if (item.status === "completed") return "Entregue";
  if (item.status === "blocked") return "Bloqueado";
  if (item.status === "cancelled") return "Cancelado";
  if (item.status === "active" && Number(item.progress ?? 0) >= 100 && evidenceCount > 0) return "Validado";
  if (item.status === "active" && Number(item.progress ?? 0) >= 100) return "Pronto para validação";
  if (item.status === "active") return "Em preparação";
  return "Por preparar";
}

export default async function DecisionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    created?: string;
    project_id?: string;
    decision?: string;
  }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();
  const selectedProjectId = params.project_id ?? "";

  const [
    { data: projects, error: projectsError },
    { data: deliverables },
    { data: evidence },
    { data: blockers },
    { data: decisions },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id,title,status,objective_id,governance_gate,governance_gate_status,objectives(title)")
      .eq("user_id", user.id)
      .order("title"),
    supabase
      .from("deliverables")
      .select("id,project_id,title,description,status,progress,due_date,completion_criteria,owner_id")
      .eq("user_id", user.id)
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("evidence")
      .select("id,project_id,deliverable_id,title,evidence_type,description,url,storage_path,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("blockers")
      .select("id,project_id,status,title")
      .eq("user_id", user.id)
      .in("status", ["open", "investigating", "waiting"]),
    supabase
      .from("decisions")
      .select("id,project_id,title,decision,rationale,outcome,decided_at")
      .eq("user_id", user.id)
      .order("decided_at", { ascending: false }),
  ]);

  const evidenceByDeliverable = new Map<string, NonNullable<typeof evidence>>();
  for (const item of evidence ?? []) {
    if (!item.deliverable_id) continue;
    const list = evidenceByDeliverable.get(item.deliverable_id) ?? [];
    list.push(item);
    evidenceByDeliverable.set(item.deliverable_id, list);
  }

  const projectSummaries = (projects ?? [])
    .filter((project) => !selectedProjectId || project.id === selectedProjectId)
    .map((project) => {
      const projectDeliverables = (deliverables ?? []).filter(
        (item) => item.project_id === project.id && item.status !== "cancelled",
      );
      const delivered = projectDeliverables.filter((item) => item.status === "completed").length;
      const missingEvidence = projectDeliverables.filter(
        (item) => !(evidenceByDeliverable.get(item.id)?.length ?? 0),
      ).length;
      const projectBlockers = (blockers ?? []).filter((item) => item.project_id === project.id);
      const ready =
        Boolean(project.objective_id) &&
        projectDeliverables.length > 0 &&
        delivered === projectDeliverables.length &&
        missingEvidence === 0 &&
        projectBlockers.length === 0;
      const projectDecisions = (decisions ?? []).filter((item) => item.project_id === project.id);
      const objective = Array.isArray(project.objectives) ? project.objectives[0] : project.objectives;
      return {
        project,
        objective,
        deliverables: projectDeliverables,
        delivered,
        missingEvidence,
        blockers: projectBlockers,
        decisions: projectDecisions,
        ready,
      };
    });

  return (
    <>
      <PageHeader eyebrow="Validar / concluir" title="Entregáveis & Fecho" />
      <FlashMessage
        error={params.error ?? projectsError?.message}
        created={params.created}
        message={
          params.decision === "close"
            ? "Projecto encerrado e preservado no histórico."
            : params.decision === "continue"
              ? "Decisão de continuar registada."
              : undefined
        }
      />

      <Card className="mb-6 p-5">
        <h2 className="font-semibold text-[var(--cc-foreground)]">Resultado real, não apenas ficheiro</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
          Um entregável só conta quando existe um resultado utilizável e verificável: ficheiro final, website publicado, sistema funcional, dashboard, API, apresentação, modelo ou outro artefacto real.
        </p>
        <p className="mt-2 text-xs leading-5 text-[var(--cc-secondary)]">
          Depois de entregue, o artefacto canónico e a sua evidência ficam bloqueados no PCC. Uma cópia descarregada não substitui a versão canónica; qualquer alteração válida deve voltar ao fluxo do PCC e ser novamente validada.
        </p>
      </Card>

      <div className="space-y-5">
        {!projectSummaries.length ? (
          <Card className="p-5"><EmptyState>Não existem projectos para esta vista.</EmptyState></Card>
        ) : (
          projectSummaries.map((item) => (
            <Card key={item.project.id}>
              <div className="border-b border-[var(--cc-border)] p-5">
                <div className="grid gap-3 md:grid-cols-[1.3fr_auto] md:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">{item.project.title}</h2>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        item.ready
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-[var(--cc-surface-muted)] text-[var(--cc-secondary)]"
                      }`}>
                        {item.project.status === "completed" ? "Fechado" : item.ready ? "Pronto para fechar" : "Fecho pendente"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[var(--cc-secondary)]">
                      <span className="font-medium text-[var(--cc-foreground)]">Objectivo Central:</span>{" "}
                      {item.objective?.title ?? "por definir"}
                    </p>
                  </div>
                  <Link className={secondaryButtonClass} href={`/projects/${item.project.id}`}>Abrir projecto</Link>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-[var(--cc-radius-md)] bg-[var(--cc-surface-muted)] p-3">
                    <p className="text-xs text-[var(--cc-secondary)]">Entregáveis</p>
                    <p className="mt-1 text-xl font-semibold">{item.delivered}/{item.deliverables.length}</p>
                  </div>
                  <div className="rounded-[var(--cc-radius-md)] bg-[var(--cc-surface-muted)] p-3">
                    <p className="text-xs text-[var(--cc-secondary)]">Sem evidência</p>
                    <p className="mt-1 text-xl font-semibold">{item.missingEvidence}</p>
                  </div>
                  <div className="rounded-[var(--cc-radius-md)] bg-[var(--cc-surface-muted)] p-3">
                    <p className="text-xs text-[var(--cc-secondary)]">Bloqueios de fecho</p>
                    <p className="mt-1 text-xl font-semibold">{item.blockers.length}</p>
                  </div>
                  <div className="rounded-[var(--cc-radius-md)] bg-[var(--cc-surface-muted)] p-3">
                    <p className="text-xs text-[var(--cc-secondary)]">Estado</p>
                    <p className="mt-1 text-sm font-semibold">{item.ready ? "Pronto" : "Ainda não pronto"}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-5 p-5">
                <section>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-[var(--cc-foreground)]">Entregáveis</h3>
                      <p className="mt-1 text-xs text-[var(--cc-secondary)]">Defina, produza, valide, entregue e comprove.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link className={secondaryButtonClass} href={`/deliverables?project_id=${item.project.id}`}>Gerir entregáveis</Link>
                      <Link className={secondaryButtonClass} href={`/evidence?project_id=${item.project.id}`}>Adicionar evidência</Link>
                    </div>
                  </div>

                  {!item.deliverables.length ? (
                    <div className="mt-4"><EmptyState>Defina os entregáveis reais necessários para este projecto.</EmptyState></div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {item.deliverables.map((deliverable) => {
                        const itemEvidence = evidenceByDeliverable.get(deliverable.id) ?? [];
                        const stage = deliverableStage(deliverable, itemEvidence.length);
                        const locked = deliverable.status === "completed";
                        return (
                          <details key={deliverable.id} className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)]">
                            <summary className="cursor-pointer list-none p-4">
                              <div className="grid gap-2 md:grid-cols-[1.3fr_0.8fr_0.8fr_auto] md:items-center">
                                <div>
                                  <h4 className="font-semibold">{deliverable.title}</h4>
                                  <p className="mt-1 text-xs text-[var(--cc-secondary)]">{stage}{locked ? " · arquivo canónico bloqueado" : ""}</p>
                                </div>
                                <p className="text-sm text-[var(--cc-secondary)]">{deliverable.due_date ? `Prazo ${formatDate(deliverable.due_date)}` : "Sem prazo"}</p>
                                <p className="text-sm text-[var(--cc-secondary)]">{itemEvidence.length} evidência(s)</p>
                                <span className="text-sm font-semibold text-[var(--cc-accent)]">Detalhes</span>
                              </div>
                            </summary>
                            <div className="space-y-4 border-t border-[var(--cc-border)] p-4">
                              {deliverable.description && <p className="text-sm leading-6">{deliverable.description}</p>}
                              <p className="text-sm"><span className="font-medium">Critério de aceitação:</span> {deliverable.completion_criteria || "por definir"}</p>

                              {!itemEvidence.length ? (
                                <p className="text-sm text-[var(--cc-secondary)]">Ainda não existe ficheiro, link ou outra evidência real associada.</p>
                              ) : (
                                <div className="space-y-2">
                                  {itemEvidence.map((proof) => (
                                    <div key={proof.id} className="rounded-[var(--cc-radius-md)] bg-[var(--cc-surface-muted)] p-3">
                                      <p className="text-sm font-medium">{proof.title || "Evidência de entrega"}</p>
                                      <p className="mt-1 text-xs text-[var(--cc-secondary)]">{formatDateTime(proof.created_at)}</p>
                                      {proof.description && <p className="mt-2 text-sm">{proof.description}</p>}
                                      {proof.url && (
                                        <a href={proof.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-sm font-semibold text-[var(--cc-accent)] hover:underline">
                                          Abrir resultado / link →
                                        </a>
                                      )}
                                      {proof.storage_path && (
                                        <p className="mt-2 text-xs font-medium text-[var(--cc-secondary)]">Arquivo interno protegido no PCC.</p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {!locked ? (
                                <StatusProgressForm
                                  entity="deliverables"
                                  id={deliverable.id}
                                  status={deliverable.status}
                                  progress={deliverable.progress}
                                />
                              ) : (
                                <p className="text-xs font-semibold text-[var(--cc-secondary)]">Entregue · edição directa desactivada.</p>
                              )}
                            </div>
                          </details>
                        );
                      })}
                    </div>
                  )}
                </section>

                <section className="border-t border-[var(--cc-border)] pt-5">
                  <h3 className="font-semibold text-[var(--cc-foreground)]">Decisão final</h3>
                  {item.project.status === "completed" ? (
                    <div className="mt-3 rounded-[var(--cc-radius-md)] bg-[var(--cc-surface-muted)] p-4">
                      <p className="text-sm font-semibold">Projecto fechado e preservado no histórico.</p>
                      {item.decisions[0] && (
                        <p className="mt-2 text-sm text-[var(--cc-secondary)]">
                          Última decisão: {item.decisions[0].decision} · {formatDateTime(item.decisions[0].decided_at)}
                        </p>
                      )}
                    </div>
                  ) : (
                    <form action={recordProjectClosureDecision} className="mt-4 space-y-3">
                      <input type="hidden" name="project_id" value={item.project.id} />
                      <label className="block text-sm font-medium">
                        Fundamentação
                        <textarea
                          name="rationale"
                          required
                          rows={3}
                          placeholder="Registe a razão para continuar ou encerrar o projecto com base nos resultados e entregáveis."
                          className="mt-1 w-full rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-white px-3 py-2 text-sm"
                        />
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button className={secondaryButtonClass} type="submit" name="decision" value="continue">Continuar projecto</button>
                        <button
                          className={primaryButtonClass}
                          type="submit"
                          name="decision"
                          value="close"
                          disabled={!item.ready}
                          title={!item.ready ? "Conclua entregáveis, evidências, Objectivo Central e bloqueios antes do fecho." : undefined}
                        >
                          Encerrar projecto
                        </button>
                      </div>
                      {!item.ready && (
                        <p className="text-xs text-[var(--cc-secondary)]">
                          O fecho só é activado quando todos os entregáveis estão entregues com evidência, não existem bloqueios activos e o Objectivo Central está definido.
                        </p>
                      )}
                    </form>
                  )}
                </section>

                {item.decisions.length > 0 && (
                  <details className="border-t border-[var(--cc-border)] pt-5">
                    <summary className="cursor-pointer text-sm font-semibold text-[var(--cc-accent)]">Histórico de decisões</summary>
                    <div className="mt-3 space-y-3">
                      {item.decisions.map((decision) => (
                        <div key={decision.id} className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-3">
                          <p className="text-sm font-semibold">{decision.title}</p>
                          <p className="mt-1 text-xs text-[var(--cc-secondary)]">{formatDateTime(decision.decided_at)}</p>
                          <p className="mt-2 text-sm">{decision.decision}</p>
                          {decision.rationale && <p className="mt-1 text-sm text-[var(--cc-secondary)]">{decision.rationale}</p>}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </>
  );
}
