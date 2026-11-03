/**
 * Deterministic, auditable recommendation, not an automated approval.
 * Only diagnostic answers and an explicit review are considered.
 * The manager still approves the client association and module scope.
 */
export type DiagnosticRoute = {
  destination: "gie360" | "projects" | "review";
  reason: string;
  modules: string[];
};
const relevant = [
  { code: "sales", expression: /(?:vendas|comercial|clientes|propostas|oportunidades|sales)/i },
  { code: "crm", expression: /(?:crm|pipeline|leads|prospect)/i },
  { code: "billing", expression: /(?:factura|fatura|cobran|recebimento|inadimpl|billing)/i },
  { code: "accounting", expression: /(?:contabil|fiscal|impost|iva|accounting)/i },
  { code: "treasury", expression: /(?:tesouraria|fluxo de caixa|cash flow|custos|liquidez|financeir)/i },
  { code: "operations", expression: /(?:fornecedores|operações|operacionais|processos internos|logística)/i },
  { code: "strategy", expression: /(?:indicadores|kpi|estratégia|crescimento|planeamento|gestão empresarial)/i },
] as const;
export function recommendDiagnosticDestination(answers: unknown): DiagnosticRoute {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    return { destination: "review", reason: "Diagnóstico sem respostas estruturadas para encaminhamento.", modules: [] };
  }
  const a = answers as Record<string, unknown>;
  const text = ["context", "focus", "desired_result", "success_criteria", "conditions"]
    .map(key => typeof a[key] === "string" ? a[key].trim() : "").filter(Boolean).join(" ");
  if (!text.trim()) return { destination: "review", reason: "Sem contexto e resultado esperado suficientes.", modules: [] };
  const modules = relevant.filter(item => item.expression.test(text)).map(item => item.code);
  if (modules.length === 0) {
    return { destination: "projects", reason: "O resultado descrito não identifica necessidades empresariais específicas dos módulos GIE360°.", modules: [] };
  }
  const organizational = a.respondent_type === "organization"
    || a.request_nature === "organization_solution"
    || /(?:empresa|organização|negócio|empresarial|departamento|equipa|corporativ)/i.test(text);
  if (!organizational) {
    return { destination: "review", reason: "Necessidades potencialmente empresariais; confirmar se o projecto pertence a uma organização.", modules };
  }
  return { destination: "gie360", reason: `Necessidades empresariais identificadas nas respostas: ${modules.join(", ")}. Recomenda-se GIE360° sujeito a aprovação interna.`, modules };
}
export function canAssociateFromDiagnostic(input: {
  requestStatus: string;
  reviewStatus: string | null;
  answers: unknown;
}) {
  const route = recommendDiagnosticDestination(input.answers);
  return {
    ...route,
    eligible: ["reviewed", "incorporated"].includes(input.requestStatus)
      && ["accepted", "partially_accepted"].includes(input.reviewStatus ?? "")
      && route.destination === "gie360",
  };
}
