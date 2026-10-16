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
  it("prepares an objective only from project context", () => {
    expect(prepareObjectiveDraft(project)).toMatchObject({
      title: "Gestor de Vendas",
      expected_result: "Pipeline comercial claro e utilizável.",
      priority: "high",
    });
  });

  it("prepares a grounded deliverable", () => {
    expect(prepareDeliverableDraft(project)).toMatchObject({
      project_id: project.id,
      title: "Resultado de Gestor de Vendas",
      completion_criteria: "Pipeline comercial claro e utilizável.",
    });
  });

  it("prepares a progress metric without inventing business numbers", () => {
    expect(prepareMetricDraft(project)).toMatchObject({
      name: "Progresso de Gestor de Vendas",
      unit: "%",
      baseline_value: 0,
      target_value: 100,
      current_value: 25,
    });
  });

  it("prepares decision context but not the decision itself", () => {
    const draft = prepareDecisionContext(project);
    expect(draft?.title).toBe("Decisão · Gestor de Vendas");
    expect(draft?.context).toContain("Organizar o processo comercial.");
    expect(draft).not.toHaveProperty("decision");
  });
});
