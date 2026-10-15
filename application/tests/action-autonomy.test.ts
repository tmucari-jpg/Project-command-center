import { describe, expect, it } from "vitest";
import { prepareActionDraft } from "@/lib/action-autonomy";

describe("prepareActionDraft", () => {
  const project = {
    id: "project-1",
    title: "Gestor de Vendas",
    priority: "high" as const,
    next_action: "Validar proposta comercial",
  };

  it("prefers the explicit project next action", () => {
    expect(prepareActionDraft(project, [], [])).toEqual({
      source: "project_next_action",
      project_id: "project-1",
      title: "Validar proposta comercial",
      priority: "high",
    });
  });

  it("does not duplicate an existing open action", () => {
    expect(
      prepareActionDraft(project, [], [
        { title: " validar   proposta comercial ", status: "pending" },
      ]),
    ).toBeNull();
  });

  it("falls back to the nearest open deliverable", () => {
    const draft = prepareActionDraft(
      { ...project, next_action: null },
      [
        {
          id: "later",
          project_id: "project-1",
          title: "Relatório",
          status: "pending",
          priority: "medium" as const,
          due_date: "2026-12-10",
          completion_criteria: null,
        },
        {
          id: "next",
          project_id: "project-1",
          title: "Proposta",
          status: "active",
          priority: "critical" as const,
          due_date: "2026-11-01",
          completion_criteria: "Aprovada pelo cliente",
        },
      ],
      [],
    );

    expect(draft).toEqual({
      source: "deliverable",
      project_id: "project-1",
      deliverable_id: "next",
      title: "Avançar Proposta",
      priority: "critical",
      completion_criteria: "Aprovada pelo cliente",
    });
  });

  it("returns null instead of inventing when there is no usable context", () => {
    expect(
      prepareActionDraft(
        { ...project, next_action: null },
        [],
        [],
      ),
    ).toBeNull();
  });
});
