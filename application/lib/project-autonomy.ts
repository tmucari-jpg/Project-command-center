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
  return {
    title: project.title,
    description: project.description?.trim() || undefined,
    expected_result: project.expected_result?.trim() || undefined,
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

export function prepareMetricDraft(project?: ProjectAutonomyContext) {
  if (!project || !project.expected_result?.trim()) return null;
  const current = Number(project.progress ?? 0);
  return {
    project_id: project.id,
    name: `Progresso de ${project.title}`,
    description: `Mede o avanço do projecto face ao resultado esperado: ${project.expected_result.trim()}`,
    metric_type: "progress" as const,
    unit: "%",
    baseline_value: 0,
    target_value: 100,
    current_value: Number.isFinite(current) ? current : 0,
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
