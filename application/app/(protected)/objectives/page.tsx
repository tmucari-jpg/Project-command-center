import { createObjective } from "@/app/(protected)/mutations";
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
    supabase
      .from("objectives")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("projects")
      .select("id,title,description,expected_result,priority,progress,start_date,due_date,notes")
      .eq("user_id", user.id)
      .order("title"),
  ]);
  const selectedProject = (projects ?? []).find((project) => project.id === selectedProjectId);
  const preparedDraft = prepareObjectiveDraft(selectedProject);

  return (
    <>
      <PageHeader
        eyebrow="Resultados"
        title="Objectivos"
      />
      <FlashMessage error={params.error ?? error?.message} created={params.created} />

      <div className="space-y-6">
        <ManualEntry defaultOpen={Boolean(preparedDraft)}>
          <h2 className="text-lg font-semibold text-slate-950">Novo objectivo</h2>
          <form action={createObjective} className="mt-5 space-y-4">
            {preparedDraft && (
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
                Preparado automaticamente a partir do projecto. Reveja antes de guardar.
              </p>
            )}
            <Field label="Título" name="title" required defaultValue={preparedDraft?.title} />
            <TextArea label="Resultado esperado" name="expected_result" defaultValue={preparedDraft?.expected_result} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Prioridade" name="priority" defaultValue={preparedDraft?.priority ?? "medium"}>
                {PRIORITIES.map((value) => <option key={value} value={value}>{displayLabel(value)}</option>)}
              </Select>
              <Field label="Prazo" name="due_date" type="date" defaultValue={preparedDraft?.due_date} />
            </div>
            <input type="hidden" name="status" value="draft" />
            <input type="hidden" name="progress" value="0" />
            <details className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-4">
              <summary className="cursor-pointer text-sm font-semibold text-[var(--cc-foreground)]">Mais detalhes</summary>
              <div className="mt-4 space-y-4">
                <TextArea label="Descrição" name="description" defaultValue={preparedDraft?.description} />
                <Field label="Data inicial" name="start_date" type="date" defaultValue={preparedDraft?.start_date} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Métrica principal" name="metric_name" />
                  <Field label="Valor inicial" name="baseline_value" type="number" step="any" />
                  <Field label="Valor alvo" name="target_value" type="number" step="any" />
                  <Field label="Valor actual" name="current_value" type="number" step="any" />
                </div>
                <TextArea label="Observações" name="notes" defaultValue={preparedDraft?.notes} />
              </div>
            </details>
            <button className={primaryButtonClass} type="submit">Criar objectivo</button>
          </form>
        </ManualEntry>

        <Card>
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-950">Objectivos registados</h2>
          </div>
          <div className="p-5">
            {!objectives?.length ? (
              <EmptyState>Crie o primeiro objectivo para iniciar a cadeia de execução.</EmptyState>
            ) : (
              <div className="space-y-4">
                {objectives.map((objective) => (
                  <article key={objective.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-col justify-between gap-3 md:flex-row">
                      <div>
                        <h3 className="font-semibold text-slate-950">{objective.title}</h3>
                        <p className="mt-1 text-sm text-slate-500">
                          Prazo {formatDate(objective.due_date)} · Prioridade {displayLabel(objective.priority)}
                        </p>
                        {objective.expected_result && (
                          <p className="mt-3 text-sm leading-6 text-slate-700">{objective.expected_result}</p>
                        )}
                      </div>
                      <DeleteForm table="objectives" id={objective.id} />
                    </div>
                    <div className="mt-4 border-t border-slate-100 pt-4">
                      <StatusProgressForm
                        entity="objectives"
                        id={objective.id}
                        status={objective.status}
                        progress={objective.progress}
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
