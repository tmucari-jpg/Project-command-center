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
            <h2 className="text-lg font-semibold text-slate-950">Bloqueios registados</h2>
          </div>
          <div className="p-5">
            {!blockers?.length ? (
              <EmptyState>Não existem bloqueios registados.</EmptyState>
            ) : (
              <div className="space-y-4">
                {blockers.map((item) => (
                  <article key={item.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-col justify-between gap-3 md:flex-row">
                      <div>
                        <h3 className="font-semibold text-slate-950">{item.title}</h3>
                        <p className="mt-1 text-sm text-slate-500">
                          {item.projects?.title ?? "Sem projecto"} · {item.actions?.title ?? item.deliverables?.title ?? "Sem relação operacional"} · Resolver até {formatDateTime(item.resolution_due_at)}
                        </p>
                        {item.impact && <p className="mt-3 text-sm text-slate-700">{item.impact}</p>}
                      </div>
                      <DeleteForm table="blockers" id={item.id} />
                    </div>
                    <div className="mt-4 border-t border-slate-100 pt-4">
                      <StatusProgressForm entity="blockers" id={item.id} status={item.status} />
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
