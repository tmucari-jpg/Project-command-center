import Link from "next/link";
import { Field, Select, TextArea } from "@/components/form-fields";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { ManualEntry } from "@/components/manual-entry";
import { Card, EmptyState, primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import { PRIORITIES } from "@/lib/constants";
import { requireUser } from "@/lib/auth";
import { displayLabel } from "@/lib/display-label";
import { formatDate } from "@/lib/format";
import { prepareObjectiveDraft } from "@/lib/project-autonomy";
import { createObjective } from "@/app/(protected)/mutations";

export default async function ObjectivesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string; project_id?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();
  const selectedProjectId = params.project_id ?? "";

  const [
    { data: objectives, error },
    { data: projects },
  ] = await Promise.all([
    supabase
      .from("objectives")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("projects")
      .select("id,title,description,expected_result,priority,progress,start_date,due_date,notes,objective_id,status")
      .eq("user_id", user.id)
      .order("title"),
  ]);

  const selectedProject = (projects ?? []).find((project) => project.id === selectedProjectId);
  const preparedDraft = prepareObjectiveDraft(selectedProject);
  const projectByObjective = new Map<string, string[]>();

  for (const project of projects ?? []) {
    if (!project.objective_id) continue;
    const names = projectByObjective.get(project.objective_id) ?? [];
    names.push(project.title);
    projectByObjective.set(project.objective_id, names);
  }

  return (
    <>
      <PageHeader eyebrow="Resultados" title="Objectivos" />
      <FlashMessage error={params.error ?? error?.message} created={params.created} />

      <Card className="mb-6 p-5">
        <h2 className="font-semibold text-[var(--cc-foreground)]">Objectivo Central primeiro</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
          Cada projecto aprovado deve ter um Objectivo Central claro. Prazos, métricas, execução e resultados serão avaliados em função dele.
        </p>
      </Card>

      <div className="mb-6 flex justify-end">
        <ManualEntry defaultOpen={Boolean(preparedDraft)}>
          <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Definir Objectivo Central</h2>
          <form action={createObjective} className="mt-5 space-y-4">
            <Select label="Projecto" name="project_id" required defaultValue={selectedProjectId}>
              <option value="" disabled>Seleccionar projecto</option>
              {(projects ?? []).map((project) => (
                <option key={project.id} value={project.id}>{project.title}</option>
              ))}
            </Select>
            <Field
              label="Objectivo Central"
              name="title"
              required
              defaultValue={preparedDraft?.title}
              placeholder="Ex.: Reduzir o tempo médio de resposta ao cliente."
            />
            <TextArea
              label="Resultado esperado"
              name="expected_result"
              defaultValue={preparedDraft?.expected_result}
              placeholder="Ex.: Passar de 24 horas para menos de 8 horas até ao final do período."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Prioridade" name="priority" defaultValue={preparedDraft?.priority ?? "medium"}>
                {PRIORITIES.map((value) => <option key={value} value={value}>{displayLabel(value)}</option>)}
              </Select>
              <Field label="Prazo" name="due_date" type="date" defaultValue={preparedDraft?.due_date} />
            </div>
            <input type="hidden" name="status" value="active" />
            <input type="hidden" name="progress" value="0" />
            <details className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-4">
              <summary className="cursor-pointer text-sm font-semibold text-[var(--cc-foreground)]">Definir medição inicial</summary>
              <div className="mt-4 space-y-4">
                <Field label="Métrica principal" name="metric_name" placeholder="Ex.: Tempo médio de resposta" />
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Valor inicial" name="baseline_value" type="number" step="any" />
                  <Field label="Valor alvo" name="target_value" type="number" step="any" />
                  <Field label="Valor actual" name="current_value" type="number" step="any" />
                </div>
                <TextArea label="Contexto / observações" name="notes" defaultValue={preparedDraft?.notes} />
                <input type="hidden" name="description" value={preparedDraft?.description ?? ""} />
                <input type="hidden" name="start_date" value={preparedDraft?.start_date ?? ""} />
              </div>
            </details>
            <button className={primaryButtonClass} type="submit">Guardar Objectivo Central</button>
          </form>
        </ManualEntry>
      </div>

      <Card>
        <div className="border-b border-[var(--cc-border)] p-5">
          <h2 className="font-semibold text-[var(--cc-foreground)]">Objectivos Centrais</h2>
        </div>
        <div className="p-5">
          {!objectives?.length ? (
            <EmptyState>Defina o Objectivo Central do primeiro projecto aprovado.</EmptyState>
          ) : (
            <div className="space-y-3">
              {objectives.map((objective) => {
                const linkedProjects = projectByObjective.get(objective.id) ?? [];
                return (
                  <details key={objective.id} className="rounded-[var(--cc-radius-lg)] border border-[var(--cc-border)]">
                    <summary className="cursor-pointer list-none p-4">
                      <div className="grid gap-2 md:grid-cols-[1.4fr_0.8fr_auto] md:items-center">
                        <div>
                          <h3 className="font-semibold text-[var(--cc-foreground)]">{objective.title}</h3>
                          <p className="mt-1 text-xs text-[var(--cc-secondary)]">
                            {linkedProjects.length ? linkedProjects.join(" · ") : "Ainda não associado a um projecto"}
                          </p>
                        </div>
                        <p className="text-sm text-[var(--cc-secondary)]">
                          {objective.due_date ? `Prazo ${formatDate(objective.due_date)}` : "Sem prazo"}
                        </p>
                        <span className="text-sm font-semibold text-[var(--cc-accent)]">Ver detalhes</span>
                      </div>
                    </summary>
                    <div className="space-y-4 border-t border-[var(--cc-border)] p-4">
                      {objective.expected_result && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-secondary)]">Resultado esperado</p>
                          <p className="mt-1 text-sm leading-6">{objective.expected_result}</p>
                        </div>
                      )}
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div><p className="text-xs text-[var(--cc-secondary)]">Métrica principal</p><p className="mt-1 text-sm font-medium">{objective.metric_name || "Por definir"}</p></div>
                        <div><p className="text-xs text-[var(--cc-secondary)]">Meta</p><p className="mt-1 text-sm font-medium">{objective.target_value ?? "Por definir"}</p></div>
                        <div><p className="text-xs text-[var(--cc-secondary)]">Estado</p><p className="mt-1 text-sm font-medium">{displayLabel(objective.status)}</p></div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {linkedProjects.map((projectTitle) => {
                          const project = (projects ?? []).find((item) => item.title === projectTitle && item.objective_id === objective.id);
                          return project ? (
                            <Link key={project.id} className={secondaryButtonClass} href={`/projects/${project.id}`}>Abrir {project.title}</Link>
                          ) : null;
                        })}
                        <Link className={secondaryButtonClass} href={`/metrics?objective_id=${objective.id}`}>Ver métricas</Link>
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </div>
      </Card>
    </>
  );
}
