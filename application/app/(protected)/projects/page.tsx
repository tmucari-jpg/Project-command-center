import { createProject } from "@/app/(protected)/mutations";
import { DeleteForm } from "@/components/delete-form";
import { Field, Select, TextArea } from "@/components/form-fields";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { StatusProgressForm } from "@/components/status-progress-form";
import { Card, EmptyState, primaryButtonClass } from "@/components/ui";
import { PRIORITIES, STATUS_OPTIONS } from "@/lib/constants";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { projectHealth } from "@/lib/project-metrics";
import { StatusBadge } from "@/components/status-badge";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();

  const [{ data: projects, error }, { data: objectives }, { data: blockers }] = await Promise.all([
    supabase
      .from("projects")
      .select("*, objectives(title)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("objectives")
      .select("id,title")
      .eq("user_id", user.id)
      .order("title"),
    supabase
      .from("blockers")
      .select("project_id,status")
      .eq("user_id", user.id)
      .in("status", ["open", "investigating", "waiting"]),
  ]);

  const blockerCounts = new Map<string, number>();
  (blockers ?? []).forEach((blocker) => {
    if (!blocker.project_id) return;
    blockerCounts.set(blocker.project_id, (blockerCounts.get(blocker.project_id) ?? 0) + 1);
  });

  return (
    <>
      <PageHeader
        eyebrow="Execução"
        title="Projectos"
        description="Ligue cada projecto a um objectivo, mantenha o próximo passo visível e acompanhe a saúde."
      />
      <FlashMessage error={params.error ?? error?.message} created={params.created} />

      <div className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-slate-950">Novo projecto</h2>
          <form action={createProject} className="mt-5 space-y-4">
            <Field label="Título" name="title" required />
            <Select label="Objectivo relacionado" name="objective_id" defaultValue="">
              <option value="">Sem objectivo associado</option>
              {(objectives ?? []).map((objective) => (
                <option key={objective.id} value={objective.id}>{objective.title}</option>
              ))}
            </Select>
            <TextArea label="Descrição" name="description" />
            <TextArea label="Resultado esperado" name="expected_result" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Prioridade" name="priority" defaultValue="medium">
                {PRIORITIES.map((value) => <option key={value} value={value}>{value}</option>)}
              </Select>
              <Select label="Estado" name="status" defaultValue="idea">
                {STATUS_OPTIONS.projects.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
              </Select>
              <Field label="Data inicial" name="start_date" type="date" />
              <Field label="Prazo" name="due_date" type="date" />
              <Field label="Progresso (%)" name="progress" type="number" min={0} max={100} step="0.01" defaultValue={0} />
              <Field label="Orçamento" name="budget" type="number" step="any" />
              <Field label="Moeda" name="currency" placeholder="MZN / USD" />
            </div>
            <TextArea label="Próximo passo" name="next_action" />
            <TextArea label="Notas" name="notes" />
            <button className={primaryButtonClass} type="submit">Criar projecto</button>
          </form>
        </Card>

        <Card>
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-950">Projectos registados</h2>
          </div>
          <div className="p-5">
            {!projects?.length ? (
              <EmptyState>Não existem projectos registados.</EmptyState>
            ) : (
              <div className="space-y-4">
                {projects.map((project) => {
                  const health = projectHealth({
                    progress: Number(project.progress ?? 0),
                    dueDate: project.due_date,
                    openBlockers: blockerCounts.get(project.id) ?? 0,
                  });
                  return (
                    <article key={project.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-col justify-between gap-3 md:flex-row">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-slate-950">{project.title}</h3>
                            <StatusBadge status={health} />
                          </div>
                          <p className="mt-1 text-sm text-slate-500">
                            Prazo {formatDate(project.due_date)} · Prioridade {project.priority}
                          </p>
                          {project.objectives?.title && (
                            <p className="mt-1 text-xs text-blue-700">Objectivo: {project.objectives.title}</p>
                          )}
                          {project.next_action && (
                            <p className="mt-3 text-sm leading-6 text-slate-700">
                              <span className="font-medium">Próximo passo:</span> {project.next_action}
                            </p>
                          )}
                        </div>
                        <DeleteForm table="projects" id={project.id} />
                      </div>
                      <div className="mt-4 border-t border-slate-100 pt-4">
                        <StatusProgressForm
                          entity="projects"
                          id={project.id}
                          status={project.status}
                          progress={project.progress}
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
