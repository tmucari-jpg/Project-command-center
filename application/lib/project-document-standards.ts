export const PCC_DOCUMENT_STANDARDS = {
  master_mind: {
    key: "master_mind",
    label: "Master Mind",
    workstream: "governance",
    artifact_type: "document",
    applicability: "Usar quando o projecto precisa de uma fonte de verdade consolidada, governação, arquitectura, decisões, execução e evidência — ou sempre que for solicitado.",
    buildTitle: (projectTitle: string) => `Master Mind — ${projectTitle}`,
    buildDescription: (projectTitle: string) =>
      `Documento mestre do projecto ${projectTitle}. Consolida contexto, objectivo, diagnóstico, decisões, estrutura, execução, riscos, métricas, evidências, entregáveis, aprendizagem e regras de governação, seguindo o padrão documental oficial do PCC.`,
    completion_criteria:
      "Versão final validada, coerente com o estado real do projecto, com identidade visual oficial do PCC, decisões e evidências rastreáveis, entregáveis e próximos passos, e controlo de versão.",
  },
  commercial_guide: {
    key: "commercial_guide",
    label: "Guia Comercial",
    workstream: "commercial",
    artifact_type: "document",
    applicability: "Usar quando o projecto tem componente de mercado, posicionamento, proposta de valor, preços, marketing, vendas, lançamento ou relação com clientes — ou sempre que for solicitado.",
    buildTitle: (projectTitle: string) => `Guia Comercial — ${projectTitle}`,
    buildDescription: (projectTitle: string) =>
      `Guia comercial do projecto ${projectTitle}. Consolida posicionamento, proposta de valor, cliente-alvo, entregáveis, pacotes/preços quando aplicável, abordagem comercial, diagnóstico, funil, canais, lançamento, métricas e regras de comunicação, seguindo o padrão documental oficial do PCC.`,
    completion_criteria:
      "Versão final validada, alinhada com o Master Mind e com a evidência comercial disponível, usando a identidade visual e o padrão documental oficial do PCC, sem promessas não suportadas por resultados reais.",
  },
} as const;

export type PccDocumentStandardKey = keyof typeof PCC_DOCUMENT_STANDARDS;

export function getPccDocumentStandard(value: string | null | undefined) {
  if (!value || !(value in PCC_DOCUMENT_STANDARDS)) return null;
  return PCC_DOCUMENT_STANDARDS[value as PccDocumentStandardKey];
}

export function preparePccDocumentDraft(
  standardKey: PccDocumentStandardKey,
  project: {
    title: string;
    priority: string;
    due_date?: string | null;
  },
) {
  const standard = PCC_DOCUMENT_STANDARDS[standardKey];
  return {
    title: standard.buildTitle(project.title),
    description: standard.buildDescription(project.title),
    priority: project.priority,
    due_date: project.due_date || undefined,
    completion_criteria: standard.completion_criteria,
    workstream: standard.workstream,
    artifact_type: standard.artifact_type,
  };
}
