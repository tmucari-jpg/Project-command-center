import Link from "next/link";
import { createMetric, updateMetricCurrentValue } from "@/app/(protected)/mutations";
import { Field, Select, TextArea } from "@/components/form-fields";
import { FlashMessage } from "@/components/flash-message";
import { ManualEntry } from "@/components/manual-entry";
import { PageHeader } from "@/components/page-header";
import { Card, EmptyState, primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import { METRIC_TYPES } from "@/lib/constants";
import { requireUser } from "@/lib/auth";
import { displayLabel } from "@/lib/display-label";
import { formatDate } from "@/lib/format";
import { prepareMetricDraft } from "@/lib/project-autonomy";

function achievement(metric: {
  baseline_value: number | string | null;
  target_value: number | string | null;
  current_value: number | string | null;
}) {
  const baseline = Number(metric.baseline_value);
  const target = Number(metric.target_value);
  const current = Number(metric.current_value);
  if (![baseline, target, current].every(Number.isFinite) || target === baseline) return null;
  const ratio = target > baseline
    ? (current - baseline) / (target - baseline)
    : (baseline - current) / (baseline - target);
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}

export default async function MetricsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string; project_id?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();
  const selectedProjectId = params.project_id ?? "";

  const [{ data: metrics, error }, { data: objectives }, { data: projects }] = await Promise.all([
    supabase
      .from("metrics")
      .select("*, objectives(title), projects(title)")
      .eq("user_id", user.id)
      .order("measurement_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("objectives")
      .select("id,title,expected_result")
      .eq("user_id", user.id),
    supabase
      .from("projects")
      .select("id,title,objective_id,description,expected_result,priority,progress,start_date,due_date,notes,status")
      .eq("user_id", user.id)
      .not("status", "in", '("completed","cancelled")')
      .order("title"),
  ]);

  const effectiveProjectId = (projects ?? []).some((project) => project.id === selectedProjectId)
    ? selectedProjectId
    : "";
  const effectiveProject = (projects ?? []).find((project) => project.id === effectiveProjectId);
  const centralObjective = effectiveProject?.objective_id
    ? (objectives ?? []).find((item) => item.id === effectiveProject.objective_id)
    : undefined;
  const preparedDraft = effectiveProject
    ? prepareMetricDraft({
        ...effectiveProject,
        expected_result: centralObjective?.expected_result ?? centralObjective?.title ?? effectiveProject.expected_result,
      })
    : null;

  const metricsByProject = new Map<string, NonNullable<typeof metrics>>();
  for (const metric of metrics ?? []) {
    const key = metric.project_id ?? "__general__";
    const list = metricsByProject.get(key) ?? [];
    list.push(metric);
    metricsByProject.set(key, list);
  }

  const projectSummaries = (projects ?? []).map((project) => {
    const list = metricsByProject.get(project.id) ?? [];
    const primary = list[0];
    return {
      project,
      metrics: list,
      primary,
      achievement: primary ? achievement(primary) : null,
    };
  });

  return (
    <>
      <PageHeader eyebrow="Resultados" title="Métricas" />
      <FlashMessage error={params.error ?? error?.message} created={params.created} />

      <div className="space-y-6">
        <ManualEntry defaultOpen={Boolean(effectiveProjectId && !metricsByProject.get(effectiveProjectId)?.length)} label="Definir métricas">
          <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Definir métricas por projecto</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
            O PCC prepara uma proposta a partir do Objectivo Central. Reveja unidade, valor base, meta e fonte antes de validar.
          </p>
          <form action={createMetric} className="mt-5 space-y-4">
            <Select label="Projecto" name="project_id" required defaultValue={effectiveProjectId}>
              <option value="" disabled>Seleccionar projecto</option>
              {(projects ?? []).map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
            </Select>
            <Select label="Objectivo Central" name="objective_id" defaultValue={effectiveProject?.objective_id ?? ""}>
              <option value="">Sem objectivo associado</option>
              {(objectives ?? []).map((objective) => <option key={objective.id} value={objective.id}>{objective.title}</option>)}
            </Select>
            <Field
              label="Métrica principal"
              name="name"
              required
              defaultValue={preparedDraft?.name}
              placeholder="Ex.: Tempo médio de resposta"
            />
            <TextArea label="O que esta métrica comprova?" name="description" defaultValue={preparedDraft?.description} />
            <Select label="Tipo" name="metric_type" defaultValue={preparedDraft?.metric_type ?? "outcome_ratio"}>
              {METRIC_TYPES.map((value) => <option key={value} value={value}>{displayLabel(value)}</option>)}
            </Select>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Unidade" name="unit" defaultValue={preparedDraft?.unit} placeholder="Ex.: horas, MZN, utilizadores" />
              <Field label="Valor base" name="baseline_value" type="number" step="any" defaultValue={preparedDraft?.baseline_value} />
              <Field label="Meta" name="target_value" type="number" step="any" defaultValue={preparedDraft?.target_value} />
              <Field label="Valor actual" name="current_value" type="number" step="any" defaultValue={preparedDraft?.current_value} />
            </div>
            <Field label="Data da medição" name="measurement_date" type="date" />
            <button className={primaryButtonClass} type="submit">Validar métrica</button>
          </form>
        </ManualEntry>

        <Card className="p-5">
          <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Visão comparativa</h2>
          <p className="mt-1 text-sm text-[var(--cc-secondary)]">
            Grau de realização da métrica principal de cada projecto. Projectos sem base/meta suficientes aparecem como “sem dados”.
          </p>
          <div className="mt-5 space-y-3">
            {projectSummaries.map(({ project, primary, achievement: ratio }) => (
              <div key={project.id} className="grid gap-2 sm:grid-cols-[190px_1fr_90px] sm:items-center">
                <Link href={`/metrics?project_id=${project.id}`} className="truncate text-sm font-medium text-[var(--cc-foreground)] hover:underline">
                  {project.title}
                </Link>
                <div className="h-3 overflow-hidden rounded-full bg-[var(--cc-surface-muted)]">
                  {ratio != null && <div className="h-full rounded-full bg-[var(--cc-accent)]" style={{ width: `${Math.max(4, ratio)}%` }} />}
                </div>
                <span className="text-right text-xs font-semibold text-[var(--cc-secondary)]">
                  {primary ? (ratio == null ? "sem dados" : `${ratio}% da meta`) : "sem métrica"}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="border-b border-[var(--cc-border)] p-5">
            <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Métricas por projecto</h2>
          </div>
          <div className="p-5">
            {!projectSummaries.length ? (
              <EmptyState>Não existem projectos para acompanhar.</EmptyState>
            ) : (
              <div className="space-y-3">
                {projectSummaries
                  .filter(({ project }) => !effectiveProjectId || project.id === effectiveProjectId)
                  .map(({ project, metrics: projectMetrics, primary, achievement: ratio }) => (
                    <details key={project.id} open={project.id === effectiveProjectId} className="rounded-[var(--cc-radius-lg)] border border-[var(--cc-border)]">
                      <summary className="cursor-pointer list-none p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="font-semibold text-[var(--cc-foreground)]">{project.title}</h3>
                            <p className="mt-1 text-xs text-[var(--cc-secondary)]">
                              {projectMetrics.length} métrica(s)
                              {primary ? ` · principal: ${primary.name}` : " · sem métrica definida"}
                            </p>
                          </div>
                          <span className="text-xs font-semibold text-[var(--cc-accent)]">{ratio == null ? "Ver detalhes" : `${ratio}% da meta`}</span>
                        </div>
                      </summary>
                      <div className="space-y-3 border-t border-[var(--cc-border)] p-4">
                        {!projectMetrics.length ? (
                          <div>
                            <p className="text-sm text-[var(--cc-secondary)]">Defina primeiro as métricas deste projecto.</p>
                            <Link className={secondaryButtonClass + " mt-3"} href={`/metrics?project_id=${project.id}`}>Definir métricas</Link>
                          </div>
                        ) : projectMetrics.map((metric) => (
                          <article key={metric.id} className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--cc-secondary)]">{displayLabel(metric.metric_type)}</p>
                            <h4 className="mt-1 font-semibold text-[var(--cc-foreground)]">{metric.name}</h4>
                            {metric.description && <p className="mt-2 text-sm text-[var(--cc-secondary)]">{metric.description}</p>}
                            <div className="mt-3 flex flex-wrap gap-4 text-sm text-[var(--cc-foreground)]">
                              <span>Base: {metric.baseline_value ?? "—"} {metric.unit ?? ""}</span>
                              <span>Meta: {metric.target_value ?? "—"} {metric.unit ?? ""}</span>
                              <span className="font-semibold">Actual: {metric.current_value ?? "—"} {metric.unit ?? ""}</span>
                              <span>Última medição: {formatDate(metric.measurement_date)}</span>
                            </div>
                            <details className="mt-4">
                              <summary className="cursor-pointer text-xs font-semibold text-[var(--cc-accent)]">Actualizar valor</summary>
                              <form action={updateMetricCurrentValue} className="mt-3 flex flex-wrap items-end gap-2">
                                <input type="hidden" name="id" value={metric.id} />
                                <label className="text-xs font-medium text-[var(--cc-secondary)]">
                                  Novo valor
                                  <input
                                    name="current_value"
                                    type="number"
                                    step="any"
                                    required
                                    defaultValue={metric.current_value ?? ""}
                                    className="mt-1 block w-36 rounded-lg border border-[var(--cc-border)] px-2.5 py-2 text-sm"
                                  />
                                </label>
                                <button className={secondaryButtonClass} type="submit">Guardar e validar</button>
                              </form>
                            </details>
                          </article>
                        ))}
                      </div>
                    </details>
                  ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
