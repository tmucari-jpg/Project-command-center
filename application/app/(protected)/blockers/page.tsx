import { TriangleAlert } from "lucide-react";
import { createBlocker } from "@/app/(protected)/mutations";
import { DeleteForm } from "@/components/delete-form";
import { Field, Select, TextArea } from "@/components/form-fields";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { ManualEntry } from "@/components/manual-entry";
import { StatusProgressForm } from "@/components/status-progress-form";
import { Card, EmptyState, primaryButtonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

export default async function BlockersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string; project_id?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();
  const selectedProjectId = params.project_id ?? "";

  let blockersQuery = supabase
    .from("blockers")
    .select("*, projects(title), deliverables(title), actions(title)")
    .eq("user_id", user.id);

  if (selectedProjectId) {
    blockersQuery = blockersQuery.eq("project_id", selectedProjectId);
  }

  const [{ data: blockers, error }, { data: projects }, { data: deliverables }, { data: actions }] =
    await Promise.all([
      blockersQuery.order("identified_at", { ascending: false }),
      supabase.from("projects").select("id,title").eq("user_id", user.id).order("title"),
      supabase.from("deliverables").select("id,title,project_id").eq("user_id", user.id).order("title"),
      supabase.from("actions").select("id,title,project_id").eq("user_id", user.id).order("title"),
    ]);

  const effectiveProjectId = (projects ?? []).some((project) => project.id === selectedProjectId)
    ? selectedProjectId
    : "";
  const effectiveProjectTitle = (projects ?? []).find((project) => project.id === effectiveProjectId)?.title;
  const visibleDeliverables = effectiveProjectId
    ? (deliverables ?? []).filter((item) => item.project_id === effectiveProjectId)
    : (deliverables ?? []);
  const visibleActions = effectiveProjectId
    ? (actions ?? []).filter((item) => item.project_id === effectiveProjectId)
    : (actions ?? []);

  const now = new Date();
  const blockerGroups = new Map<string, {
    projectId: string | null;
    title: string;
    blockers: NonNullable<typeof blockers>;
    open: number;
    overdue: number;
  }>();

  for (const blocker of blockers ?? []) {
    const relation = Array.isArray(blocker.projects) ? blocker.projects[0] : blocker.projects;
    const projectId = blocker.project_id ?? null;
    const key = projectId ?? "__no_project__";
    const group = blockerGroups.get(key) ?? {
      projectId,
      title: relation?.title ?? "Sem projecto",
      blockers: [],
      open: 0,
      overdue: 0,
    };

    group.blockers.push(blocker);
    if (!["resolved", "ignored"].includes(blocker.status)) group.open += 1;
    if (
      blocker.resolution_due_at &&
      new Date(blocker.resolution_due_at) < now &&
      !["resolved", "ignored"].includes(blocker.status)
    ) {
      group.overdue += 1;
    }
    blockerGroups.set(key, group);
  }

  const groupedBlockers = Array.from(blockerGroups.values())
    .map((group) => ({
      ...group,
      blockers: [...group.blockers].sort((a, b) => {
        const aOverdue = Boolean(a.resolution_due_at && new Date(a.resolution_due_at) < now && !["resolved", "ignored"].includes(a.status));
        const bOverdue = Boolean(b.resolution_due_at && new Date(b.resolution_due_at) < now && !["resolved", "ignored"].includes(b.status));
        if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
        const aDue = a.resolution_due_at ? new Date(a.resolution_due_at).getTime() : Number.POSITIVE_INFINITY;
        const bDue = b.resolution_due_at ? new Date(b.resolution_due_at).getTime() : Number.POSITIVE_INFINITY;
        return aDue - bDue;
      }),
    }))
    .sort((a, b) => {
      if (b.overdue !== a.overdue) return b.overdue - a.overdue;
      if (b.open !== a.open) return b.open - a.open;
      return a.title.localeCompare(b.title);
    });

  return (
    <>
      <PageHeader
        eyebrow="Risco"
        title={effectiveProjectId ? `Bloqueios · ${effectiveProjectTitle ?? "Projecto"}` : "Bloqueios"}
      />
      <FlashMessage error={params.error ?? error?.message} created={params.created} />

      <div className="space-y-6">
        <ManualEntry>
          <h2 className="text-lg font-semibold text-slate-950">Novo bloqueio</h2>
          <form action={createBlocker} className="mt-5 space-y-4">
            <Field label="Título" name="title" required />
            <Select label="Acção" name="action_id" defaultValue="">
              <option value="">Sem acção</option>
              {visibleActions.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </Select>
            <Select label="Entregável, se não houver acção" name="deliverable_id" defaultValue="">
              <option value="">Sem entregável</option>
              {visibleDeliverables.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </Select>
            <details className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-4">
              <summary className="cursor-pointer text-sm font-semibold text-[var(--cc-foreground)]">Mais detalhes</summary>
              <div className="mt-4">
                <Select label="Projecto, se não houver acção ou entregável" name="project_id" defaultValue={effectiveProjectId}>
                  <option value="">Sem projecto</option>
                  {(projects ?? []).map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
                </Select>
              </div>
            </details>
            <TextArea label="Descrição" name="description" />
            <TextArea label="Impacto" name="impact" />
            <Field label="Responsável" name="responsible" />
            <Field label="Prazo de resolução" name="resolution_due_at" type="datetime-local" />
            <input type="hidden" name="status" value="open" />
            <TextArea label="Solução" name="solution" />
            <button className={primaryButtonClass} type="submit">Criar bloqueio</button>
          </form>
        </ManualEntry>

        <Card>
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-950">Bloqueios por projecto</h2>
          </div>
          <div className="p-5">
            {!blockers?.length ? (
              <EmptyState>Não existem bloqueios registados.</EmptyState>
            ) : (
              <div className="space-y-4">
                {groupedBlockers.map((group) => (
                  <details
                    key={group.projectId ?? "sem-projecto"}
                    open={Boolean(effectiveProjectId && group.projectId === effectiveProjectId) || group.overdue > 0}
                    className={`rounded-2xl border ${group.overdue > 0 ? "border-red-200 bg-red-50/40" : "border-slate-200"}`}
                  >
                    <summary className="cursor-pointer list-none p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-slate-950">{group.title}</h3>
                          <p className="mt-1 text-xs text-slate-500">
                            {group.open} aberto(s) · {group.blockers.length} total
                          </p>
                        </div>
                        {group.overdue > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800">
                            <TriangleAlert size={13} /> {group.overdue} resolução(ões) em atraso
                          </span>
                        )}
                      </div>
                    </summary>

                    <div className="space-y-3 border-t border-slate-200 p-4">
                      {group.blockers.map((item) => {
                        const overdue = Boolean(
                          item.resolution_due_at &&
                          new Date(item.resolution_due_at) < now &&
                          !["resolved", "ignored"].includes(item.status),
                        );

                        return (
                          <article
                            key={item.id}
                            className={`rounded-xl border p-4 ${overdue ? "border-red-300 bg-red-50" : "border-slate-200 bg-white"}`}
                          >
                            <div className="flex flex-col justify-between gap-3 md:flex-row">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="font-semibold text-slate-950">{item.title}</h4>
                                  {overdue && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-800">
                                      <TriangleAlert size={13} /> tratamento necessário
                                    </span>
                                  )}
                                </div>
                                <p className={`mt-1 text-sm ${overdue ? "font-semibold text-red-700" : "text-slate-500"}`}>
                                  {item.actions?.title ?? item.deliverables?.title ?? "Sem relação operacional"} · Resolver até {formatDateTime(item.resolution_due_at)}
                                </p>
                                {item.impact && <p className="mt-3 text-sm text-slate-700">{item.impact}</p>}
                              </div>
                              <DeleteForm table="blockers" id={item.id} />
                            </div>
                            <div className="mt-4 border-t border-slate-100 pt-4">
                              <StatusProgressForm entity="blockers" id={item.id} status={item.status} />
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
