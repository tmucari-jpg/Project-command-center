import { createMetric, updateMetricCurrentValue } from "@/app/(protected)/mutations";
import { DeleteForm } from "@/components/delete-form";
import { Field, Select, TextArea } from "@/components/form-fields";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { Card, EmptyState, primaryButtonClass } from "@/components/ui";
import { METRIC_TYPES } from "@/lib/constants";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";

export default async function MetricsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();

  const [{ data: metrics, error }, { data: objectives }, { data: projects }] = await Promise.all([
    supabase
      .from("metrics")
      .select("*, objectives(title), projects(title)")
      .eq("user_id", user.id)
      .order("measurement_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase.from("objectives").select("id,title").eq("user_id", user.id).order("title"),
    supabase.from("projects").select("id,title").eq("user_id", user.id).order("title"),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Resultados"
        title="Métricas"
        description="Registe medidas reais de execução, resultado, prazo, foco, tempo e saúde do projecto."
      />
      <FlashMessage error={params.error ?? error?.message} created={params.created} />

      <div className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-slate-950">Nova métrica</h2>
          <form action={createMetric} className="mt-5 space-y-4">
            <Field label="Nome" name="name" required />
            <Select label="Tipo" name="metric_type" defaultValue="custom">
              {METRIC_TYPES.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
            </Select>
            <TextArea label="Descrição" name="description" />
            <Select label="Objectivo" name="objective_id" defaultValue="">
              <option value="">Sem objectivo</option>
              {(objectives ?? []).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </Select>
            <Select label="Projecto" name="project_id" defaultValue="">
              <option value="">Sem projecto</option>
              {(projects ?? []).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </Select>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Unidade" name="unit" />
              <Field label="Data de medição" name="measurement_date" type="date" />
              <Field label="Valor inicial" name="baseline_value" type="number" step="any" />
              <Field label="Valor alvo" name="target_value" type="number" step="any" />
              <Field label="Valor actual" name="current_value" type="number" step="any" />
            </div>
            <button className={primaryButtonClass} type="submit">Registar métrica</button>
          </form>
        </Card>

        <Card>
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-950">Métricas registadas</h2>
          </div>
          <div className="p-5">
            {!metrics?.length ? (
              <EmptyState>Não existem métricas registadas.</EmptyState>
            ) : (
              <div className="space-y-4">
                {metrics.map((metric) => (
                  <article key={metric.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-600">
                          {metric.metric_type.replaceAll("_", " ")}
                        </p>
                        <h3 className="mt-1 font-semibold text-slate-950">{metric.name}</h3>
                        <p className="mt-1 text-sm text-slate-500">
                          {formatDate(metric.measurement_date)} · {metric.projects?.title ?? metric.objectives?.title ?? "Geral"}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-700">
                          <span>Inicial: {metric.baseline_value ?? "—"}</span>
                          <span>Alvo: {metric.target_value ?? "—"}</span>
                          <span className="font-semibold">Actual: {metric.current_value ?? "—"} {metric.unit ?? ""}</span>
                        </div>
                        <form action={updateMetricCurrentValue} className="mt-4 flex flex-wrap items-end gap-2">
                          <input type="hidden" name="id" value={metric.id} />
                          <label className="text-xs font-medium text-slate-600">
                            Novo valor actual
                            <input
                              name="current_value"
                              type="number"
                              step="any"
                              required
                              defaultValue={metric.current_value ?? ""}
                              className="mt-1 block w-32 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
                            />
                          </label>
                          <button
                            type="submit"
                            className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200"
                          >
                            Actualizar
                          </button>
                        </form>
                      </div>
                      <DeleteForm table="metrics" id={metric.id} />
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
