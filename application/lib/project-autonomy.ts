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

  const expected = project.expected_result.trim();
  const normalized = expected.toLocaleLowerCase();
  let title = expected.length <= 180 ? expected : `${expected.slice(0, 177).trimEnd()}...`;
  let completionCriteria = expected;

  if (/website|site|portal|página web/.test(normalized)) {
    title = "Website funcional e publicado";
    completionCriteria = "Website construído segundo as premissas aprovadas, publicado, com URL acessível registada no PCC e evidência de funcionamento/entrega.";
  } else if (/dashboard|painel/.test(normalized)) {
    title = "Dashboard funcional";
    completionCriteria = "Dashboard operacional com os dados e indicadores definidos, acesso funcional e evidência de validação.";
  } else if (/api|endpoint/.test(normalized)) {
    title = "API funcional";
    completionCriteria = "Endpoint funcional, testado, com documentação mínima de utilização e evidência de resposta válida.";
  } else if (/apresenta|pitch|powerpoint|ppt/.test(normalized)) {
    title = "Apresentação final pronta para utilização";
    completionCriteria = "Apresentação completa, coerente com o projecto, pronta para reunião, pitch ou candidatura e validada no PCC.";
  } else if (/excel|modelo financeiro|orçamento|orcamento|matriz|cronograma/.test(normalized)) {
    title = "Modelo operacional em Excel";
    completionCriteria = "Ficheiro XLSX funcional com dados, fórmulas/estrutura necessária, outputs verificáveis e validação no PCC.";
  } else if (/relatório|relatorio|plano|proposta|procedimento|manual/.test(normalized)) {
    title = "Documento final utilizável";
    completionCriteria = "Documento completo e específico ao projecto, pronto para uso/partilha, com conteúdo real e critérios de aceitação cumpridos.";
  }

  return {
    project_id: project.id,
    title,
    description: expected,
    priority: project.priority,
    due_date: project.due_date || undefined,
    completion_criteria: completionCriteria,
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
