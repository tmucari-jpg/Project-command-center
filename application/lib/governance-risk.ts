export type GovernanceRiskStatus =
  | "open"
  | "mitigating"
  | "mitigated"
  | "accepted"
  | "resolved";

export type GovernanceRisk = {
  severity: "low" | "medium" | "high" | "critical";
  status: GovernanceRiskStatus;
  blocks_progress: boolean;
};

const CLOSED_RISK_STATUSES: GovernanceRiskStatus[] = ["mitigated", "accepted", "resolved"];

export function isBlockingGovernanceRisk(risk: GovernanceRisk) {
  return risk.blocks_progress && !CLOSED_RISK_STATUSES.includes(risk.status);
}

export function hasBlockingGovernanceRisk(risks: GovernanceRisk[]) {
  return risks.some(isBlockingGovernanceRisk);
}

export function summarizeGovernanceRiskState(risks: GovernanceRisk[]) {
  const open = risks.filter((risk) => !CLOSED_RISK_STATUSES.includes(risk.status));
  const blocking = open.filter(isBlockingGovernanceRisk);
  const critical = open.filter((risk) => risk.severity === "critical");

  return {
    total: risks.length,
    open: open.length,
    blocking: blocking.length,
    critical: critical.length,
    canAdvance: blocking.length === 0,
  };
}
