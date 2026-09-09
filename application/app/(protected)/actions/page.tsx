import { createAction, setNextAction } from "@/app/(protected)/mutations";
import { DeleteForm } from "@/components/delete-form";
import { Field, Select, TextArea } from "@/components/form-fields";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { StatusProgressForm } from "@/components/status-progress-form";
import { Card, EmptyState, primaryButtonClass } from "@/components/ui";
import { PRIORITIES, STATUS_OPTIONS } from "@/lib/constants";
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

export default async function ActionsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();

  const [{ data: actions, error }, { data: projects }, { data: deliverables }] = await Promise.all([
    supabase
      .from("actions")
      .select("*, projects(title), deliverables(title)")
      .eq("user_id", user.id)
      .order("is_next_action", { ascending: false })
      .order("due_at", { ascending: true, nullsFirst: false }),
    supabase.from("projects").select("id,title").eq("user_id", user.id).order("title"),
    supabase.from("deliverables").select("id,title,project_id").eq("user_id", user.id).order("title"),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Execução"
        title="Acções"
        description="Registe trabalho concreto, com prazo, estimativa e critério de conclusão."
      />
      <FlashMessage error={params.error ?? error?.message} created={params.created} />

      <div className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-slate-950">Nova acção</h2>
          <form action={createAction} className="mt-5 space-y-4">
            <Field label="Título" name="title" required placeholder="Ex.: Enviar proposta ao cliente" />
            <Select label="Projecto" name="project_id" defaultValue="">
              <option value="">Sem projecto</option>
              {(projects ?? []).map((project) => (
                <option key={project.id} value={project.id}>{project.title}</option>
              ))}
            </Select>
            <Select label="Entregável" name="deliverable_id" defaultValue="">
              <option value="">Sem entregável</option>
              {(deliverables ?? []).map((item) => (
                <option key={item.id} value={item.id}>{item.title}</option>
              ))}
            </Select>
            <TextArea label="Descrição" name="description" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Prioridade" name="priority" defaultValue="medium">
                {PRIORITIES.map((value) => <option key={value} value={value}>{value}</option>)}
              </Select>
              <Select label="Estado" name="status" defaultValue="pending">
                {STATUS_OPTIONS.actions.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
              </Select>
              <Field label="Prazo" name="due_at" type="datetime-local" />
              <Field label="Tempo estimado (min)" name="estimated_minutes" type="number" min={1} max={100000} />
            </div>
            <TextArea label="Critério de conclusão" name="completion_criteria" />
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" name="is_next_action" className="size-4 rounded border-slate-300" />
              Definir como próxima acção
            </label>
            <button className={primaryButtonClass} type="submit">Criar acção</button>
          </form>
        </Card>

        <Card>
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-950">Acções registadas</h2>
          </div>
          <div className="p-5">
            {!actions?.length ? (
              <EmptyState>Não existem acções registadas.</EmptyState>
            ) : (
              <div className="space-y-4">
                {actions.map((action) => (
                  <article
                    key={action.id}
                    className={`rounded-2xl border p-4 ${
                      action.is_next_action ? "border-blue-300 bg-blue-50/40" : "border-slate-200"
                    }`}
                  >
                    <div className="flex flex-col justify-between gap-3 md:flex-row">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-slate-950">{action.title}</h3>
                          {action.is_next_action && (
                            <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">
                              próxima acção
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          {action.projects?.title ?? "Sem projecto"} · Prazo {formatDateTime(action.due_at)}
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
                            <button className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50" type="submit">
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
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
