export const FOUNDATION_PROMPTS = {
  A01: {
    code: "A01",
    name: "Configuração-base universal",
    role: "policy",
    purpose: "Baseline transversal de qualidade, contexto explícito e execução sem dados inventados.",
  },
  P01: {
    code: "P01",
    name: "Prompt Mestre do Command Center",
    role: "command",
    purpose: "Transformar estado do projecto em próxima acção, responsável, prazo, dependência e evidência.",
  },
  P02: {
    code: "P02",
    name: "Revisão diária",
    role: "daily_agenda",
    purpose: "Produzir foco diário curto a partir das acções reais existentes.",
  },
  P03: {
    code: "P03",
    name: "Revisão semanal",
    role: "weekly_review",
    purpose: "Sintetizar progresso, entregas, bloqueios, métricas e prioridades da semana.",
  },
  P05: {
    code: "P05",
    name: "Plano de monetização por projecto",
    role: "monetization",
    purpose: "Estruturar oferta, cliente, preço, canal, validação e próximos passos comerciais.",
  },
  G01: {
    code: "G01",
    name: "Prospecção B2B",
    role: "prospecting",
    purpose: "Apoiar prospecção sem inventar contactos ou empresas quando os dados não existem.",
  },
  G02: {
    code: "G02",
    name: "Pipeline comercial",
    role: "pipeline",
    purpose: "Rever oportunidades, etapas, próximos passos, riscos e informação em falta.",
  },
  E14: {
    code: "E14",
    name: "Pricing e unit economics",
    role: "pricing",
    purpose: "Analisar preços e sustentabilidade apenas com custos, receitas e premissas fornecidas.",
  },
} as const;

export type FoundationPromptCode = keyof typeof FOUNDATION_PROMPTS;

export const OFFICIAL_PROMPT_SOURCE = {
  directory: "02_AI/PromptLibrary",
  canonical: [
    "Biblioteca_Mestre_de_Prompts_Command_Center_v2.docx",
    "AI_Operations_Prompt_Library_Command_Center.xlsx",
  ],
  rule: "A biblioteca oficial fornece o texto; o código apenas referencia códigos canónicos e nunca cria uma segunda biblioteca.",
} as const;
