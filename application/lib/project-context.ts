export type ProjectContextInput = {
  project: {
    id: string;
    title: string;
    description?: string | null;
    expected_result?: string | null;
    status?: string | null;
    priority?: string | null;
    due_date?: string | null;
    next_action?: string | null;
  };
  objective?: { title: string; expected_result?: string | null } | null;
  actions?: Array<{ title: string; status: string; due_at?: string | null; is_next_action?: boolean | null }>;
  blockers?: Array<{ title: string; status: string; impact?: string | null }>;
  memory?: Array<{ memory_type: string; title: string; content: string }>;
  decisions?: Array<{ title: string; decision: string; rationale?: string | null }>;
};

export function buildMinimumProjectContext(input: ProjectContextInput) {
  return {
    prompt_contract: ["A01", "P01"],
    projecto: input.project.title,
    objectivo_actual: input.objective?.title ?? "DADO EM FALTA",
    estado_actual: input.project.status ?? "DADO EM FALTA",
    proxima_meta: input.project.expected_result ?? input.objective?.expected_result ?? "DADO EM FALTA",
    prioridade: input.project.priority ?? "DADO EM FALTA",
    prazo: input.project.due_date ?? "DADO EM FALTA",
    proxima_accao: input.project.next_action ?? "DADO EM FALTA",
    accoes_abertas: (input.actions ?? []).filter((item) => !["completed", "cancelled"].includes(item.status)),
    bloqueios_abertos: (input.blockers ?? []).filter((item) => !["resolved", "ignored"].includes(item.status)),
    memoria: input.memory ?? [],
    decisoes: input.decisions ?? [],
    regra: "Não assumir informação ausente. Usar DADO EM FALTA.",
  };
}
