import { describe, expect, it } from "vitest";
import { analyseWorkforce, type ActionSnapshot, type ProjectSnapshot } from "../lib/agent-workforce";

const project: ProjectSnapshot = {
  id: "project-1", title: "Lançamento", status: "active", priority: "high",
  due_date: null, next_action: "Enviar proposta ao cliente",
  updated_at: "2026-09-29T00:00:00Z",
};
const action: ActionSnapshot = {
  id: "action-1", project_id: "project-1", title: "Preparar proposta", status: "pending",
  priority: "critical", due_at: "2026-09-29T10:00:00Z", is_next_action: false,
  updated_at: "2026-09-29T00:00:00Z",
};

describe("força agêntica", () => {
  it("não recomenda como próxima uma acção bloqueada", () => {
    const result = analyseWorkforce([project], [action], [{
      id: "blocker-1", project_id: project.id, action_id: action.id,
      title: "Aguardar dados", status: "waiting",
    }], "2026-09-29");
    expect(result.proposals.some((item) => item.kind === "set_next_action")).toBe(false);
    expect(result.findings.some((item) => item.agent === "bloqueios")).toBe(true);
  });

  it("propõe o próximo passo explícito de um projecto sem acções abertas", () => {
    const result = analyseWorkforce([project], [], [], "2026-09-29");
    expect(result.proposals).toContainEqual(expect.objectContaining({
      kind: "create_action", target_id: project.id, title: "Enviar proposta ao cliente",
    }));
  });

  it("não recomenda trabalho de projectos concluídos e prioriza um prazo vencido", () => {
    const late = { ...action, id: "late", project_id: null, priority: "medium", due_at: "2026-09-28T10:00:00Z" };
    const result = analyseWorkforce([{ ...project, status: "completed" }], [action, late], [], "2026-09-29");
    expect(result.proposals).toEqual([expect.objectContaining({ kind: "set_next_action", target_id: "late" })]);
  });
});
