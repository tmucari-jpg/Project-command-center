import Link from "next/link";
import { createMetric, updateMetricCurrentValue } from "@/app/(protected)/mutations";
import { DeleteForm } from "@/components/delete-form";
import { Field, Select, TextArea } from "@/components/form-fields";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { ManualEntry } from "@/components/manual-entry";
import { SimpleBarChart } from "@/components/simple-bar-chart";
import { Card, EmptyState, primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import { METRIC_TYPES } from "@/lib/constants";
import { requireUser } from "@/lib/auth";
import { displayLabel } from "@/lib/display-label";
import { formatDate } from "@/lib/format";
import { prepareMetricDraft } from "@/lib/project-autonomy";

function achievement(metric: {
  baseline_value?: number | null;
  target_value?: number | null;
  current_value?: number | null;
}) {
  if (
    metric.baseline_value == null ||
    metric.target_value == null ||
    metric.current_value == null
  ) return null;

  const baseline = Number(metric.baseline_value);
  const target = Number(metric.target_value);
  const current = Number(metric.current_value);
  if (![baseline, target, current].every(Number.isFinite) || target === baseline) return null;
  const value = ((current - baseline) / (target - baseline)) * 100;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export default async function MetricsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string; project_id?: string; objective_id?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();
  const selectedProjectId = params.project_id ?? "";

  const [
    { data: metrics, error },
    { data: projects },
    { data: actions },
    { data: blockers },
  ] = await Promise.all([
    supabase
      .from("metrics")
      .select("*, objectives(title,expected_result), projects(title)")
      .eq("user_id", user.id)
      .order("measurement_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("projects")
      .select("id,title,description,expected_result,priority,progress,start_date,due_date,notes,objective_id,objectives(id,title,expected_result,metric_name,baseline_value,target_value,current_value)")
      .eq("user_id", user.id)
      .order("title"),
    supabase
      .from("actions")
      .select("project_id,status,due_at")
      .eq("user_id", user.id),
    supabase
      .from("blockers")
      .select("project_id,status")
      .eq("user_id", user.id)
      .in("status", ["open", "investigating", "waiting"]),
  ]);

  const effectiveProject = (projects ?? []).find((project) => project.id === selectedProjectId);
  const objectiveRelation = effectiveProject
    ? (Array.isArray(effectiveProject.objectives) ? effectiveProject.objectives[0] : effectiveProject.objectives)
    : null;
  const preparedDraft = prepareMetricDraft(effectiveProject, objectiveRelation);
  const now = new Date();

  const metricByProject = new Map<string, NonNullable<typeof metrics>>();
  for (const metric of metrics ?? []) {
    if (!metric.project_id) continue;
    const list = metricByProject.get(metric.project_id) ?? [];
    list.push(metric);
    metricByProject.set(metric.project_id, list);
  }

  const actionStats = new Map<string, { total: number; completed: number; overdue: number }>();
  for (const action of actions ?? []) {
    if (!action.project_id) continue;
    const stats = actionStats.get(action.project_id) ?? { total: 0, completed: 0, overdue: 0 };
    if (action.status !== "cancelled") stats.total += 1;
    if (action.status === "completed") stats.completed += 1;
    if (
      action.due_at &&
      new Date(action.due_at) < now &&
      !["completed", "cancelled"].includes(action.status)
    ) stats.overdue += 1;
    actionStats.set(action.project_id, stats);
  }

  const blockerCount = new Map<string, number>();
  for (const blocker of blockers ?? []) {
    if (!blocker.project_id) continue;
    blockerCount.set(blocker.project_id, (blockerCount.get(blocker.project_id) ?? 0) + 1);
  }

  const projectSummaries = (projects ?? []).map((project) => {
    const objective = Array.isArray(project.objectives) ? project.objectives[0] : project.objectives;
    const projectMetrics = metricByProject.get(project.id) ?? [];
    const principal =
      projectMetrics.find((metric) => metric.metric_type === "outcome_ratio") ??
      projectMetrics[0];
    const resultProgress = principal ? achievement(principal) : null;
    const stats = actionStats.get(project.id) ?? { total: 0, completed: 0, overdue: 0 };
    const execution = stats.total ? Math.round((stats.completed / stats.total) * 100) : null;
    return {
      project,
      objective,
      metrics: projectMetrics,
      principal,
      resultProgress,
      execution,
      overdue: stats.overdue,
      blockers: blockerCount.get(project.id) ?? 0,
    };
  });

  const chartItems = projectSummaries
    .filter((item) => item.resultProgress !== null)
    .map((item) => ({
      label: item.project.title,
      value: item.resultProgress as number,
      meta: item.principal?.name ?? "Métrica principal",
    }));

  return (
    <>
      <PageHeader eyebrow="Resultados" title="Métricas" />
      <FlashMessage error={params.error ?? error?.message} created={params.created} />

      <Card className="mb-6 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-[var(--cc-foreground)]">Resultados face ao Objectivo Central</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--cc-secondary)]">
              O gráfico só inclui projectos com valor inicial, actual e meta suficientes para uma comparação real.
            </p>
          </div>
          <ManualEntry defaultOpen={Boolean(preparedDraft)}>
            <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Definir métrica do projecto</h2>
            <form action={createMetric} className="mt-5 space-y-4">
              <Select label="Projecto" name="project_id" required defaultValue={selectedProjectId}>
                <option value="" disabled>Seleccionar projecto</option>
                {(projects ?? []).map((project) => (
                  <option key={project.id} value={project.id}>{project.title}</option>
                ))}
              </Select>
              <input type="hidden" name="objective_id" value={preparedDraft?.objective_id ?? objectiveRelation?.id ?? ""} />
              <Field label="Métrica" name="name" required defaultValue={preparedDraft?.name} placeholder="Ex.: Tempo médio de resposta" />
              <TextArea label="O que esta métrica comprova?" name="description" defaultValue={preparedDraft?.description} />
              <Select label="Tipo" name="metric_type" defaultValue={preparedDraft?.metric_type ?? "outcome_ratio"}>
                {METRIC_TYPES.map((value) => <option key={value} value={value}>{displayLabel(value)}</option>)}
              </Select>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Unidade" name="unit" defaultValue={preparedDraft?.unit} placeholder="Ex.: horas, clientes, MZN, %" />
                <Field label="Data de medição" name="measurement_date" type="date" />
                <Field label="Valor inicial" name="baseline_value" type="number" step="any" defaultValue={preparedDraft?.baseline_value} />
                <Field label="Valor alvo" name="target_value" type="number" step="any" defaultValue={preparedDraft?.target_value} />
                <Field label="Valor actual" name="current_value" type="number" step="any" defaultValue={preparedDraft?.current_value} />
              </div>
              <button className={primaryButtonClass} type="submit">Guardar métrica validada</button>
            </form>
          </ManualEntry>
        </div>
        <div className="mt-6">
          <SimpleBarChart items={chartItems} valueSuffix="%" emptyLabel="Ainda não existem métricas com dados suficientes para comparação." />
        </div>
      </Card>

      <Card>
        <div className="border-b border-[var(--cc-border)] p-5">
          <h2 className="font-semibold text-[var(--cc-foreground)]">Métricas por projecto</h2>
        </div>
        <div className="p-5">
          {!projectSummaries.length ? (
            <EmptyState>Não existem projectos para acompanhar.</EmptyState>
          ) : (
            <div className="space-y-3">
              {projectSummaries.map((item) => (
                <details key={item.project.id} open={item.project.id === selectedProjectId} className="rounded-[var(--cc-radius-lg)] border border-[var(--cc-border)]">
                  <summary className="cursor-pointer list-none p-4">
                    <div className="grid gap-3 md:grid-cols-[1.3fr_0.8fr_0.8fr_auto] md:items-center">
                      <div>
                        <h3 className="font-semibold">{item.project.title}</h3>
                        <p className="mt-1 text-xs text-[var(--cc-secondary)]">Objectivo Central: {item.objective?.title ?? "por definir"}</p>
                      </div>
                      <p className="text-sm"><span className="font-medium">Resultado:</span> {item.resultProgress === null ? "sem dados" : `${item.resultProgress}%`}</p>
                      <p className="text-sm"><span className="font-medium">Execução:</span> {item.execution === null ? "sem acções" : `${item.execution}%`}</p>
                      <span className="text-sm font-semibold text-[var(--cc-accent)]">Ver detalhes</span>
                    </div>
                  </summary>
                  <div className="space-y-4 border-t border-[var(--cc-border)] p-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-[var(--cc-radius-md)] bg-[var(--cc-surface-muted)] p-3"><p className="text-xs text-[var(--cc-secondary)]">Acções em atraso</p><p className="mt-1 text-xl font-semibold">{item.overdue}</p></div>
                      <div className="rounded-[var(--cc-radius-md)] bg-[var(--cc-surface-muted)] p-3"><p className="text-xs text-[var(--cc-secondary)]">Bloqueios activos</p><p className="mt-1 text-xl font-semibold">{item.blockers}</p></div>
                      <div className="rounded-[var(--cc-radius-md)] bg-[var(--cc-surface-muted)] p-3"><p className="text-xs text-[var(--cc-secondary)]">Métricas definidas</p><p className="mt-1 text-xl font-semibold">{item.metrics.length}</p></div>
                    </div>

                    {!item.metrics.length ? (
                      <div>
                        <p className="text-sm text-[var(--cc-secondary)]">Ainda não existem métricas validadas para este Objectivo Central.</p>
                        <Link className={secondaryButtonClass} href={`/metrics?project_id=${item.project.id}`}>Definir métricas</Link>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {item.metrics.map((metric) => (
                          <article key={metric.id} className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-4">
                            <div className="flex flex-col justify-between gap-3 md:flex-row">
                              <div>
                                <h4 className="font-semibold">{metric.name}</h4>
                                <p className="mt-1 text-xs text-[var(--cc-secondary)]">
                                  {metric.measurement_date ? `Medido em ${formatDate(metric.measurement_date)}` : "Data de medição por definir"}
                                </p>
                                <div className="mt-3 flex flex-wrap gap-4 text-sm">
                                  <span>Inicial: {metric.baseline_value ?? "—"} {metric.unit ?? ""}</span>
                                  <span>Actual: <strong>{metric.current_value ?? "—"} {metric.unit ?? ""}</strong></span>
                                  <span>Meta: {metric.target_value ?? "—"} {metric.unit ?? ""}</span>
                                </div>
                              </div>
                              <DeleteForm table="metrics" id={metric.id} />
                            </div>
                            <details className="mt-3">
                              <summary className="cursor-pointer text-xs font-semibold text-[var(--cc-accent)]">Actualizar medição</summary>
                              <form action={updateMetricCurrentValue} className="mt-3 flex flex-wrap items-end gap-2">
                                <input type="hidden" name="id" value={metric.id} />
                                <label className="text-xs font-medium text-[var(--cc-secondary)]">
                                  Novo valor
                                  <input name="current_value" type="number" step="any" required defaultValue={metric.current_value ?? ""} className="mt-1 block w-36 rounded-lg border border-[var(--cc-border)] px-2.5 py-1.5 text-sm" />
                                </label>
                                <button className={secondaryButtonClass} type="submit">Guardar</button>
                              </form>
                            </details>
                          </article>
                        ))}
                      </div>
                    )}

                    <Link className="inline-flex text-sm font-semibold text-[var(--cc-accent)]" href={`/projects/${item.project.id}`}>Abrir detalhe do projecto →</Link>
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>
      </Card>
    </>
  );
}
