import type { PRIORITIES } from "@/lib/constants";

type Priority = (typeof PRIORITIES)[number];

export type ProjectAutonomyContext = {
  id: string;
  title: string;
  description?: string | null;
  expected_result?: string | null;
  priority: Priority;
  progress?: number | string | null;
  start_date?: string | null;
  due_date?: string | null;
  notes?: string | null;
};

export function prepareObjectiveDraft(project?: ProjectAutonomyContext) {
  if (!project) return null;
  const expected = project.expected_result?.trim();
  const objectiveTitle = expected
    ? expected.length <= 180
      ? expected
      : `${expected.slice(0, 177).trimEnd()}...`
    : "Definir Objectivo Central";

  return {
    title: objectiveTitle,
    description: project.description?.trim() || undefined,
    expected_result: expected || undefined,
    priority: project.priority,
    start_date: project.start_date || undefined,
    due_date: project.due_date || undefined,
    notes: project.notes?.trim() || undefined,
  };
}

export function prepareDeliverableDraft(project?: ProjectAutonomyContext) {
  if (!project || !project.expected_result?.trim()) return null;
  return {
    project_id: project.id,
    title: `Resultado de ${project.title}`,
    description: project.expected_result.trim(),
    priority: project.priority,
    due_date: project.due_date || undefined,
    completion_criteria: project.expected_result.trim(),
  };
}

export type ObjectiveMetricContext = {
  id?: string | null;
  title?: string | null;
  expected_result?: string | null;
  metric_name?: string | null;
  baseline_value?: number | string | null;
  target_value?: number | string | null;
  current_value?: number | string | null;
};

export function prepareMetricDraft(
  project?: ProjectAutonomyContext,
  objective?: ObjectiveMetricContext | null,
) {
  if (!project) return null;

  const objectiveText =
    objective?.expected_result?.trim() ||
    objective?.title?.trim() ||
    project.expected_result?.trim();

  if (!objectiveText) return null;

  const metricName = objective?.metric_name?.trim();
  return {
    project_id: project.id,
    objective_id: objective?.id || undefined,
    name: metricName || "Métrica principal do Objectivo Central",
    description: metricName
      ? `Mede o Objectivo Central: ${objectiveText}`
      : `Defina a unidade e a meta mensurável que comprovam este Objectivo Central: ${objectiveText}`,
    metric_type: "outcome_ratio" as const,
    unit: undefined,
    baseline_value: objective?.baseline_value ?? undefined,
    target_value: objective?.target_value ?? undefined,
    current_value: objective?.current_value ?? undefined,
  };
}

export function prepareDecisionContext(project?: ProjectAutonomyContext) {
  if (!project) return null;
  const context = [project.description?.trim(), project.expected_result?.trim()]
    .filter(Boolean)
    .join("\n\n");
  return {
    project_id: project.id,
    title: `Decisão · ${project.title}`,
    context: context || undefined,
  };
}
