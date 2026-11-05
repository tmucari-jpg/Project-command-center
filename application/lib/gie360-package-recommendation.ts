/** Recomendação determinística a partir de necessidades explicitamente declaradas.
 * Nunca aprova contrato, módulos ou tratamento de dados por IA.
 */
export function recommendGie360Package(answers: unknown): {
  code: string;
  basis: string;
} | null {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return null;
  const item = answers as Record<string, unknown>;
  const raw = item.necessidades;
  const needs = Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string") :
    typeof raw === "string" ? [raw] : [];
  const normalized = needs.map(value => value.trim().toLowerCase());
  if (normalized.some(value => value.includes("cobran") || value.includes("tesouraria") ||
      value.includes("custos") || value.includes("operaç") || value.includes("operac"))) {
    return { code: "gie360-complete", basis: "Necessidades declaradas de tesouraria, cobranças, custos ou operações." };
  }
  if (normalized.some(value => value.includes("vendas") || value.includes("clientes"))) {
    return { code: "gie360-professional", basis: "Necessidades declaradas de vendas ou gestão de clientes." };
  }
  if (normalized.some(value => value.includes("gestão") || value.includes("gestao") ||
      value.includes("indicadores") || value.includes("planeamento") || value.includes("dados"))) {
    return { code: "gie360-essential", basis: "Necessidades declaradas de informação, indicadores ou planeamento." };
  }
  return null;
}
