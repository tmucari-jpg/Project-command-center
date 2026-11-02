import { z } from "zod";

export const GIE360_QUESTIONS = [
  { key: "sector", label: "Qual é o sector de actividade?", step: 0 },
  { key: "size", label: "Qual é a dimensão da empresa?", step: 0 },
  { key: "age", label: "Há quanto tempo está em actividade?", step: 0 },
  { key: "systems", label: "Que sistemas de gestão utiliza?", step: 0 },
  { key: "problems", label: "Que problemas pretende resolver?", step: 1 },
  { key: "proposals", label: "Como acompanha propostas e oportunidades?", step: 1 },
  { key: "collections", label: "Existem atrasos de cobranças?", step: 1 },
  { key: "costs", label: "Conhece os custos e a sua origem?", step: 1 },
  { key: "accounting", label: "Como está organizada a contabilidade?", step: 2 },
  { key: "documents", label: "Que documentos e dados estão disponíveis?", step: 2 },
  { key: "desired_result", label: "Que resultado pretende alcançar?", step: 2 },
  { key: "horizon", label: "Qual é o horizonte pretendido?", step: 2 },
] as const;
export type GIE360QuestionKey = typeof GIE360_QUESTIONS[number]["key"];
export type GIE360Answers = Partial<Record<GIE360QuestionKey, string>>;
const keys = GIE360_QUESTIONS.map((question) => question.key);
export const gie360AnswersSchema = z.partialRecord(z.enum(keys as [GIE360QuestionKey, ...GIE360QuestionKey[]]), z.string().trim().max(2000));
export function gie360InformationGaps(answers: GIE360Answers) {
  return GIE360_QUESTIONS.filter(({ key }) => !answers[key]?.trim() || /^(não sei|nao sei|não disponível|nao disponivel)$/i.test(answers[key]!.trim())).map(({ key, label }) => ({ key, label }));
}
export const GIE360_MODULES = [
  { code: "data", label: "Dados e validação" }, { code: "sales", label: "Vendas e clientes" },
  { code: "crm", label: "Pipeline CRM" }, { code: "billing", label: "Facturação e cobranças" },
  { code: "accounting", label: "Contabilidade e fiscalidade" }, { code: "treasury", label: "Tesouraria e custos" },
  { code: "operations", label: "Fornecedores e operações" }, { code: "strategy", label: "Estratégia e crescimento" },
  { code: "ai", label: "Inteligência artificial" }, { code: "plans", label: "Planos e evidências" },
  { code: "exports", label: "Exportação" },
] as const;
export function gie360ModuleState(input: { contracted: boolean; scopeApproved: boolean; relevant: boolean; approvedData: boolean }) {
  if (!input.contracted) return { status: "não contratado", reason: "Pacote e condições comerciais por aprovar." };
  if (!input.relevant || !input.scopeApproved) return { status: "recomendado", reason: "Relevância e âmbito precisam de aprovação do gestor." };
  if (!input.approvedData) return { status: "pendente de dados", reason: "São necessários dados aprovados para este módulo e período." };
  return { status: "pronto a avaliar", reason: "Âmbito e dados aprovados; a avaliação ainda exige revisão." };
}
