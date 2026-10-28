import { artifactInformationGaps } from "@/lib/artifacts/readiness";
export type DocumentKind = "master_mind" | "master_plan" | "commercial_guide" | "diagnosis" | "decision" | "progress" | "closure" | "document" | "spreadsheet" | "presentation";
export type ArtifactSnapshot = {
  version: string; generatedAt: string; kind: DocumentKind;
  deliverable: Record<string, unknown>; project: Record<string, unknown>;
  sections: Array<{ title: string; rows: Array<Record<string, unknown>> }>;
  reviewedContent?: string;
};
export type GeneratedFile = { extension: string; mime: string; bytes: Buffer };
export const KIND_LABELS: Record<DocumentKind,string> = { master_mind:"Master Mind", master_plan:"Master Plan", commercial_guide:"Guia Comercial", diagnosis:"Diagnóstico", decision:"Dossier de decisão", progress:"Relatório de progresso", closure:"Relatório de fecho", document:"Documento", spreadsheet:"Folha de cálculo", presentation:"Apresentação" };
export const FIELD_LABELS: Record<string,string> = { name:"Nome", title:"Título", description:"Descrição", status:"Estado", expected_result:"Resultado esperado", completion_criteria:"Critério de aceitação", progress:"Progresso (%)", next_action:"Próxima acção", currency:"Moeda", amount:"Montante", category:"Categoria", due_date:"Prazo", stage:"Etapa", value:"Valor", rationale:"Fundamentação", decision:"Decisão", solution:"Solução", impact:"Impacto", url:"URL", artifact_url:"Artefacto", artifact_reference:"Referência", qa_status:"QA", acceptance_status:"Aceitação", notes:"Notas", severity:"Gravidade", risk:"Risco", budget:"Orçamento", owner_id:"Responsável (referência)", price:"Preço", offer:"Oferta", result:"Resultado", measured_on:"Data de medição", current_value:"Valor actual", target_value:"Valor alvo", metric_type:"Tipo de métrica", metric_unit:"Unidade" };
export function fact(value: unknown): string {
  if (value == null || value === "") return "DADO EM FALTA";
  if (Array.isArray(value)) return value.length ? value.map(fact).join("; ") : "Sem registos";
  if (typeof value === "object") return Object.entries(value as Record<string,unknown>).map(([k,v])=>`${FIELD_LABELS[k] ?? k}: ${fact(v)}`).join("\n");
  return String(value);
}
export function documentSections(s: ArtifactSnapshot) {
  return [
    { title:"Resultado a produzir e critérios", rows:[s.deliverable] },
    { title:"Contexto do projecto", rows:[s.project] },
    ...(s.reviewedContent ? [{ title:"Conteúdo revisto pelo responsável", rows:[{ description:s.reviewedContent }] }] : []),
    ...s.sections,
    {title:"Informação em falta e seguimento",rows:artifactInformationGaps(s)},
  ];
}
