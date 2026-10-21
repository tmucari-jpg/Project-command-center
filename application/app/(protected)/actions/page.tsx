import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import {
  createAction,
  setNextAction,
  validateProjectExecution,
} from "@/app/(protected)/mutations";
import { Field, Select, TextArea } from "@/components/form-fields";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { ManualEntry } from "@/components/manual-entry";
import { SimpleBarChart } from "@/components/simple-bar-chart";
import { StatusProgressForm } from "@/components/status-progress-form";
import { Card, EmptyState, primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import { PRIORITIES } from "@/lib/constants";
import { requireUser } from "@/lib/auth";
import { displayLabel } from "@/lib/display-label";
import { formatDateTime } from "@/lib/format";
import { prepareActionDraft } from "@/lib/action-autonomy";

type View = "all" | "today" | "attention" | "completed";

export default async function ActionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    created?: string;
    project_id?: string;
    view?: string;
    validation?: string;
  }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();
  const selectedProjectId = params.project_id ?? "";
  const view: View = params.view === "today" || params.view === "attention" || params.view === "completed" ? params.view : "all";

  const [
    { data: allActions, error },
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
      .select("id,title,priority,next_action,objective_id,status")
      .eq("user_id", user.id)
      .order("title"),
    supabase
      .from("deliverables")
      .select("id,title,project_id,status,priority,due_date,completion_criteria")
      .eq("user_id", user.id)
      .order("title"),
    supabase
      .from("blockers")
      .select("id,title,status,impact,project_id,action_id,resolution_due_at")
      .eq("user_id", user.id)
      .in("status", ["open", "investigating", "waiting"]),
  ]);

  const effectiveProjectId = (projects ?? []).some((project) => project.id === selectedProjectId)
    ? selectedProjectId
    : "";
  const effectiveProject = (projects ?? []).find((project) => project.id === effectiveProjectId);
  const visibleDeliverables = effectiveProjectId
    ? (deliverables ?? []).filter((item) => item.project_id === effectiveProjectId)
    : (deliverables ?? []);

  const preparedDraft = prepareActionDraft(
    effectiveProject,
    visibleDeliverables,
    (allActions ?? []).map((action) => ({ title: action.title, status: action.status })),
  );

  const now = new Date();
  const soon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const maputoDate = (value: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Maputo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(value);
  const todayKey = maputoDate(now);
  const isClosed = (status: string) => ["completed", "cancelled"].includes(status);
  const isOverdue = (action: NonNullable<typeof allActions>[number]) =>
    Boolean(action.due_at && new Date(action.due_at) < now && !isClosed(action.status));
  const isDueSoon = (action: NonNullable<typeof allActions>[number]) =>
    Boolean(action.due_at && new Date(action.due_at) >= now && new Date(action.due_at) <= soon && !isClosed(action.status));

  const actions = (allActions ?? []).filter((action) => {
    if (effectiveProjectId && action.project_id !== effectiveProjectId) return false;
    if (view === "completed") return action.status === "completed";
    if (view === "today") {
      return Boolean(
        action.due_at &&
        maputoDate(new Date(action.due_at)) === todayKey &&
        !isClosed(action.status),
      );
    }
    if (view === "attention") {
      const blocked = (blockers ?? []).some((blocker) => blocker.action_id === action.id);
      return isOverdue(action) || isDueSoon(action) || action.status === "blocked" || blocked;
    }
    return !isClosed(action.status);
  });

  const nextAction = (allActions ?? []).find(
    (action) => action.is_next_action && !isClosed(action.status),
  );
  const overdueTotal = (allActions ?? []).filter(isOverdue).length;
  const dueSoonTotal = (allActions ?? []).filter(isDueSoon).length;
  const blockedTotal = (blockers ?? []).length;

  type ActionRow = NonNullable<typeof allActions>[number];
  type BlockerRow = NonNullable<typeof blockers>[number];
  const groups = new Map<string, {
    projectId: string | null;
    title: string;
    actions: ActionRow[];
    blockers: BlockerRow[];
  }>();

  for (const project of projects ?? []) {
    if (effectiveProjectId && project.id !== effectiveProjectId) continue;
    groups.set(project.id, { projectId: project.id, title: project.title, actions: [] as ActionRow[], blockers: [] as BlockerRow[] });
  }

  for (const action of actions) {
    const relation = Array.isArray(action.projects) ? action.projects[0] : action.projects;
    const key = action.project_id ?? "__no_project__";
    const group = groups.get(key) ?? {
      projectId: action.project_id ?? null,
      title: relation?.title ?? "Sem projecto",
      actions: [] as ActionRow[],
      blockers: [] as BlockerRow[],
    };
    group.actions.push(action);
    groups.set(key, group);
  }

  for (const blocker of blockers ?? []) {
    const key = blocker.project_id ?? "__no_project__";
    const group = groups.get(key);
    if (group) group.blockers.push(blocker);
  }

  const projectGroups = Array.from(groups.values())
    .map((group) => {
      const open = group.actions.filter((action) => !isClosed(action.status)).length;
      const overdue = group.actions.filter(isOverdue).length;
      const dueSoon = group.actions.filter(isDueSoon).length;
      const next = group.actions.find((action) => action.is_next_action && !isClosed(action.status));
      return {
        ...group,
        open,
        overdue,
        dueSoon,
        next,
        attention: overdue + dueSoon + group.blockers.length,
      };
    })
    .filter((group) => group.actions.length || group.blockers.length)
    .sort((a, b) => b.attention - a.attention || a.title.localeCompare(b.title));

  const chartItems = projectGroups
    .filter((group) => group.projectId && group.attention > 0)
    .map((group) => ({
      label: group.title,
      value: group.attention,
      meta: [group.overdue ? `${group.overdue} em atraso` : "", group.blockers.length ? `${group.blockers.length} bloqueio(s)` : "", group.dueSoon ? `${group.dueSoon} a vencer` : ""]
        .filter(Boolean)
        .join(" · "),
    }));

  return (
    <>
      <PageHeader eyebrow="Execução" title="Executar" />
      <FlashMessage
        error={params.error ?? error?.message}
        created={params.created}
        message={params.validation}
      />

      <Card className="mb-6 p-5">
        <div className="mb-5">
          <h2 className="font-semibold text-[var(--cc-foreground)]">1. Visão rápida dos projectos</h2>
          <p className="mt-1 text-sm text-[var(--cc-secondary)]">Onde existe maior pressão operacional neste momento.</p>
        </div>
        <SimpleBarChart items={chartItems} emptyLabel="Nenhum projecto exige atenção imediata." />
      </Card>

      <Card className="mb-6 p-5">
        <h2 className="font-semibold text-[var(--cc-foreground)]">2. O que precisa de atenção agora?</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[var(--cc-radius-md)] bg-[var(--cc-surface-muted)] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-secondary)]">Próxima acção</p>
            <p className="mt-2 text-sm font-semibold text-[var(--cc-foreground)]">{nextAction?.title ?? "Ainda não definida"}</p>
          </div>
          <Link href="/actions?view=attention" className="rounded-[var(--cc-radius-md)] bg-[var(--cc-surface-muted)] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-secondary)]">Em atraso</p>
            <p className="mt-2 text-2xl font-semibold">{overdueTotal}</p>
          </Link>
          <Link href="/actions?view=attention" className="rounded-[var(--cc-radius-md)] bg-[var(--cc-surface-muted)] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-secondary)]">Bloqueadas</p>
            <p className="mt-2 text-2xl font-semibold">{blockedTotal}</p>
          </Link>
          <Link href="/actions?view=attention" className="rounded-[var(--cc-radius-md)] bg-[var(--cc-surface-muted)] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-secondary)]">A vencer</p>
            <p className="mt-2 text-2xl font-semibold">{dueSoonTotal}</p>
          </Link>
        </div>
      </Card>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Link className={view === "all" ? primaryButtonClass : secondaryButtonClass} href="/actions">Todas</Link>
          <Link className={view === "today" ? primaryButtonClass : secondaryButtonClass} href="/actions?view=today">Hoje</Link>
          <Link className={view === "attention" ? primaryButtonClass : secondaryButtonClass} href="/actions?view=attention">Atenção</Link>
          <Link className={view === "completed" ? primaryButtonClass : secondaryButtonClass} href="/actions?view=completed">Concluídas</Link>
        </div>
        <ManualEntry defaultOpen={Boolean(preparedDraft)}>
          <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Nova acção</h2>
          <form action={createAction} className="mt-5 space-y-4">
            <Select label="Projecto" name="project_id" defaultValue={effectiveProjectId}>
              <option value="">Sem projecto</option>
              {(projects ?? []).map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
            </Select>
            <Field label="Título" name="title" required placeholder="Ex.: Confirmar requisito com o responsável." defaultValue={preparedDraft?.title} />
            <TextArea label="Descrição" name="description" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Prioridade" name="priority" defaultValue={preparedDraft?.priority ?? "medium"}>
                {PRIORITIES.map((value) => <option key={value} value={value}>{displayLabel(value)}</option>)}
              </Select>
              <Field label="Prazo" name="due_at" type="datetime-local" />
            </div>
            <TextArea label="Critério de conclusão" name="completion_criteria" defaultValue={preparedDraft?.completion_criteria} />
            <input type="hidden" name="status" value="pending" />
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" name="is_next_action" className="size-4 rounded border-slate-300" />
              Definir como próxima acção
            </label>
            <button className={primaryButtonClass} type="submit">Criar e validar</button>
          </form>
        </ManualEntry>
      </div>

      <Card>
        <div className="border-b border-[var(--cc-border)] p-5">
          <h2 className="font-semibold text-[var(--cc-foreground)]">3. Projectos</h2>
        </div>
        <div className="p-5">
          {!projectGroups.length ? (
            <EmptyState>Não existem acções para esta vista.</EmptyState>
          ) : (
            <div className="space-y-3">
              {projectGroups.map((group) => (
                <details key={group.projectId ?? "sem-projecto"} open={Boolean(effectiveProjectId === group.projectId)} className="rounded-[var(--cc-radius-lg)] border border-[var(--cc-border)]">
                  <summary className="cursor-pointer list-none p-4">
                    <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_auto] md:items-center">
                      <div>
                        <h3 className="font-semibold text-[var(--cc-foreground)]">{group.title}</h3>
                        <p className="mt-1 text-xs text-[var(--cc-secondary)]">
                          {group.open} abertas · {group.overdue} em atraso · {group.blockers.length} bloqueio(s)
                        </p>
                      </div>
                      <p className="text-sm text-[var(--cc-foreground)]">
                        <span className="font-medium">Próxima:</span> {group.next?.title ?? "por definir"}
                      </p>
                      <span className="text-sm font-semibold text-[var(--cc-accent)]">Ver acções</span>
                    </div>
                  </summary>

                  <div className="space-y-3 border-t border-[var(--cc-border)] p-4">
                    {group.projectId && (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--cc-radius-md)] bg-[var(--cc-surface-muted)] p-3">
                        <p className="text-xs text-[var(--cc-secondary)]">A validação considera Objectivo Central, prazos, duplicações, bloqueios e próxima acção.</p>
                        <form action={validateProjectExecution}>
                          <input type="hidden" name="project_id" value={group.projectId} />
                          <button className={secondaryButtonClass} type="submit">Validar execução</button>
                        </form>
                      </div>
                    )}

                    {group.actions.map((action) => {
                      const overdue = isOverdue(action);
                      const actionBlockers = group.blockers.filter((blocker) => blocker.action_id === action.id);
                      return (
                        <article key={action.id} className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface-strong)] p-4">
                          <div className="flex flex-col justify-between gap-3 md:flex-row">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="font-semibold">{action.title}</h4>
                                <span className="rounded-full bg-[var(--cc-surface-muted)] px-2 py-1 text-xs font-semibold">
                                  {overdue ? "Em atraso" : action.status === "in_progress" ? "Em curso" : action.status === "blocked" ? "Bloqueada" : action.status === "completed" ? "Concluída" : "Pendente"}
                                </span>
                                {action.is_next_action && <span className="rounded-full bg-[color-mix(in_srgb,var(--cc-gold)_18%,white)] px-2 py-1 text-xs font-semibold">Próxima acção</span>}
                              </div>
                              <p className="mt-2 text-sm text-[var(--cc-secondary)]">
                                {action.due_at ? `Prazo ${formatDateTime(action.due_at)}` : "Sem prazo"}
                              </p>
                              {actionBlockers.map((blocker) => (
                                <p key={blocker.id} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-[var(--cc-danger)]">
                                  <TriangleAlert size={14} /> Bloqueio: {blocker.title}
                                </p>
                              ))}
                            </div>
                            {!action.is_next_action && !isClosed(action.status) && (
                              <form action={setNextAction}>
                                <input type="hidden" name="id" value={action.id} />
                                <button className={secondaryButtonClass} type="submit">Definir como próxima</button>
                              </form>
                            )}
                          </div>
                          <div className="mt-4 border-t border-[var(--cc-border)] pt-4">
                            <StatusProgressForm entity="actions" id={action.id} status={action.status} />
                          </div>
                        </article>
                      );
                    })}

                    {group.blockers.filter((blocker) => !blocker.action_id).map((blocker) => (
                      <div key={blocker.id} className="rounded-[var(--cc-radius-md)] border border-[color-mix(in_srgb,var(--cc-danger)_25%,var(--cc-border))] p-3">
                        <p className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--cc-danger)]"><TriangleAlert size={14} /> {blocker.title}</p>
                        {blocker.impact && <p className="mt-1 text-xs text-[var(--cc-secondary)]">{blocker.impact}</p>}
                      </div>
                    ))}

                    {group.projectId && (
                      <Link className="inline-flex text-sm font-semibold text-[var(--cc-accent)]" href={`/projects/${group.projectId}`}>
                        Ver detalhe do projecto →
                      </Link>
                    )}
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>
      </Card>
    </>
  );
}
