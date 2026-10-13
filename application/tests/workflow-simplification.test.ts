import { describe, expect, it } from "vitest";
import { automationCodeFromName } from "@/lib/automation";
import {
  actionSchema,
  blockerSchema,
  decisionSchema,
  deliverableSchema,
  evidenceSchema,
  orchestratorRouteSchema,
} from "@/lib/validation";

const projectId = "11111111-1111-4111-8111-111111111111";

describe("workflow defaults and simplified forms", () => {
  it("accepts an action with the automatic pending status", () => {
    const parsed = actionSchema.parse({
      project_id: projectId,
      deliverable_id: "",
      title: "Enviar proposta",
      description: "",
      priority: "medium",
      status: "pending",
      due_at: "",
      estimated_minutes: "",
      completion_criteria: "",
      is_next_action: "",
    });

    expect(parsed.status).toBe("pending");
    expect(parsed.deliverable_id).toBeUndefined();
  });

  it("accepts a deliverable with automatic pending status and zero progress", () => {
    const parsed = deliverableSchema.parse({
      project_id: projectId,
      title: "Proposta comercial",
      description: "",
      priority: "medium",
      status: "pending",
      due_date: "",
      progress: "0",
      completion_criteria: "",
    });

    expect(parsed.status).toBe("pending");
    expect(parsed.progress).toBe(0);
  });

  it("accepts a blocker with the automatic open status", () => {
    const parsed = blockerSchema.parse({
      project_id: projectId,
      deliverable_id: "",
      action_id: "",
      title: "Aguardar aprovação",
      description: "",
      impact: "",
      responsible: "",
      resolution_due_at: "",
      status: "open",
      solution: "",
    });

    expect(parsed.status).toBe("open");
  });

  it("keeps optional decision details optional", () => {
    const parsed = decisionSchema.parse({
      project_id: projectId,
      title: "Avançar com piloto",
      context: "",
      options_considered: "",
      decision: "Executar piloto de 30 dias",
      rationale: "",
      outcome: "",
    });

    expect(parsed.decision).toBe("Executar piloto de 30 dias");
    expect(parsed.context).toBeUndefined();
    expect(parsed.rationale).toBeUndefined();
  });

  it("keeps specialist evidence fields optional", () => {
    const parsed = evidenceSchema.parse({
      project_id: projectId,
      deliverable_id: "",
      action_id: "",
      evidence_type: "comment",
      title: "Cliente confirmou",
      description: "Confirmação recebida.",
      url: "",
      storage_path: "",
      numeric_value: "",
    });

    expect(parsed.storage_path).toBeUndefined();
    expect(parsed.numeric_value).toBeUndefined();
  });

  it("accepts the safe orchestration defaults", () => {
    const parsed = orchestratorRouteSchema.parse({
      project_id: projectId,
      factory_case_id: "",
      task_type: "command",
      objective: "Preparar próximos passos",
      risk_level: "medium",
      factuality: "standard",
      cost_sensitivity: "medium",
    });

    expect(parsed.risk_level).toBe("medium");
    expect(parsed.factuality).toBe("standard");
    expect(parsed.cost_sensitivity).toBe("medium");
  });
});

describe("automationCodeFromName", () => {
  it("creates a stable internal code from a user-facing name", () => {
    expect(automationCodeFromName("Publicar Briefing Diário")).toBe("publicar_briefing_diario");
    expect(automationCodeFromName("  Follow-up: Cliente VIP  ")).toBe("follow_up_cliente_vip");
  });

  it("keeps generated codes within the schema limit", () => {
    expect(automationCodeFromName("A".repeat(200))).toHaveLength(120);
  });
});
