import { TriangleAlert } from "lucide-react";
import { createAction, setNextAction } from "@/app/(protected)/mutations";
import { DeleteForm } from "@/components/delete-form";
import { Field, Select, TextArea } from "@/components/form-fields";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { ManualEntry } from "@/components/manual-entry";
import { StatusProgressForm } from "@/components/status-progress-form";
import { Card, EmptyState, primaryButtonClass } from "@/components/ui";
import { PRIORITIES } from "@/lib/constants";
import { requireUser } from "@/lib/auth";
import { displayLabel } from "@/lib/display-label";
import { formatDateTime } from "@/lib/format";
import { prepareActionDraft } from "@/lib/action-autonomy";

export default async function ActionsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string; project_id?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();

  const selectedProjectId = params.project_id ?? "";
  let actionsQuery = supabase
    .from("actions")
    .select("*, projects(title), deliverables(title)")
    .eq("user_id", user.id);

  if (selectedProjectId) {
    actionsQuery = actionsQuery.eq("project_id", selectedProjectId);
  }

  const [{ data: actions, error }, { data: projects }, { data: deliverables }] = await Promise.all([
    actionsQuery
      .order("is_next_action", { ascending: false })
      .order("due_at", { ascending: true, nullsFirst: false }),
    supabase
      .from("projects")
      .select("id,title,priority,next_action")
      .eq("user_id", user.id)
      .order("title"),
    supabase
      .from("deliverables")
      .select("id,title,project_id,status,priority,due_date,completion_criteria")
      .eq("user_id", user.id)
      .order("title"),
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
    (actions ?? []).map((action) => ({ title: action.title, status: action.status })),
  );

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  const weeklyActions = (actions ?? []).filter((action) => {
    if (!action.due_at) return false;
    const due = new Date(action.due_at);
    return due >= startOfWeek && due < endOfWeek;
  });
  const overdueCount = (actions ?? []).filter(
    (action) =>
      action.due_at &&
      new Date(action.due_at) < now &&
      !["completed", "cancelled"].includes(action.status),
  ).length;
  const weeklyOpen = weeklyActions.filter(
    (action) => !["completed", "cancelled"].includes(action.status),
  ).length;
  const weeklyCompleted = weeklyActions.filter((action) => action.status === "completed").length;

  const actionGroups = new Map<string, {
    projectId: string | null;
    title: string;
    actions: NonNullable<typeof actions>;
    overdue: number;
    dueThisWeek: number;
  }>();

  for (const action of actions ?? []) {
    const relation = Array.isArray(action.projects) ? action.projects[0] : action.projects;
    const projectId = action.project_id ?? null;
    const key = projectId ?? "__no_project__";
    const group = actionGroups.get(key) ?? {
      projectId,
      title: relation?.title ?? "Sem projecto",
      actions: [],
      overdue: 0,
      dueThisWeek: 0,
    };

    group.actions.push(action);
    if (
      action.due_at &&
      new Date(action.due_at) < now &&
      !["completed", "cancelled"].includes(action.status)
    ) {
      group.overdue += 1;
    }
    if (
      action.due_at &&
      new Date(action.due_at) >= startOfWeek &&
      new Date(action.due_at) < endOfWeek &&
      !["completed", "cancelled"].includes(action.status)
    ) {
      group.dueThisWeek += 1;
    }
    actionGroups.set(key, group);
  }

  const groupedActions = Array.from(actionGroups.values())
    .map((group) => ({
      ...group,
      actions: [...group.actions].sort((a, b) => {
        const aOverdue = Boolean(a.due_at && new Date(a.due_at) < now && !["completed", "cancelled"].includes(a.status));
        const bOverdue = Boolean(b.due_at && new Date(b.due_at) < now && !["completed", "cancelled"].includes(b.status));
        if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
        if (a.is_next_action !== b.is_next_action) return a.is_next_action ? -1 : 1;
        const aDue = a.due_at ? new Date(a.due_at).getTime() : Number.POSITIVE_INFINITY;
        const bDue = b.due_at ? new Date(b.due_at).getTime() : Number.POSITIVE_INFINITY;
        return aDue - bDue;
      }),
    }))
    .sort((a, b) => {
      if (b.overdue !== a.overdue) return b.overdue - a.overdue;
      return a.title.localeCompare(b.title);
    });

  return (
    <>
      <PageHeader
        eyebrow="Execução"
        title={effectiveProjectId ? `Acções · ${(projects ?? []).find((project) => project.id === effectiveProjectId)?.title ?? "Projecto"}` : "Acções"}
      />
      <FlashMessage error={params.error ?? error?.message} created={params.created} />

      <Card className="mb-6 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--cc-foreground)]">Resumo da semana</p>
            <p className="mt-1 text-xs text-[var(--cc-secondary)]">
              {weeklyOpen} por concluir · {weeklyCompleted} concluídas · {overdueCount} em atraso · organizado por projecto
            </p>
          </div>
          <p className="text-xs font-medium text-[var(--cc-secondary)]">
            {effectiveProjectId ? "Projecto actual" : "Todos os projectos"}
          </p>
        </div>
      </Card>

      <div className="space-y-6">
        <ManualEntry defaultOpen={Boolean(preparedDraft)}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-950">Nova acção</h2>
            {preparedDraft && (
              <span className="rounded-full bg-[var(--cc-surface-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--cc-accent)]">
                preparada automaticamente
              </span>
            )}
          </div>
          <form action={createAction} className="mt-5 space-y-4">
            <Field
              label="Título"
              name="title"
              required
              placeholder="Ex.: Enviar proposta ao cliente"
              defaultValue={preparedDraft?.title}
            />
            <Select label="Entregável" name="deliverable_id" defaultValue={preparedDraft?.deliverable_id ?? ""}>
              <option value="">Sem entregável</option>
              {visibleDeliverables.map((item) => (
                <option key={item.id} value={item.id}>{item.title}</option>
              ))}
            </Select>
            <details className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-4">
              <summary className="cursor-pointer text-sm font-semibold text-[var(--cc-foreground)]">Mais detalhes</summary>
              <div className="mt-4">
                <Select label="Projecto, se não houver entregável" name="project_id" defaultValue={effectiveProjectId}>
                  <option value="">Sem projecto</option>
                  {(projects ?? []).map((project) => (
                    <option key={project.id} value={project.id}>{project.title}</option>
                  ))}
                </Select>
              </div>
            </details>
            <TextArea label="Descrição" name="description" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Prioridade" name="priority" defaultValue={preparedDraft?.priority ?? "medium"}>
                {PRIORITIES.map((value) => <option key={value} value={value}>{displayLabel(value)}</option>)}
              </Select>
              <input type="hidden" name="status" value="pending" />
              <Field label="Prazo" name="due_at" type="datetime-local" />
              <Field label="Tempo estimado (min)" name="estimated_minutes" type="number" min={1} max={100000} />
            </div>
            <TextArea
              label="Critério de conclusão"
              name="completion_criteria"
              defaultValue={preparedDraft?.completion_criteria}
            />
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" name="is_next_action" className="size-4 rounded border-slate-300" />
              Definir como próxima acção
            </label>
            <button className={primaryButtonClass} type="submit">Criar acção</button>
          </form>
        </ManualEntry>

        <Card>
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-950">Acções por projecto</h2>
          </div>
          <div className="p-5">
            {!actions?.length ? (
              <EmptyState>Não existem acções registadas.</EmptyState>
            ) : (
              <div className="space-y-4">
                {groupedActions.map((group) => (
                  <details
                    key={group.projectId ?? "sem-projecto"}
                    open={Boolean(effectiveProjectId && group.projectId === effectiveProjectId)}
                    className={`rounded-2xl border ${group.overdue > 0 ? "border-red-200 bg-red-50/40" : "border-slate-200"}`}
                  >
                    <summary className="cursor-pointer list-none p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-slate-950">{group.title}</h3>
                          <p className="mt-1 text-xs text-slate-500">
                            {group.actions.length} acção(ões) · {group.dueThisWeek} esta semana
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {group.overdue > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800">
                              <TriangleAlert size={13} /> {group.overdue} em atraso
                            </span>
                          )}
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            abrir projecto
                          </span>
                        </div>
                      </div>
                    </summary>

                    <div className="space-y-3 border-t border-slate-200 p-4">
                      {group.actions.map((action) => {
                        const overdue =
                          Boolean(
                            action.due_at &&
                            new Date(action.due_at) < now &&
                            !["completed", "cancelled"].includes(action.status),
                          );

                        return (
                          <article
                            key={action.id}
                            className={`rounded-xl border p-4 ${
                              overdue
                                ? "border-red-300 bg-red-50"
                                : action.is_next_action
                                  ? "border-[color-mix(in_srgb,var(--cc-gold)_55%,var(--cc-border))] bg-[color-mix(in_srgb,var(--cc-gold)_8%,white)]"
                                  : "border-slate-200 bg-white"
                            }`}
                          >
                            <div className="flex flex-col justify-between gap-3 md:flex-row">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="font-semibold text-slate-950">{action.title}</h4>
                                  {overdue && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-800">
                                      <TriangleAlert size={13} /> tratamento necessário
                                    </span>
                                  )}
                                  {action.is_next_action && (
                                    <span className="rounded-full bg-[color-mix(in_srgb,var(--cc-accent)_10%,white)] px-2 py-1 text-xs font-semibold text-[var(--cc-accent)]">
                                      próxima acção
                                    </span>
                                  )}
                                </div>
                                <p className={`mt-1 text-sm ${overdue ? "font-semibold text-red-700" : "text-slate-500"}`}>
                                  Prazo {formatDateTime(action.due_at)}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  Estimado {action.estimated_minutes ?? "—"} min · Real {action.actual_minutes ?? 0} min
                                </p>
                                {action.completion_criteria && (
                                  <p className="mt-3 text-sm text-slate-700">
                                    <span className="font-medium">Concluído quando:</span> {action.completion_criteria}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-start gap-2">
                                {!action.is_next_action && !["completed", "cancelled"].includes(action.status) && (
                                  <form action={setNextAction}>
                                    <input type="hidden" name="id" value={action.id} />
                                    <button className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--cc-accent)] hover:bg-[var(--cc-surface-muted)]" type="submit">
                                      Tornar próxima
                                    </button>
                                  </form>
                                )}
                                <DeleteForm table="actions" id={action.id} />
                              </div>
                            </div>
                            <div className="mt-4 border-t border-slate-100 pt-4">
                              <StatusProgressForm
                                entity="actions"
                                id={action.id}
                                status={action.status}
                              />
                            </div>
                          </article>
                        );
                      })}
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
