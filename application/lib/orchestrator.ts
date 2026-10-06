import type { AgentType } from "@/lib/agentic-core";

export const ORCHESTRATOR_TASK_TYPES = [
  "command",
  "research",
  "competitive_intelligence",
  "business",
  "marketing",
  "product",
  "qa",
  "analytics",
] as const;

export type OrchestratorTaskType = (typeof ORCHESTRATOR_TASK_TYPES)[number];

export type RiskLevel = "low" | "medium" | "high" | "critical";
export type FactualityLevel = "standard" | "high";
export type CostSensitivity = "low" | "medium" | "high";

const agentByTask: Record<OrchestratorTaskType, AgentType> = {
  command: "command",
  research: "research",
  competitive_intelligence: "research",
  business: "business",
  marketing: "marketing",
  product: "product",
  qa: "qa",
  analytics: "analytics",
};

export function selectExecutionRoute(input: {
  taskType: OrchestratorTaskType;
  riskLevel: RiskLevel;
  factuality: FactualityLevel;
  costSensitivity: CostSensitivity;
}) {
  const selectedAgent = agentByTask[input.taskType];
  const dots = new Set<string>();

  if (input.taskType === "competitive_intelligence" || input.taskType === "research") {
    dots.add("source_check");
    dots.add("fact_check");
  }
  if (input.factuality === "high") {
    dots.add("evidence_check");
    dots.add("fact_check");
  }
  if (input.costSensitivity === "high") dots.add("cost_guard");
  if (input.riskLevel === "high" || input.riskLevel === "critical") dots.add("risk_gate");
  if (input.taskType === "qa") dots.add("regression_check");

  const providerPolicy =
    input.factuality === "high" || input.riskLevel === "critical"
      ? "quality_first"
      : input.costSensitivity === "high"
        ? "local_first"
        : "balanced";

  const strategy =
    input.taskType === "competitive_intelligence"
      ? "research_then_verify"
      : input.taskType === "qa"
        ? "test_then_evidence"
        : "direct_with_qa";

  const approvalRequired = input.riskLevel === "critical";

  return {
    selectedAgent,
    selectedDots: Array.from(dots),
    providerPolicy,
    strategy,
    approvalRequired,
    rationale: [
      `agent=${selectedAgent} for task=${input.taskType}`,
      `provider_policy=${providerPolicy}`,
      `strategy=${strategy}`,
      approvalRequired ? "critical risk requires human gate" : "no mandatory human gate at routing stage",
    ].join("; "),
  };
}
