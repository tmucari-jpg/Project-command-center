export const CLIENT_DIAGNOSTIC_STATUS_LABELS: Record<string, string> = {
  active: "Pronto para enviar",
  opened: "Aberto pelo cliente",
  submitted: "Respondido",
  clarification_needed: "Precisa de esclarecimento",
  reviewed: "Revisto",
  incorporated: "Incorporado no diagnóstico",
  revoked: "Link revogado",
  expired: "Link expirado",
};

export const CLIENT_DIAGNOSTIC_REVIEW_LABELS: Record<string, string> = {
  accepted: "Aceite",
  partially_accepted: "Parcialmente aceite",
  clarification_needed: "Pedir esclarecimento",
};

export const CLIENT_DIAGNOSTIC_ANSWER_LABELS: Record<string, string> = {
  organization: "Organização",
  problem_need: "Problema / necessidade",
  current_situation: "Situação actual",
  impact: "Impacto actual",
  desired_result: "Resultado pretendido",
  affected_people: "Pessoas / utilizadores afectados",
  previous_attempts: "O que já foi tentado",
  deadline_urgency: "Prazo / urgência",
  budget_range: "Orçamento / intervalo disponível",
  decision_process: "Quem decide / valida",
  available_inputs: "Informação / activos disponíveis",
  constraints: "Restrições / condições",
  success_criteria: "Critérios de sucesso",
  additional_comments: "Comentários adicionais",
};

export const CLIENT_DIAGNOSTIC_REQUIRED_KEYS = [
  "problem_need",
  "current_situation",
  "impact",
  "desired_result",
  "success_criteria",
] as const;

export function diagnosticAnswerEntries(answers: unknown) {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return [];
  return Object.entries(answers as Record<string, unknown>)
    .map(([key, value]) => [key, typeof value === "string" ? value.trim() : String(value ?? "").trim()] as const)
    .filter(([, value]) => Boolean(value));
}

export function diagnosticMissingInformation(answers: unknown) {
  const record =
    answers && typeof answers === "object" && !Array.isArray(answers)
      ? (answers as Record<string, unknown>)
      : {};

  return CLIENT_DIAGNOSTIC_REQUIRED_KEYS
    .filter((key) => !String(record[key] ?? "").trim())
    .map((key) => CLIENT_DIAGNOSTIC_ANSWER_LABELS[key] ?? key);
}

export function diagnosticPointsToConfirm(answers: unknown) {
  return diagnosticAnswerEntries(answers)
    .filter(([, value]) => /não sei|nao sei|a confirmar|não definido|nao definido|por definir/i.test(value))
    .map(([key]) => CLIENT_DIAGNOSTIC_ANSWER_LABELS[key] ?? key);
}
