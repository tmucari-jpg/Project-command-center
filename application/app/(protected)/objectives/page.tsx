import { createObjective } from "@/app/(protected)/mutations";
import { Field, Select, TextArea } from "@/components/form-fields";
import { FlashMessage } from "@/components/flash-message";
import { ManualEntry } from "@/components/manual-entry";
import { PageHeader } from "@/components/page-header";
import { StatusProgressForm } from "@/components/status-progress-form";
import { Card, EmptyState, primaryButtonClass } from "@/components/ui";
import { PRIORITIES } from "@/lib/constants";
import { requireUser } from "@/lib/auth";
import { displayLabel } from "@/lib/display-label";
import { formatDate } from "@/lib/format";
import { prepareObjectiveDraft } from "@/lib/project-autonomy";

export default async function ObjectivesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string; project_id?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();
  const selectedProjectId = params.project_id ?? "";

  const [{ data: objectives, error }, { data: projects }] = await Promise.all([
    supabase.from("objectives").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase
      .from("projects")
      .select("id,title,objective_id,description,expected_result,priority,progress,start_date,due_date,notes,status")
      .eq("user_id", user.id)
      .not("status", "in", '("completed","cancelled")')
      .order("title"),
  ]);

  const selectedProject = (projects ?? []).find((project) => project.id === selectedProjectId);
  const preparedDraft = prepareObjectiveDraft(selectedProject);
  const projectByObjective = new Map(
    (projects ?? []).filter((project) => project.objective_id).map((project) => [project.objective_id, project]),
  );

  return (
    <>
      <PageHeader eyebrow="Direcção" title="Objectivos" />
      <FlashMessage error={params.error ?? error?.message} created={params.created} />

      <Card className="mb-6 p-5">
        <h2 className="font-semibold text-[var(--cc-foreground)]">Objectivo Central do Projecto</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
          Cada projecto aprovado deve ter um objectivo central claro. Prazos, métricas, acções, bloqueios e entregáveis são avaliados em função desse objectivo.
        </p>
      </Card>

      <div className="space-y-6">
        <ManualEntry defaultOpen={Boolean(preparedDraft)}>
          <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Definir Objectivo Central</h2>
          <form action={createObjective} className="mt-5 space-y-4">
            {preparedDraft && (
              <p className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface-muted)] px-3 py-2 text-xs font-medium text-[var(--cc-secondary)]">
                Proposta preparada a partir do resultado esperado do projecto. Reveja antes de validar.
              </p>
            )}
            <Select label="Projecto" name="project_id" defaultValue={selectedProjectId} required>
              <option value="" disabled>Seleccionar projecto</option>
              {(projects ?? []).map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
            </Select>
            <Field
              label="Objectivo Central"
              name="title"
              required
              defaultValue={preparedDraft?.title}
              placeholder="Ex.: Reduzir o tempo médio de resposta ao cliente."
            />
            <TextArea
              label="Resultado que comprova o objectivo"
              name="expected_result"
              defaultValue={preparedDraft?.expected_result}
              placeholder="Ex.: Passar de 24 horas para menos de 8 horas."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Prioridade" name="priority" defaultValue={preparedDraft?.priority ?? "medium"}>
                {PRIORITIES.map((value) => <option key={value} value={value}>{displayLabel(value)}</option>)}
              </Select>
              <Field label="Prazo, se aplicável" name="due_date" type="date" defaultValue={preparedDraft?.due_date} />
            </div>
            <input type="hidden" name="status" value="active" />
            <input type="hidden" name="progress" value="0" />
            <details className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-4">
              <summary className="cursor-pointer text-sm font-semibold text-[var(--cc-foreground)]">Detalhes adicionais</summary>
              <div className="mt-4 space-y-4">
                <TextArea label="Descrição" name="description" defaultValue={preparedDraft?.description} />
                <Field label="Data inicial" name="start_date" type="date" defaultValue={preparedDraft?.start_date} />
                <TextArea label="Observações" name="notes" defaultValue={preparedDraft?.notes} />
              </div>
            </details>
            <button className={primaryButtonClass} type="submit">Validar Objectivo Central</button>
          </form>
        </ManualEntry>

        <Card>
          <div className="border-b border-[var(--cc-border)] p-5">
            <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Objectivos Centrais</h2>
          </div>
          <div className="p-5">
            {!objectives?.length ? (
              <EmptyState>Defina o Objectivo Central do primeiro projecto aprovado.</EmptyState>
            ) : (
              <div className="space-y-3">
                {objectives.map((objective) => {
                  const project = projectByObjective.get(objective.id);
                  return (
                    <details key={objective.id} className="rounded-[var(--cc-radius-lg)] border border-[var(--cc-border)]">
                      <summary className="cursor-pointer list-none p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="font-semibold text-[var(--cc-foreground)]">{objective.title}</h3>
                            <p className="mt-1 text-xs text-[var(--cc-secondary)]">
                              {project?.title ?? "Ainda não associado a um projecto"}
                              {objective.due_date ? ` · prazo ${formatDate(objective.due_date)}` : ""}
                            </p>
                          </div>
                          <span className="text-xs font-semibold text-[var(--cc-accent)]">Ver detalhes</span>
                        </div>
                      </summary>
                      <div className="border-t border-[var(--cc-border)] p-4">
                        {objective.expected_result && <p className="text-sm leading-6 text-[var(--cc-foreground)]">{objective.expected_result}</p>}
                        <div className="mt-4">
                          <StatusProgressForm entity="objectives" id={objective.id} status={objective.status} progress={objective.progress} />
                        </div>
                      </div>
                    </details>
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
