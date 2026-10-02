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
