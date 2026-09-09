import { createDeliverable } from "@/app/(protected)/mutations";
import { DeleteForm } from "@/components/delete-form";
import { Field, Select, TextArea } from "@/components/form-fields";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { StatusProgressForm } from "@/components/status-progress-form";
import { Card, EmptyState, primaryButtonClass } from "@/components/ui";
import { PRIORITIES, STATUS_OPTIONS } from "@/lib/constants";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";

export default async function DeliverablesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();

  const [{ data: deliverables, error }, { data: projects }] = await Promise.all([
    supabase
      .from("deliverables")
      .select("*, projects(title)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("projects")
      .select("id,title")
      .eq("user_id", user.id)
      .order("title"),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Execução"
        title="Entregáveis"
        description="Defina o que precisa de ser entregue e o critério concreto de conclusão."
      />
      <FlashMessage error={params.error ?? error?.message} created={params.created} />

      <div className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-slate-950">Novo entregável</h2>
          <form action={createDeliverable} className="mt-5 space-y-4">
            <Select label="Projecto" name="project_id" required defaultValue="">
              <option value="" disabled>Seleccionar projecto</option>
              {(projects ?? []).map((project) => (
                <option key={project.id} value={project.id}>{project.title}</option>
              ))}
            </Select>
            <Field label="Título" name="title" required />
            <TextArea label="Descrição" name="description" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Prioridade" name="priority" defaultValue="medium">
                {PRIORITIES.map((value) => <option key={value} value={value}>{value}</option>)}
              </Select>
              <Select label="Estado" name="status" defaultValue="pending">
                {STATUS_OPTIONS.deliverables.map((value) => <option key={value} value={value}>{value}</option>)}
              </Select>
              <Field label="Prazo" name="due_date" type="date" />
              <Field label="Progresso (%)" name="progress" type="number" min={0} max={100} step="0.01" defaultValue={0} />
            </div>
            <TextArea label="Critério de conclusão" name="completion_criteria" />
            <button className={primaryButtonClass} type="submit">Criar entregável</button>
          </form>
        </Card>

        <Card>
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-950">Entregáveis registados</h2>
          </div>
          <div className="p-5">
            {!deliverables?.length ? (
              <EmptyState>Não existem entregáveis registados.</EmptyState>
            ) : (
              <div className="space-y-4">
                {deliverables.map((item) => (
                  <article key={item.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-col justify-between gap-3 md:flex-row">
                      <div>
                        <h3 className="font-semibold text-slate-950">{item.title}</h3>
                        <p className="mt-1 text-sm text-slate-500">
                          {item.projects?.title ?? "Projecto"} · Prazo {formatDate(item.due_date)}
                        </p>
                        {item.completion_criteria && (
                          <p className="mt-3 text-sm text-slate-700">
                            <span className="font-medium">Concluído quando:</span> {item.completion_criteria}
                          </p>
                        )}
                      </div>
                      <DeleteForm table="deliverables" id={item.id} />
                    </div>
                    <div className="mt-4 border-t border-slate-100 pt-4">
                      <StatusProgressForm
                        entity="deliverables"
                        id={item.id}
                        status={item.status}
                        progress={item.progress}
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
