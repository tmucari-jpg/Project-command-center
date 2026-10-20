import { describe, expect, it } from "vitest";
import {
  botIAOperationLabel,
  parseBotIAPlan,
  validateBotIAOperation,
} from "@/lib/bot-ia";

describe("BotIA safe project operations", () => {
  it("parses a valid operational plan", () => {
    const plan = parseBotIAPlan(JSON.stringify({
      summary: "Preparar a resolução do bloqueio.",
      diagnosis: "Existe contexto suficiente para criar uma acção e actualizar o tratamento.",
      operations: [
        {
          kind: "create_action",
          target_id: "",
          title: "Validar solução do bloqueio",
          description: "Executar a validação interna.",
          priority: "high",
          completion_criteria: "Solução validada.",
          impact: "",
          solution: "",
          value: "",
          status: "",
        },
      ],
    }));

    expect(plan).not.toBeNull();
    expect(plan?.operations).toHaveLength(1);
    expect(plan?.operations[0].kind).toBe("create_action");
  });

  it("accepts fenced JSON returned by a provider", () => {
    const fenced = [
      "~~~json",
      "{",
      '  "summary": "Sem alteração automática.",',
      '  "diagnosis": "Falta evidência factual.",',
      '  "operations": []',
      "}",
      "~~~",
    ].join("\n").replaceAll("~~~", String.fromCharCode(96, 96, 96));

    const plan = parseBotIAPlan(fenced);
    expect(plan?.operations).toEqual([]);
  });

  it("rejects unsupported operation kinds", () => {
    const plan = parseBotIAPlan(JSON.stringify({
      summary: "Tentativa inválida.",
      diagnosis: "Não permitida.",
      operations: [
        {
          kind: "delete_project",
          target_id: "",
          title: "",
          description: "",
          priority: "",
          completion_criteria: "",
          impact: "",
          solution: "",
          value: "",
          status: "",
        },
      ],
    }));

    expect(plan).toBeNull();
  });

  it("requires concrete data for blocker resolution", () => {
    expect(validateBotIAOperation({
      kind: "resolve_blocker",
      target_id: "9af24339-99d1-440f-b60d-689a94c79293",
      solution: "Aplicar a correcção e confirmar o resultado.",
    })).toBe(true);

    expect(validateBotIAOperation({
      kind: "resolve_blocker",
      target_id: "9af24339-99d1-440f-b60d-689a94c79293",
    })).toBe(false);
  });

  it("labels operational actions clearly", () => {
    expect(botIAOperationLabel({
      kind: "set_project_next_action",
      value: "Validar solução em ambiente controlado.",
    })).toContain("próxima acção");
  });
});
