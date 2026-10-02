export const AGENT_TYPES = [
  "command",
  "research",
  "business",
  "marketing",
  "product",
  "qa",
  "analytics",
] as const;

export type AgentType = (typeof AGENT_TYPES)[number];

export const HUMAN_APPROVAL_ACTIONS = [
  "payment",
  "external_message",
  "external_publication",
  "delete",
  "strategic_change",
  "pricing_change",
  "permission_change",
  "irreversible_action",
] as const;

export type HumanApprovalAction = (typeof HUMAN_APPROVAL_ACTIONS)[number];

export function requiresHumanApproval(actionType: string) {
  return HUMAN_APPROVAL_ACTIONS.includes(actionType as HumanApprovalAction);
}

export const AGENT_REGISTRY: Record<AgentType, { label: string; purpose: string; defaultPromptCodes: string[] }> = {
  command: {
    label: "Command Agent",
    purpose: "Coordena contexto, próxima acção e execução do projecto.",
    defaultPromptCodes: ["A01", "P01"],
  },
  research: {
    label: "Research Agent",
    purpose: "Pesquisa e valida factos, fontes e lacunas de informação.",
    defaultPromptCodes: ["A01", "E13", "E19"],
  },
  business: {
    label: "Business Agent",
    purpose: "Monetização, oferta, pipeline, pricing e riscos de negócio.",
    defaultPromptCodes: ["A01", "P05", "G01", "G02", "E14"],
  },
  marketing: {
    label: "Marketing Agent",
    purpose: "Canais, campanhas, crescimento, conteúdo e aquisição.",
    defaultPromptCodes: ["A01", "E02", "G06", "G07"],
  },
  product: {
    label: "Product Agent",
    purpose: "Discovery, roadmap, lançamento e melhoria do produto.",
    defaultPromptCodes: ["A01", "E12", "E15", "E16", "E19"],
  },
  qa: {
    label: "QA Agent",
    purpose: "Valida critérios PASS, evidência, regressões e segurança.",
    defaultPromptCodes: ["A01", "T08", "T09"],
  },
  analytics: {
    label: "Analytics Agent",
    purpose: "Métricas, alertas, unit economics e controlo financeiro.",
    defaultPromptCodes: ["A01", "G08", "G09", "E14"],
  },
};

export function canPassRun(input: {
  qaStatus: string;
  evidenceCount: number;
  pendingApprovals: number;
  failedSteps: number;
}) {
  return (
    input.qaStatus === "pass" &&
    input.evidenceCount > 0 &&
    input.pendingApprovals === 0 &&
    input.failedSteps === 0
  );
}
