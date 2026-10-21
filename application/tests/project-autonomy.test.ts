import { describe, expect, it } from "vitest";
import {
  prepareDecisionContext,
  prepareDeliverableDraft,
  prepareMetricDraft,
  prepareObjectiveDraft,
} from "@/lib/project-autonomy";

const project = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Gestor de Vendas",
  description: "Organizar o processo comercial.",
  expected_result: "Pipeline comercial claro e utilizável.",
  priority: "high" as const,
  progress: 25,
  due_date: "2026-12-31",
  notes: "Usar o contexto existente.",
};

describe("project autonomy", () => {
  it("uses the expected result as the central objective instead of the project name", () => {
    expect(prepareObjectiveDraft(project)).toMatchObject({
      title: "Pipeline comercial claro e utilizável.",
      expected_result: "Pipeline comercial claro e utilizável.",
      priority: "high",
    });
  });

  it("prepares a grounded deliverable without a generic Resultado de project title", () => {
    expect(prepareDeliverableDraft(project)).toMatchObject({
      project_id: project.id,
      title: "Pipeline comercial claro e utilizável.",
      completion_criteria: "Pipeline comercial claro e utilizável.",
    });
  });

  it("requires a real outcome metric instead of inventing 0 to 100 progress", () => {
    const draft = prepareMetricDraft(project);
    expect(draft).toMatchObject({
      name: "Métrica principal do Objectivo Central",
      metric_type: "outcome_ratio",
    });
    expect(draft?.baseline_value).toBeUndefined();
    expect(draft?.target_value).toBeUndefined();
    expect(draft?.current_value).toBeUndefined();
    expect(draft?.unit).toBeUndefined();
  });

  it("reuses an explicitly defined objective metric when available", () => {
    const draft = prepareMetricDraft(project, {
      id: "22222222-2222-4222-8222-222222222222",
      title: "Reduzir tempo de resposta",
      metric_name: "Tempo médio de resposta",
      baseline_value: 24,
      target_value: 8,
      current_value: 16,
    });

    expect(draft).toMatchObject({
      objective_id: "22222222-2222-4222-8222-222222222222",
      name: "Tempo médio de resposta",
      baseline_value: 24,
      target_value: 8,
      current_value: 16,
    });
  });

  it("materializes a website as a real published website deliverable", () => {
    const draft = prepareDeliverableDraft({
      ...project,
      expected_result: "Lançar um website institucional funcional para clientes.",
    });

    expect(draft?.title).toBe("Website funcional e publicado");
    expect(draft?.completion_criteria).toContain("URL acessível");
  });

  it("prepares decision context but not the decision itself", () => {
    const draft = prepareDecisionContext(project);
    expect(draft?.title).toBe("Decisão · Gestor de Vendas");
    expect(draft?.context).toContain("Organizar o processo comercial.");
    expect(draft).not.toHaveProperty("decision");
  });
});
