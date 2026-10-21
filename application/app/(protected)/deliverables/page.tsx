import Link from "next/link";
import { createDeliverable, finalizeProjectClosure } from "@/app/(protected)/mutations";
import { Field, Select, TextArea } from "@/components/form-fields";
import { FlashMessage } from "@/components/flash-message";
import { ManualEntry } from "@/components/manual-entry";
import { PageHeader } from "@/components/page-header";
import { StatusProgressForm } from "@/components/status-progress-form";
import { Card, EmptyState, primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import { PRIORITIES } from "@/lib/constants";
import { requireUser } from "@/lib/auth";
import { displayLabel } from "@/lib/display-label";
import { formatDate } from "@/lib/format";
import { prepareDeliverableDraft } from "@/lib/project-autonomy";

function objectiveTitle(relation: { title?: string | null } | { title?: string | null }[] | null | undefined) {
  return Array.isArray(relation) ? relation[0]?.title : relation?.title;
}

function deliverableState(status: string, progress: number | string | null) {
  if (status === "completed") return "Entregue · bloqueado";
  if (status === "blocked") return "Bloqueado";
  if (status === "active" && Number(progress ?? 0) >= 100) return "Pronto para validação";
  if (status === "active") return "Em preparação";
  if (status === "cancelled") return "Cancelado";
  return "Por preparar";
}

export default async function DeliverablesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string; project_id?: string; closed?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();
  const selectedProjectId = params.project_id ?? "";

  const [
    { data: deliverables, error },
    { data: projects },
    { data: profiles },
    { data: evidence },
    { data: blockers },
    { data: decisions },
  ] = await Promise.all([
    supabase
      .from("deliverables")
      .select("*")
      .eq("user_id", user.id)
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("projects")
      .select("id,title,description,expected_result,priority,progress,start_date,due_date,notes,owner_id,status,objective_id,objectives(title)")
      .eq("user_id", user.id)
      .order("title"),
    supabase.from("profiles").select("id,full_name").order("full_name"),
    supabase
      .from("evidence")
      .select("id,project_id,deliverable_id,title,evidence_type,url,storage_path,description,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("blockers")
      .select("id,project_id,status,title")
      .eq("user_id", user.id)
      .in("status", ["open", "investigating", "waiting"]),
    supabase
      .from("decisions")
      .select("id,project_id,title,decision,rationale,decided_at")
      .eq("user_id", user.id)
      .order("decided_at", { ascending: false }),
  ]);

  const effectiveProjectId = (projects ?? []).some((project) => project.id === selectedProjectId)
    ? selectedProjectId
    : "";
  const effectiveProject = (projects ?? []).find((project) => project.id === effectiveProjectId);
  const preparedDraft = prepareDeliverableDraft(effectiveProject);
  const ownerById = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name || "Utilizador"]));

  const projectGroups = (projects ?? []).map((project) => {
    const projectDeliverables = (deliverables ?? []).filter((item) => item.project_id === project.id);
    const projectEvidence = (evidence ?? []).filter((item) => item.project_id === project.id);
    const projectBlockers = (blockers ?? []).filter((item) => item.project_id === project.id);
    const completed = projectDeliverables.filter((item) => item.status === "completed");
    const withEvidence = projectDeliverables.filter((item) =>
      projectEvidence.some((proof) => proof.deliverable_id === item.id),
    );
    const readyToClose =
      projectDeliverables.length > 0 &&
      completed.length === projectDeliverables.length &&
      withEvidence.length === projectDeliverables.length &&
      projectBlockers.length === 0;
    return {
      project,
      deliverables: projectDeliverables,
      evidence: projectEvidence,
      blockers: projectBlockers,
      completed: completed.length,
      withEvidence: withEvidence.length,
      readyToClose,
      latestDecision: (decisions ?? []).find((item) => item.project_id === project.id),
    };
  });

  const visibleGroups = effectiveProjectId
    ? projectGroups.filter((group) => group.project.id === effectiveProjectId)
    : projectGroups;

  const totalDeliverables = visibleGroups.reduce((sum, group) => sum + group.deliverables.length, 0);
  const totalCompleted = visibleGroups.reduce((sum, group) => sum + group.completed, 0);
  const totalEvidenceReady = visibleGroups.reduce((sum, group) => sum + group.withEvidence, 0);
  const readyProjects = visibleGroups.filter((group) => group.readyToClose).length;

  return (
    <>
      <PageHeader eyebrow="Resultados" title="Entregáveis & Fecho" />
      <FlashMessage
        error={params.error ?? error?.message}
        created={params.created ?? params.closed}
        message={params.closed ? "Decisão de fecho registada e projecto encerrado." : undefined}
      />

      <div className="space-y-6">
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Resumo do fecho</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[var(--cc-radius-md)] bg-[var(--cc-surface-muted)] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-secondary)]">Entregáveis</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--cc-foreground)]">{totalCompleted}/{totalDeliverables}</p>
            </div>
            <div className="rounded-[var(--cc-radius-md)] bg-[var(--cc-surface-muted)] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-secondary)]">Com evidência</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--cc-foreground)]">{totalEvidenceReady}/{totalDeliverables}</p>
            </div>
            <div className="rounded-[var(--cc-radius-md)] bg-[var(--cc-surface-muted)] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-secondary)]">Prontos para fechar</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--cc-foreground)]">{readyProjects}</p>
            </div>
            <div className="rounded-[var(--cc-radius-md)] bg-[var(--cc-surface-muted)] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-secondary)]">Regra</p>
              <p className="mt-2 text-sm font-semibold text-[var(--cc-foreground)]">Entregar → comprovar → decidir → fechar</p>
            </div>
          </div>
        </Card>

        <ManualEntry defaultOpen={Boolean(preparedDraft)}>
          <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Definir entregável</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
            Um entregável é um resultado utilizável: ficheiro final, website publicado, aplicação, dashboard, apresentação, modelo ou outro artefacto real.
          </p>
          <form action={createDeliverable} className="mt-5 space-y-4">
            {preparedDraft && (
              <p className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface-muted)] px-3 py-2 text-xs font-medium text-[var(--cc-secondary)]">
                Proposta preparada a partir do resultado esperado. Reveja o conteúdo e os critérios de aceitação.
              </p>
            )}
            <Select label="Projecto" name="project_id" required defaultValue={effectiveProjectId}>
              <option value="" disabled>Seleccionar projecto</option>
              {(projects ?? []).filter((project) => project.status !== "completed").map((project) => (
                <option key={project.id} value={project.id}>{project.title}</option>
              ))}
            </Select>
            <Field label="Resultado / entregável" name="title" required defaultValue={preparedDraft?.title} placeholder="Ex.: Website institucional publicado" />
            <TextArea label="Matéria real a entregar" name="description" defaultValue={preparedDraft?.description} placeholder="Descreva o resultado utilizável que deve existir no final." />
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Prioridade" name="priority" defaultValue={preparedDraft?.priority ?? "medium"}>
                {PRIORITIES.map((value) => <option key={value} value={value}>{displayLabel(value)}</option>)}
              </Select>
              <Field label="Prazo" name="due_date" type="date" defaultValue={preparedDraft?.due_date} />
            </div>
            <input type="hidden" name="status" value="pending" />
            <input type="hidden" name="progress" value="0" />
            <TextArea label="Critérios de aceitação" name="completion_criteria" defaultValue={preparedDraft?.completion_criteria} />
            <button className={primaryButtonClass} type="submit">Guardar entregável</button>
          </form>
        </ManualEntry>

        <Card>
          <div className="border-b border-[var(--cc-border)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Entregáveis por projecto</h2>
              {effectiveProjectId && <Link className={secondaryButtonClass} href="/deliverables">Todos os projectos</Link>}
            </div>
          </div>
          <div className="p-5">
            {!visibleGroups.length ? (
              <EmptyState>Não existem projectos registados.</EmptyState>
            ) : (
              <div className="space-y-3">
                {visibleGroups.map((group) => (
                  <details key={group.project.id} open={group.project.id === effectiveProjectId} className="rounded-[var(--cc-radius-lg)] border border-[var(--cc-border)]">
                    <summary className="cursor-pointer list-none p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-[var(--cc-foreground)]">{group.project.title}</h3>
                          <p className="mt-1 text-xs text-[var(--cc-secondary)]">
                            {group.completed}/{group.deliverables.length} entregues · {group.withEvidence}/{group.deliverables.length} com evidência
                            {group.blockers.length ? ` · ${group.blockers.length} bloqueio(s)` : ""}
                          </p>
                          <p className="mt-2 text-sm text-[var(--cc-foreground)]">
                            <span className="font-medium">Objectivo Central:</span> {objectiveTitle(group.project.objectives) ?? group.project.expected_result ?? "Por definir"}
                          </p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          group.readyToClose
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-[var(--cc-surface-muted)] text-[var(--cc-secondary)]"
                        }`}>
                          {group.readyToClose ? "Pronto para decisão final" : "Fecho pendente"}
                        </span>
                      </div>
                    </summary>

                    <div className="space-y-4 border-t border-[var(--cc-border)] p-4">
                      {!group.deliverables.length ? (
                        <p className="text-sm text-[var(--cc-secondary)]">Ainda não existem entregáveis definidos.</p>
                      ) : group.deliverables.map((item) => {
                        const proofs = group.evidence.filter((proof) => proof.deliverable_id === item.id);
                        const locked = item.status === "completed";
                        return (
                          <article key={item.id} className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <h4 className="font-semibold text-[var(--cc-foreground)]">{item.title}</h4>
                                <p className="mt-1 text-xs text-[var(--cc-secondary)]">
                                  {deliverableState(item.status, item.progress)}
                                  {item.due_date ? ` · prazo ${formatDate(item.due_date)}` : " · sem prazo"}
                                  {item.owner_id ? ` · ${ownerById.get(item.owner_id) ?? "Responsável definido"}` : ""}
                                </p>
                              </div>
                              {locked && (
                                <span className="rounded-full bg-[var(--cc-surface-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--cc-foreground)]">
                                  Ficheiro final bloqueado
                                </span>
                              )}
                            </div>

                            {item.description && <p className="mt-3 text-sm leading-6 text-[var(--cc-secondary)]">{item.description}</p>}
                            {item.completion_criteria && (
                              <p className="mt-3 text-sm text-[var(--cc-foreground)]">
                                <span className="font-medium">Aceite quando:</span> {item.completion_criteria}
                              </p>
                            )}

                            <div className="mt-4 rounded-[var(--cc-radius-md)] bg-[var(--cc-surface-muted)] p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-secondary)]">Resultado utilizável / evidência</p>
                                {!locked && (
                                  <Link className="text-xs font-semibold text-[var(--cc-accent)] hover:underline" href={`/evidence?project_id=${group.project.id}&deliverable_id=${item.id}`}>
                                    Adicionar evidência
                                  </Link>
                                )}
                              </div>
                              {!proofs.length ? (
                                <p className="mt-2 text-sm text-[var(--cc-secondary)]">Nenhum ficheiro, link ou comprovativo associado.</p>
                              ) : (
                                <div className="mt-2 space-y-2">
                                  {proofs.map((proof) => (
                                    <div key={proof.id} className="text-sm">
                                      <span className="font-medium text-[var(--cc-foreground)]">{proof.title || "Evidência"}</span>
                                      {proof.url && (
                                        <a href={proof.url} target="_blank" rel="noreferrer" className="ml-2 text-[var(--cc-accent)] hover:underline">
                                          Abrir resultado
                                        </a>
                                      )}
                                      {proof.storage_path && !proof.url && <span className="ml-2 text-xs text-[var(--cc-secondary)]">Ficheiro protegido registado</span>}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {!locked ? (
                              <div className="mt-4 border-t border-[var(--cc-border)] pt-4">
                                <StatusProgressForm entity="deliverables" id={item.id} status={item.status} progress={item.progress} />
                                <p className="mt-2 text-xs text-[var(--cc-secondary)]">
                                  Para marcar como concluído/entregue, o progresso deve estar em 100% e deve existir pelo menos uma evidência associada.
                                </p>
                              </div>
                            ) : (
                              <p className="mt-4 text-xs text-[var(--cc-secondary)]">
                                Entregável final bloqueado. Alterações posteriores devem ser registadas como uma nova versão/novo entregável no PCC.
                              </p>
                            )}
                          </article>
                        );
                      })}

                      {group.blockers.length > 0 && (
                        <div className="rounded-[var(--cc-radius-md)] bg-[var(--cc-danger-soft)] p-3 text-sm text-[var(--cc-danger)]">
                          Existem {group.blockers.length} bloqueio(s) activos que impedem o fecho.
                        </div>
                      )}

                      <div className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-4">
                        <h4 className="font-semibold text-[var(--cc-foreground)]">Decisão final</h4>
                        {group.latestDecision && (
                          <p className="mt-2 text-sm text-[var(--cc-secondary)]">
                            Última decisão: {group.latestDecision.decision}
                          </p>
                        )}
                        <form action={finalizeProjectClosure} className="mt-4 space-y-3">
                          <input type="hidden" name="project_id" value={group.project.id} />
                          <Select label="Decisão" name="decision" defaultValue={group.readyToClose ? "close" : "continue"}>
                            <option value="continue">Continuar projecto</option>
                            <option value="close" disabled={!group.readyToClose}>Encerrar projecto</option>
                          </Select>
                          <TextArea label="Fundamento / resultado final" name="rationale" />
                          <button className={group.readyToClose ? primaryButtonClass : secondaryButtonClass} type="submit">
                            Registar decisão
                          </button>
                          {!group.readyToClose && (
                            <p className="text-xs text-[var(--cc-secondary)]">
                              O fecho só fica disponível depois de todos os entregáveis estarem entregues, comprovados e sem bloqueios activos.
                            </p>
                          )}
                        </form>
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
