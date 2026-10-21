import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { createAction, createBlocker, setNextAction } from "@/app/(protected)/mutations";
import { Field, Select, TextArea } from "@/components/form-fields";
import { FlashMessage } from "@/components/flash-message";
import { ManualEntry } from "@/components/manual-entry";
import { PageHeader } from "@/components/page-header";
import { StatusProgressForm } from "@/components/status-progress-form";
import { Card, EmptyState, primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import { PRIORITIES } from "@/lib/constants";
import { requireUser } from "@/lib/auth";
import { displayLabel } from "@/lib/display-label";
import { formatDateTime } from "@/lib/format";
import { prepareActionDraft } from "@/lib/action-autonomy";

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function actionState(action: { status: string; due_at: string | null }, now: Date) {
  if (action.status === "completed") return "Concluída";
  if (action.status === "blocked") return "Bloqueada";
  if (action.due_at && new Date(action.due_at) < now) return "Em atraso";
  if (action.status === "in_progress") return "Em curso";
  return "Pendente";
}

export default async function ActionsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string; project_id?: string; view?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();
  const now = new Date();
  const dueSoonLimit = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const selectedProjectId = params.project_id ?? "";
  const view = ["all", "attention", "today", "completed", "blocked"].includes(params.view ?? "")
    ? params.view!
    : "all";

  const [
    { data: actions, error },
    { data: projects },
    { data: deliverables },
    { data: blockers },
  ] = await Promise.all([
    supabase
      .from("actions")
      .select("*, projects(title), deliverables(title)")
      .eq("user_id", user.id)
      .order("is_next_action", { ascending: false })
      .order("due_at", { ascending: true, nullsFirst: false }),
    supabase
      .from("projects")
      .select("id,title,priority,next_action,status,progress")
      .eq("user_id", user.id)
      .not("status", "in", '("completed","cancelled")')
      .order("title"),
    supabase
      .from("deliverables")
      .select("id,title,project_id,status,priority,due_date,completion_criteria")
      .eq("user_id", user.id)
      .order("title"),
    supabase
      .from("blockers")
      .select("id,project_id,action_id,title,status,impact,resolution_due_at")
      .eq("user_id", user.id)
      .in("status", ["open", "investigating", "waiting"])
      .order("identified_at", { ascending: false }),
  ]);

  const effectiveProjectId = (projects ?? []).some((project) => project.id === selectedProjectId)
    ? selectedProjectId
    : "";

  const visibleDeliverables = effectiveProjectId
    ? (deliverables ?? []).filter((item) => item.project_id === effectiveProjectId)
    : (deliverables ?? []);

  const preparedDraft = prepareActionDraft(
    (projects ?? []).find((project) => project.id === effectiveProjectId),
    visibleDeliverables,
    (actions ?? []).map((action) => ({ title: action.title, status: action.status })),
  );

  const openActions = (actions ?? []).filter((action) => !["completed", "cancelled"].includes(action.status));
  const overdueActions = openActions.filter((action) => action.due_at && new Date(action.due_at) < now);
  const blockedActions = openActions.filter((action) => action.status === "blocked");
  const dueSoonActions = openActions.filter((action) => {
    if (!action.due_at) return false;
    const due = new Date(action.due_at);
    return due >= now && due <= dueSoonLimit;
  });

  const explicitNext = openActions.find((action) => action.is_next_action);
  const suggestedNext = [...openActions].sort((a, b) => {
    const aBlocked = a.status === "blocked" ? 1 : 0;
    const bBlocked = b.status === "blocked" ? 1 : 0;
    if (aBlocked !== bBlocked) return aBlocked - bBlocked;
    const aDue = a.due_at ? new Date(a.due_at).getTime() : Number.POSITIVE_INFINITY;
    const bDue = b.due_at ? new Date(b.due_at).getTime() : Number.POSITIVE_INFINITY;
    return aDue - bDue;
  })[0];
  const nextAction = explicitNext ?? suggestedNext;

  type ActionRow = NonNullable<typeof actions>[number];
  type BlockerRow = NonNullable<typeof blockers>[number];

  const groups = (projects ?? []).map((project) => {
    const projectActions = (actions ?? []).filter((action) => action.project_id === project.id);
    const projectBlockers = (blockers ?? []).filter((blocker) => blocker.project_id === project.id);
    const open = projectActions.filter((action) => !["completed", "cancelled"].includes(action.status));
    const overdue = open.filter((action) => action.due_at && new Date(action.due_at) < now);
    const blocked = open.filter((action) => action.status === "blocked");
    const dueSoon = open.filter((action) => {
      if (!action.due_at) return false;
      const due = new Date(action.due_at);
      return due >= now && due <= dueSoonLimit;
    });
    const projectNext = open.find((action) => action.is_next_action) ??
      [...open].sort((a, b) => {
        const aDue = a.due_at ? new Date(a.due_at).getTime() : Number.POSITIVE_INFINITY;
        const bDue = b.due_at ? new Date(b.due_at).getTime() : Number.POSITIVE_INFINITY;
        return aDue - bDue;
      })[0];

    return {
      project,
      actions: projectActions,
      blockers: projectBlockers,
      open,
      overdue,
      blocked,
      dueSoon,
      next: projectNext,
      attention: overdue.length + blocked.length + projectBlockers.length + dueSoon.length,
    };
  });

  const unassignedActions = (actions ?? []).filter((action) => !action.project_id);
  const unassignedBlockers = (blockers ?? []).filter((blocker) => !blocker.project_id);

  const allGroups = [
    ...groups,
    ...(unassignedActions.length || unassignedBlockers.length ? [{
      project: { id: "", title: "Sem projecto", priority: "medium", next_action: null, status: "active", progress: 0 },
      actions: unassignedActions,
      blockers: unassignedBlockers,
      open: unassignedActions.filter((action) => !["completed", "cancelled"].includes(action.status)),
      overdue: unassignedActions.filter((action) => action.due_at && new Date(action.due_at) < now && !["completed", "cancelled"].includes(action.status)),
      blocked: unassignedActions.filter((action) => action.status === "blocked"),
      dueSoon: unassignedActions.filter((action) => {
        if (!action.due_at || ["completed", "cancelled"].includes(action.status)) return false;
        const due = new Date(action.due_at);
        return due >= now && due <= dueSoonLimit;
      }),
      next: unassignedActions.find((action) => action.is_next_action),
      attention: unassignedActions.filter((action) => action.status !== "completed").length + unassignedBlockers.length,
    }] : []),
  ].sort((a, b) => b.attention - a.attention || a.project.title.localeCompare(b.project.title));

  function visibleAction(action: ActionRow) {
    if (effectiveProjectId && action.project_id !== effectiveProjectId) return false;
    if (view === "completed") return action.status === "completed";
    if (view === "today") return Boolean(action.due_at && sameDay(new Date(action.due_at), now));
    if (view === "blocked") return action.status === "blocked" || (blockers ?? []).some((b) => b.action_id === action.id);
    if (view === "attention") {
      if (["completed", "cancelled"].includes(action.status)) return false;
      const overdue = Boolean(action.due_at && new Date(action.due_at) < now);
      const dueSoon = Boolean(action.due_at && new Date(action.due_at) >= now && new Date(action.due_at) <= dueSoonLimit);
      const hasBlocker = action.status === "blocked" || (blockers ?? []).some((b) => b.action_id === action.id);
      return overdue || dueSoon || hasBlocker;
    }
    return action.status !== "cancelled";
  }

  const maxAttention = Math.max(1, ...allGroups.map((group) => group.attention));

  return (
    <>
      <PageHeader eyebrow="Execução" title="Executar" />
      <FlashMessage error={params.error ?? error?.message} created={params.created} />

      <div className="space-y-6">
        <Card className="p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">1. Visão rápida dos projectos</h2>
              <p className="mt-1 text-sm text-[var(--cc-secondary)]">
                Acções que exigem atenção por projecto: atrasos, bloqueios e prazos próximos.
              </p>
            </div>
            <span className="text-xs text-[var(--cc-secondary)]">Quanto maior a barra, maior a pressão operacional.</span>
          </div>
          <div className="mt-5 space-y-3">
            {allGroups.filter((group) => group.project.id).map((group) => (
              <div key={group.project.id} className="grid gap-2 sm:grid-cols-[180px_1fr_48px] sm:items-center">
                <Link href={`/actions?project_id=${group.project.id}&view=attention`} className="truncate text-sm font-medium text-[var(--cc-foreground)] hover:underline">
                  {group.project.title}
                </Link>
                <div className="h-3 overflow-hidden rounded-full bg-[var(--cc-surface-muted)]">
                  <div
                    className="h-full rounded-full bg-[var(--cc-accent)]"
                    style={{ width: `${Math.max(group.attention ? 8 : 0, (group.attention / maxAttention) * 100)}%` }}
                  />
                </div>
                <span className="text-right text-sm font-semibold text-[var(--cc-foreground)]">{group.attention}</span>
              </div>
            ))}
          </div>
        </Card>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-[var(--cc-foreground)]">2. O que precisa de atenção agora?</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-secondary)]">Próxima acção</p>
              <p className="mt-2 text-sm font-semibold text-[var(--cc-foreground)]">{nextAction?.title ?? "Sem acções abertas"}</p>
              {nextAction && !explicitNext && <p className="mt-1 text-xs text-[var(--cc-secondary)]">Sugerida pelo prazo actual</p>}
            </Card>
            <Link href="/actions?view=attention"><Card className="h-full p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-secondary)]">Em atraso</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--cc-foreground)]">{overdueActions.length}</p>
            </Card></Link>
            <Link href="/actions?view=blocked"><Card className="h-full p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-secondary)]">Bloqueadas</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--cc-foreground)]">{blockedActions.length + (blockers?.length ?? 0)}</p>
            </Card></Link>
            <Link href="/actions?view=attention"><Card className="h-full p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-secondary)]">A vencer</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--cc-foreground)]">{dueSoonActions.length}</p>
            </Card></Link>
          </div>
        </section>

        <Card>
          <div className="border-b border-[var(--cc-border)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">3. Projectos</h2>
                <p className="mt-1 text-sm text-[var(--cc-secondary)]">
                  Abra apenas o projecto em que pretende actuar.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  ["all", "Todas"],
                  ["attention", "Atenção"],
                  ["today", "Hoje"],
                  ["completed", "Concluídas"],
                ].map(([value, label]) => (
                  <Link
                    key={value}
                    href={`/actions?view=${value}${effectiveProjectId ? `&project_id=${effectiveProjectId}` : ""}`}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                      view === value
                        ? "bg-[var(--cc-accent)] text-white"
                        : "border border-[var(--cc-border)] text-[var(--cc-foreground)]"
                    }`}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="p-5">
            <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
              <input type="hidden" name="view" value={view} />
              <label className="text-xs font-semibold text-[var(--cc-secondary)]">
                Filtrar por projecto
                <select
                  name="project_id"
                  defaultValue={effectiveProjectId}
                  className="mt-1 block min-w-56 rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-white px-3 py-2 text-sm text-[var(--cc-foreground)]"
                >
                  <option value="">Todos os projectos</option>
                  {(projects ?? []).map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
                </select>
              </label>
              <button className={secondaryButtonClass} type="submit">Aplicar</button>
            </form>

            <div className="space-y-3">
              {allGroups
                .filter((group) => !effectiveProjectId || group.project.id === effectiveProjectId)
                .map((group) => {
                  const visible = group.actions.filter(visibleAction);
                  const openBlockers = group.blockers.filter((blocker: BlockerRow) => !["resolved", "ignored"].includes(blocker.status));
                  if (!visible.length && view !== "all" && !openBlockers.length) return null;

                  return (
                    <details
                      key={group.project.id || "sem-projecto"}
                      open={Boolean(effectiveProjectId && group.project.id === effectiveProjectId)}
                      className="rounded-[var(--cc-radius-lg)] border border-[var(--cc-border)]"
                    >
                      <summary className="cursor-pointer list-none p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="font-semibold text-[var(--cc-foreground)]">{group.project.title}</h3>
                            <p className="mt-1 text-xs text-[var(--cc-secondary)]">
                              {group.open.length} aberta(s)
                              {group.overdue.length ? ` · ${group.overdue.length} em atraso` : ""}
                              {openBlockers.length ? ` · ${openBlockers.length} bloqueio(s)` : ""}
                            </p>
                            {(group.next?.title || group.project.next_action) && (
                              <p className="mt-2 text-sm text-[var(--cc-foreground)]">
                                <span className="font-medium">Próxima:</span> {group.next?.title ?? group.project.next_action}
                              </p>
                            )}
                          </div>
                          <span className="text-xs font-semibold text-[var(--cc-accent)]">Ver acções</span>
                        </div>
                      </summary>

                      <div className="space-y-4 border-t border-[var(--cc-border)] p-4">
                        {visible.length ? visible.map((action) => {
                          const relatedBlockers = (blockers ?? []).filter((blocker) => blocker.action_id === action.id);
                          const state = actionState(action, now);
                          return (
                            <article key={action.id} className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface-strong)] p-4">
                              <div className="flex flex-col justify-between gap-3 md:flex-row">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h4 className="font-semibold text-[var(--cc-foreground)]">{action.title}</h4>
                                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                      state === "Em atraso" || state === "Bloqueada"
                                        ? "bg-[var(--cc-danger-soft)] text-[var(--cc-danger)]"
                                        : "bg-[var(--cc-surface-muted)] text-[var(--cc-secondary)]"
                                    }`}>{state}</span>
                                    {action.is_next_action && <span className="rounded-full bg-[color-mix(in_srgb,var(--cc-gold)_18%,white)] px-2 py-1 text-xs font-semibold text-[var(--cc-accent)]">Próxima acção</span>}
                                  </div>
                                  <p className="mt-2 text-sm text-[var(--cc-secondary)]">
                                    Prazo: {action.due_at ? formatDateTime(action.due_at) : "Sem prazo"}
                                  </p>
                                  {relatedBlockers.map((blocker) => (
                                    <p key={blocker.id} className="mt-2 text-sm text-[var(--cc-danger)]">
                                      <TriangleAlert className="mr-1 inline" size={14} /> {blocker.title}
                                    </p>
                                  ))}
                                </div>
                                {!action.is_next_action && !["completed", "cancelled"].includes(action.status) && (
                                  <form action={setNextAction}>
                                    <input type="hidden" name="id" value={action.id} />
                                    <button className="text-xs font-semibold text-[var(--cc-accent)] hover:underline" type="submit">Definir como próxima</button>
                                  </form>
                                )}
                              </div>
                              <div className="mt-4 border-t border-[var(--cc-border)] pt-4">
                                <StatusProgressForm entity="actions" id={action.id} status={action.status} />
                              </div>
                            </article>
                          );
                        }) : <EmptyState>Sem acções para este filtro.</EmptyState>}

                        {openBlockers.length > 0 && (
                          <details className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-3">
                            <summary className="cursor-pointer text-sm font-semibold text-[var(--cc-foreground)]">
                              Bloqueios do projecto · {openBlockers.length}
                            </summary>
                            <div className="mt-3 space-y-2">
                              {openBlockers.map((blocker: BlockerRow) => (
                                <div key={blocker.id} className="rounded-lg bg-[var(--cc-danger-soft)] p-3 text-sm">
                                  <p className="font-semibold text-[var(--cc-danger)]">{blocker.title}</p>
                                  {blocker.impact && <p className="mt-1 text-[var(--cc-secondary)]">{blocker.impact}</p>}
                                  <p className="mt-1 text-xs text-[var(--cc-secondary)]">
                                    Resolver até: {blocker.resolution_due_at ? formatDateTime(blocker.resolution_due_at) : "Sem prazo"}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}

                        {group.project.id && (
                          <Link className={secondaryButtonClass} href={`/projects/${group.project.id}`}>Abrir detalhe do projecto</Link>
                        )}
                      </div>
                    </details>
                  );
                })}
            </div>
          </div>
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          <ManualEntry defaultOpen={Boolean(preparedDraft)}>
            <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Adicionar acção</h2>
            <p className="mt-1 text-sm text-[var(--cc-secondary)]">
              A informação pode ser automática ou manual; qualquer alteração deve permanecer coerente com o projecto.
            </p>
            <form action={createAction} className="mt-5 space-y-4">
              <Field label="Título" name="title" required placeholder="Ex.: Confirmar requisitos com o responsável." defaultValue={preparedDraft?.title} />
              <Select label="Projecto" name="project_id" defaultValue={effectiveProjectId}>
                <option value="">Sem projecto</option>
                {(projects ?? []).map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
              </Select>
              <Select label="Entregável, se aplicável" name="deliverable_id" defaultValue={preparedDraft?.deliverable_id ?? ""}>
                <option value="">Sem entregável</option>
                {visibleDeliverables.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </Select>
              <TextArea label="Descrição" name="description" />
              <div className="grid gap-4 sm:grid-cols-2">
                <Select label="Prioridade" name="priority" defaultValue={preparedDraft?.priority ?? "medium"}>
                  {PRIORITIES.map((value) => <option key={value} value={value}>{displayLabel(value)}</option>)}
                </Select>
                <Field label="Prazo" name="due_at" type="datetime-local" />
              </div>
              <input type="hidden" name="status" value="pending" />
              <TextArea label="Critério de conclusão" name="completion_criteria" defaultValue={preparedDraft?.completion_criteria} />
              <button className={primaryButtonClass} type="submit">Guardar acção</button>
            </form>
          </ManualEntry>

          <ManualEntry>
            <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Registar bloqueio</h2>
            <form action={createBlocker} className="mt-5 space-y-4">
              <Field label="Título" name="title" required placeholder="Ex.: Aguardar aprovação do conteúdo final." />
              <Select label="Projecto" name="project_id" defaultValue={effectiveProjectId}>
                <option value="">Sem projecto</option>
                {(projects ?? []).map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
              </Select>
              <Select label="Acção, se aplicável" name="action_id" defaultValue="">
                <option value="">Sem acção</option>
                {(actions ?? []).filter((action) => !effectiveProjectId || action.project_id === effectiveProjectId).map((action) => (
                  <option key={action.id} value={action.id}>{action.title}</option>
                ))}
              </Select>
              <input type="hidden" name="deliverable_id" value="" />
              <TextArea label="Impacto" name="impact" />
              <Field label="Prazo de resolução" name="resolution_due_at" type="datetime-local" />
              <input type="hidden" name="status" value="open" />
              <input type="hidden" name="responsible" value="" />
              <input type="hidden" name="description" value="" />
              <input type="hidden" name="solution" value="" />
              <button className={primaryButtonClass} type="submit">Guardar bloqueio</button>
            </form>
          </ManualEntry>
        </div>
      </div>
    </>
  );
}
