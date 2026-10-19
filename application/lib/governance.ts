export const GOVERNANCE_GATE_LABELS: Record<string, string> = {
  g1_triage: "G1 — Triagem",
  g2_viability: "G2 — Viabilidade",
  g3_planning: "G3 — Planeamento",
  g4_execution: "G4 — Execução",
  g5_closure: "G5 — Encerramento",
};

export const GOVERNANCE_GATE_QUESTIONS: Record<string, string> = {
  g1_triage: "Faz sentido explorar?",
  g2_viability: "Os números e a estratégia fecham?",
  g3_planning: "Temos o mapa e os recursos?",
  g4_execution: "Estamos no caminho?",
  g5_closure: "Entregámos o valor prometido?",
};

export const GOVERNANCE_STATUS_LABELS: Record<string, string> = {
  in_progress: "Em curso",
  ready: "Pronto para decisão",
  approved: "Aprovado",
  blocked: "Bloqueado",
  completed: "Concluído",
};
