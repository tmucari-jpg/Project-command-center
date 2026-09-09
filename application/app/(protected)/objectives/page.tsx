import { createObjective } from "@/app/(protected)/mutations";
import { DeleteForm } from "@/components/delete-form";
import { Field, Select, TextArea } from "@/components/form-fields";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { StatusProgressForm } from "@/components/status-progress-form";
import { Card, EmptyState, primaryButtonClass } from "@/components/ui";
import { PRIORITIES, STATUS_OPTIONS } from "@/lib/constants";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";

export default async function ObjectivesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();
  const { data: objectives, error } = await supabase
    .from("objectives")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <>
      <PageHeader
        eyebrow="Resultados"
        title="Objectivos"
        description="Defina o resultado esperado, prazo, métrica principal e progresso."
      />
      <FlashMessage error={params.error ?? error?.message} created={params.created} />

      <div className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-slate-950">Novo objectivo</h2>
          <form action={createObjective} className="mt-5 space-y-4">
            <Field label="Título" name="title" required />
            <TextArea label="Descrição" name="description" />
            <TextArea label="Resultado esperado" name="expected_result" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Prioridade" name="priority" defaultValue="medium">
                {PRIORITIES.map((value) => <option key={value} value={value}>{value}</option>)}
              </Select>
              <Select label="Estado" name="status" defaultValue="draft">
                {STATUS_OPTIONS.objectives.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
              </Select>
              <Field label="Data inicial" name="start_date" type="date" />
              <Field label="Prazo" name="due_date" type="date" />
              <Field label="Progresso (%)" name="progress" type="number" min={0} max={100} step="0.01" defaultValue={0} />
              <Field label="Métrica principal" name="metric_name" />
              <Field label="Valor inicial" name="baseline_value" type="number" step="any" />
              <Field label="Valor alvo" name="target_value" type="number" step="any" />
              <Field label="Valor actual" name="current_value" type="number" step="any" />
            </div>
            <TextArea label="Observações" name="notes" />
            <button className={primaryButtonClass} type="submit">Criar objectivo</button>
          </form>
        </Card>

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
                          Prazo {formatDate(objective.due_date)} · Prioridade {objective.priority}
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
