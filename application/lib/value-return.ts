export type MonetizationStatus = "yes" | "potential" | "not_primary" | "insufficient";
export type ReturnType =
  | "financial"
  | "operational"
  | "productivity"
  | "adoption"
  | "strategic"
  | "risk_reduction"
  | "social_personal"
  | "mixed"
  | "undetermined";

export const MONETIZATION_LABELS: Record<MonetizationStatus, string> = {
  yes: "Sim",
  potential: "Potencialmente",
  not_primary: "Não é o objectivo principal",
  insufficient: "Informação insuficiente",
};

export const RETURN_TYPE_LABELS: Record<ReturnType, string> = {
  financial: "Financeiro",
  operational: "Operacional",
  productivity: "Produtividade",
  adoption: "Adopção / uso",
  strategic: "Estratégico",
  risk_reduction: "Redução de risco",
  social_personal: "Social / pessoal",
  mixed: "Misto",
  undetermined: "Por determinar",
};

export function defaultMonetizationStatus(projectType?: string | null): MonetizationStatus {
  return projectType === "non_commercial" ? "not_primary" : "insufficient";
}

export function defaultReturnType(): ReturnType {
  return "undetermined";
}

export function monetizationNeedsEvidence(status: MonetizationStatus) {
  return status === "yes" || status === "potential";
}
