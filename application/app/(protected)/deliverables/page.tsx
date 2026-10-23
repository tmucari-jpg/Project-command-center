import Link from "next/link";
import {
  createDeliverable,
  finalizeProjectClosure,
  recordDeliverableAcceptance,
  updateDeliverableQa,
  updateProjectClosureState,
} from "@/app/(protected)/mutations";
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

const WORKSTREAM_LABELS: Record<string, string> = {
  general: "Geral",
  commercial: "Comercial",
  financial: "Financeiro",
  operational: "Operacional",
  governance: "Governação",
  technical: "Técnico",
  other: "Outro",
};

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
  searchParams: Promise<{ error?: string; created?: string; project_id?: string; closed?: string; supersedes?: string }>;
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
    { data: acceptances },
    { data: closureStates },
    { data: governanceRisks },
    { data: governanceDependencies },
    { data: changeRequests },
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
    supabase
      .from("deliverable_acceptances")
      .select("*")
      .eq("user_id", user.id),
    supabase
      .from("project_closure_state")
      .select("*")
      .eq("user_id", user.id),
    supabase
      .from("project_governance_risks")
      .select("id,project_id,status,blocks_progress")
      .eq("user_id", user.id),
    supabase
      .from("project_governance_dependencies")
      .select("id,project_id,status,blocks_progress")
      .eq("user_id", user.id),
    supabase
      .from("project_change_requests")
      .select("id,project_id,decision")
      .eq("user_id", user.id),
  ]);

  const effectiveProjectId = (projects ?? []).some((project) => project.id === selectedProjectId)
    ? selectedProjectId
    : "";
  const effectiveProject = (projects ?? []).find((project) => project.id === effectiveProjectId);
  const previousVersion = (deliverables ?? []).find(
    (item) => item.id === params.supersedes && item.project_id === effectiveProjectId && item.status === "completed",
  );
  const preparedDraft = previousVersion
    ? {
        title: previousVersion.title,
        description: previousVersion.description ?? undefined,
        priority: previousVersion.priority,
        due_date: undefined,
        completion_criteria: previousVersion.completion_criteria ?? undefined,
      }
    : prepareDeliverableDraft(effectiveProject);
  const ownerById = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name || "Utilizador"]));

  const projectGroups = (projects ?? []).map((project) => {
    const projectDeliverables = (deliverables ?? []).filter((item) => item.project_id === project.id);
    const supersededIds = new Set(
      projectDeliverables
        .map((item) => item.supersedes_deliverable_id)
        .filter((id): id is string => Boolean(id)),
    );
    const currentDeliverables = projectDeliverables.filter((item) => !supersededIds.has(item.id));
    const projectEvidence = (evidence ?? []).filter((item) => item.project_id === project.id);
    const projectBlockers = (blockers ?? []).filter((item) => item.project_id === project.id);
    const completed = currentDeliverables.filter((item) => item.status === "completed");
    const withEvidence = currentDeliverables.filter((item) =>
      projectEvidence.some((proof) => proof.deliverable_id === item.id),
    );
    const projectAcceptances = (acceptances ?? []).filter((item) => item.project_id === project.id);
    const accepted = currentDeliverables.filter((item) =>
      projectAcceptances.some((acceptance) =>
        acceptance.deliverable_id === item.id &&
        ["accepted", "accepted_with_reservations"].includes(acceptance.status),
      ),
    );
    const closureState = (closureStates ?? []).find((item) => item.project_id === project.id);
    const blockingRisks = (governanceRisks ?? []).filter(
      (item) => item.project_id === project.id && item.blocks_progress && !["mitigated", "accepted", "resolved"].includes(item.status),
    );
    const blockingDependencies = (governanceDependencies ?? []).filter(
      (item) => item.project_id === project.id && item.blocks_progress && !["resolved", "confirmed"].includes(item.status),
    );
    const pendingChanges = (changeRequests ?? []).filter(
      (item) => item.project_id === project.id && item.decision === "pending",
    );
    const closureReady =
      Boolean(closureState) &&
      closureState.value_status !== "not_assessed" &&
      closureState.financial_status === "updated" &&
      closureState.handover_status !== "pending" &&
      closureState.security_transfer_status !== "pending" &&
      closureState.continuity_status !== "pending";
    const readyToClose =
      currentDeliverables.length > 0 &&
      completed.length === currentDeliverables.length &&
      withEvidence.length === currentDeliverables.length &&
      accepted.length === currentDeliverables.length &&
      projectBlockers.length === 0 &&
      blockingRisks.length === 0 &&
      blockingDependencies.length === 0 &&
      pendingChanges.length === 0 &&
      closureReady;
    return {
      project,
      deliverables: projectDeliverables,
      currentDeliverables,
      supersededIds,
      evidence: projectEvidence,
      blockers: projectBlockers,
      completed: completed.length,
      withEvidence: withEvidence.length,
      accepted: accepted.length,
      acceptances: projectAcceptances,
      closureState,
      blockingRisks,
      blockingDependencies,
      pendingChanges,
      readyToClose,
      latestDecision: (decisions ?? []).find((item) => item.project_id === project.id),
    };
  });

  const visibleGroups = effectiveProjectId
    ? projectGroups.filter((group) => group.project.id === effectiveProjectId)
    : projectGroups;

  const totalDeliverables = visibleGroups.reduce((sum, group) => sum + group.currentDeliverables.length, 0);
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
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-secondary)]">Aceites</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--cc-foreground)]">
                {visibleGroups.reduce((sum, group) => sum + group.accepted, 0)}/{totalDeliverables}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-[var(--cc-secondary)]">
            Regra de fecho: entregar → QA → comprovar → obter aceitação → transferir com segurança → avaliar valor → fechar.
          </p>
        </Card>

        <ManualEntry defaultOpen={Boolean(preparedDraft)}>
          <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Definir entregável</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
            Um entregável é um resultado utilizável: ficheiro final, website publicado, aplicação, dashboard, apresentação, modelo ou outro artefacto real.
          </p>
          <form action={createDeliverable} className="mt-5 space-y-4">
            {previousVersion && (
              <input type="hidden" name="supersedes_deliverable_id" value={previousVersion.id} />
            )}
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
            <Select label="Vertente do entregável" name="workstream" defaultValue={previousVersion?.workstream ?? "general"}>
              <option value="general">Geral</option>
              <option value="commercial">Comercial</option>
              <option value="financial">Financeiro</option>
              <option value="operational">Operacional</option>
              <option value="governance">Governação</option>
              <option value="technical">Técnico</option>
              <option value="other">Outro</option>
            </Select>
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
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Formato do resultado" name="artifact_type" defaultValue={previousVersion?.artifact_type ?? "other"}>
                <option value="document">Documento Word / texto</option>
                <option value="spreadsheet">Excel / folha de cálculo</option>
                <option value="presentation">PowerPoint / apresentação</option>
                <option value="pdf">PDF final</option>
                <option value="website">Website publicado</option>
                <option value="application">Aplicação / sistema</option>
                <option value="dashboard">Dashboard funcional</option>
                <option value="api">API / endpoint</option>
                <option value="dataset">Base de dados / dataset</option>
                <option value="prototype">Demo / protótipo</option>
                <option value="other">Outro resultado utilizável</option>
              </Select>
              <Field
                label="URL oficial, quando aplicável"
                name="artifact_url"
                type="url"
                defaultValue={previousVersion?.artifact_url ?? undefined}
                placeholder="https://..."
              />
            </div>
            <Field
              label="Referência imutável da versão"
              name="artifact_reference"
              defaultValue={undefined}
              placeholder="Ex.: deployment ID, commit SHA, release ou hash"
            />
            <p className="text-xs leading-5 text-[var(--cc-secondary)]">
              Para websites, aplicações, dashboards e APIs, o URL publicado e uma referência imutável da versão são obrigatórios antes da entrega final.
              O registo oficial do PCC não é sobrescrito: qualquer alteração posterior cria uma nova versão.
            </p>
            <button className={primaryButtonClass} type="submit">{previousVersion ? "Criar nova versão" : "Guardar entregável"}</button>
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
                            {group.completed}/{group.currentDeliverables.length} entregues · {group.withEvidence}/{group.currentDeliverables.length} com evidência
                            {group.blockers.length ? ` · ${group.blockers.length} bloqueio(s)` : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            group.readyToClose
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-[var(--cc-surface-muted)] text-[var(--cc-secondary)]"
                          }`}>
                            {group.readyToClose ? "Pronto para decisão final" : "Fecho pendente"}
                          </span>
                          <span className="text-xs font-semibold text-[var(--cc-accent)]">Ver detalhes</span>
                        </div>
                      </div>
                    </summary>

                    <div className="space-y-4 border-t border-[var(--cc-border)] p-4">
                      {!group.deliverables.length ? (
                        <p className="text-sm text-[var(--cc-secondary)]">Ainda não existem entregáveis definidos.</p>
                      ) : group.deliverables.map((item) => {
                        const proofs = group.evidence.filter((proof) => proof.deliverable_id === item.id);
                        const locked = item.status === "completed";
                        const superseded = group.supersededIds.has(item.id);
                        return (
                          <article key={item.id} className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <h4 className="font-semibold text-[var(--cc-foreground)]">{item.title}</h4>
                                <p className="mt-1 text-xs text-[var(--cc-secondary)]">
                                  {WORKSTREAM_LABELS[item.workstream ?? "general"] ?? displayLabel(item.workstream ?? "general")} · {deliverableState(item.status, item.progress)}
                                  {item.artifact_version ? ` · versão ${item.artifact_version}` : ""}
                                  {item.due_date ? ` · prazo ${formatDate(item.due_date)}` : " · sem prazo"}
                                  {item.owner_id ? ` · ${ownerById.get(item.owner_id) ?? "Responsável definido"}` : ""}
                                </p>
                              </div>
                              {superseded ? (
                                <span className="rounded-full bg-[var(--cc-surface-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--cc-secondary)]">
                                  Histórico · substituído
                                </span>
                              ) : locked ? (
                                <span className="rounded-full bg-[var(--cc-surface-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--cc-foreground)]">
                                  Registo oficial imutável
                                </span>
                              ) : null}
                            </div>

                            {item.description && <p className="mt-3 text-sm leading-6 text-[var(--cc-secondary)]">{item.description}</p>}
                            {item.completion_criteria && (
                              <p className="mt-3 text-sm text-[var(--cc-foreground)]">
                                <span className="font-medium">Aceite quando:</span> {item.completion_criteria}
                              </p>
                            )}
                            {(item.artifact_url || item.artifact_reference) && (
                              <div className="mt-3 text-sm text-[var(--cc-secondary)]">
                                {item.artifact_url && (
                                  <p>
                                    <span className="font-medium text-[var(--cc-foreground)]">Resultado oficial:</span>{" "}
                                    <a href={item.artifact_url} target="_blank" rel="noreferrer" className="text-[var(--cc-accent)] hover:underline">
                                      {["document", "spreadsheet", "presentation", "pdf"].includes(item.artifact_type) ? "Baixar / abrir" : "Abrir"}
                                    </a>
                                  </p>
                                )}
                                {item.artifact_reference && (
                                  <p className="mt-1 break-all">
                                    <span className="font-medium text-[var(--cc-foreground)]">Versão imutável:</span> {item.artifact_reference}
                                  </p>
                                )}
                              </div>
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
                              <div className="mt-4 space-y-4 border-t border-[var(--cc-border)] pt-4">
                                <form action={updateDeliverableQa} className="grid gap-3 md:grid-cols-[220px_1fr_auto]">
                                  <input type="hidden" name="project_id" value={group.project.id} />
                                  <input type="hidden" name="deliverable_id" value={item.id} />
                                  <Select label="QA" name="qa_status" defaultValue={item.qa_status === "approved" ? "approved" : "ready_for_review"}>
                                    <option value="ready_for_review">Pronto para revisão</option>
                                    <option value="approved">QA aprovado</option>
                                    <option value="changes_required">Requer correcções</option>
                                  </Select>
                                  <TextArea label="Notas de QA" name="qa_notes" defaultValue={item.qa_notes ?? ""} />
                                  <button className={secondaryButtonClass} type="submit">Guardar QA</button>
                                </form>
                                <StatusProgressForm entity="deliverables" id={item.id} status={item.status} progress={item.progress} />
                                <p className="text-xs text-[var(--cc-secondary)]">
                                  A entrega oficial exige progresso a 100%, evidência associada, critérios de aceitação e QA aprovado.
                                </p>
                              </div>
                            ) : superseded ? (
                              <div className="mt-4 border-t border-[var(--cc-border)] pt-4">
                                <p className="text-xs text-[var(--cc-secondary)]">
                                  Esta versão permanece no histórico e foi substituída por uma versão posterior.
                                </p>
                              </div>
                            ) : (
                              <div className="mt-4 space-y-4 border-t border-[var(--cc-border)] pt-4">
                                <p className="text-xs text-[var(--cc-secondary)]">
                                  Registo oficial bloqueado. A aceitação do cliente é independente da produção e fica registada por versão.
                                </p>
                                <form action={recordDeliverableAcceptance} className="grid gap-3 md:grid-cols-[240px_220px_1fr_auto]">
                                  <input type="hidden" name="project_id" value={group.project.id} />
                                  <input type="hidden" name="deliverable_id" value={item.id} />
                                  <Select
                                    label="Aceitação"
                                    name="status"
                                    defaultValue={group.acceptances.find((acceptance) => acceptance.deliverable_id === item.id)?.status ?? "pending_review"}
                                  >
                                    <option value="pending_review">Aguardando validação</option>
                                    <option value="accepted">Aceite</option>
                                    <option value="accepted_with_reservations">Aceite com reservas</option>
                                    <option value="correction_required">Requer correcção</option>
                                  </Select>
                                  <Field
                                    label="Validado por"
                                    name="accepted_by"
                                    defaultValue={group.acceptances.find((acceptance) => acceptance.deliverable_id === item.id)?.accepted_by ?? ""}
                                  />
                                  <TextArea
                                    label="Notas"
                                    name="notes"
                                    defaultValue={group.acceptances.find((acceptance) => acceptance.deliverable_id === item.id)?.notes ?? ""}
                                  />
                                  <button className={secondaryButtonClass} type="submit">Registar aceite</button>
                                </form>
                                <div className="flex justify-end">
                                  <Link
                                    className={secondaryButtonClass}
                                    href={`/deliverables?project_id=${group.project.id}&supersedes=${item.id}`}
                                  >
                                    Criar nova versão
                                  </Link>
                                </div>
                              </div>
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
                        <h4 className="font-semibold text-[var(--cc-foreground)]">Valor, handover e segurança</h4>
                        <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
                          Antes do G5, registe o valor alcançado ou em observação, confirme o financeiro e trate a transferência de activos/acessos quando aplicável.
                        </p>
                        <form action={updateProjectClosureState} className="mt-4 grid gap-4 md:grid-cols-2">
                          <input type="hidden" name="project_id" value={group.project.id} />
                          <Select label="Valor" name="value_status" defaultValue={group.closureState?.value_status ?? "not_assessed"}>
                            <option value="not_assessed">Ainda não avaliado</option>
                            <option value="proved">Valor comprovado</option>
                            <option value="observing">Valor em observação</option>
                            <option value="not_proved">Valor não comprovado</option>
                          </Select>
                          <Select label="Financeiro" name="financial_status" defaultValue={group.closureState?.financial_status ?? "pending"}>
                            <option value="pending">Pendente</option>
                            <option value="updated">Actualizado</option>
                          </Select>
                          <Select label="Handover" name="handover_status" defaultValue={group.closureState?.handover_status ?? "not_applicable"}>
                            <option value="not_applicable">Não aplicável</option>
                            <option value="pending">Pendente</option>
                            <option value="completed">Concluído</option>
                          </Select>
                          <Select label="Transferência / revogação de acessos" name="security_transfer_status" defaultValue={group.closureState?.security_transfer_status ?? "not_applicable"}>
                            <option value="not_applicable">Não aplicável</option>
                            <option value="pending">Pendente</option>
                            <option value="completed">Concluída</option>
                          </Select>
                          <Select label="Continuidade / recuperação" name="continuity_status" defaultValue={group.closureState?.continuity_status ?? "not_applicable"}>
                            <option value="not_applicable">Não aplicável</option>
                            <option value="pending">Pendente</option>
                            <option value="confirmed">Confirmada</option>
                          </Select>
                          <TextArea label="Evidência de valor" name="value_evidence" defaultValue={group.closureState?.value_evidence ?? ""} />
                          <TextArea label="Notas de handover" name="handover_notes" defaultValue={group.closureState?.handover_notes ?? ""} />
                          <TextArea label="Notas de segurança / acessos" name="security_transfer_notes" defaultValue={group.closureState?.security_transfer_notes ?? ""} />
                          <TextArea label="Continuidade / backup / recuperação" name="continuity_notes" defaultValue={group.closureState?.continuity_notes ?? ""} />
                          <TextArea label="Lições aprendidas" name="lessons_learned" defaultValue={group.closureState?.lessons_learned ?? ""} />
                          <div className="md:col-span-2">
                            <TextArea label="Acompanhamento posterior, quando necessário" name="next_follow_up" defaultValue={group.closureState?.next_follow_up ?? ""} />
                          </div>
                          <div className="md:col-span-2">
                            <button className={secondaryButtonClass} type="submit">Guardar preparação do fecho</button>
                          </div>
                        </form>
                      </div>

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
                              O fecho só fica disponível depois de entrega, QA, evidência, aceitação, riscos/dependências, alterações, financeiro, valor, handover e segurança estarem tratados.
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
