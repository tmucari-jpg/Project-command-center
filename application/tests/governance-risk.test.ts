import { describe, expect, it } from "vitest";
import {
  hasBlockingGovernanceRisk,
  isBlockingGovernanceRisk,
  summarizeGovernanceRiskState,
} from "@/lib/governance-risk";

describe("governance risk gate rules", () => {
  it("blocks an open blocking risk", () => {
    expect(
      isBlockingGovernanceRisk({
        severity: "critical",
        status: "open",
        blocks_progress: true,
      }),
    ).toBe(true);
  });

  it("does not block a formally accepted risk", () => {
    expect(
      isBlockingGovernanceRisk({
        severity: "critical",
        status: "accepted",
        blocks_progress: true,
      }),
    ).toBe(false);
  });

  it("summarizes gate readiness from risks", () => {
    const summary = summarizeGovernanceRiskState([
      { severity: "high", status: "mitigating", blocks_progress: true },
      { severity: "medium", status: "open", blocks_progress: false },
      { severity: "critical", status: "resolved", blocks_progress: true },
    ]);

    expect(summary.open).toBe(2);
    expect(summary.blocking).toBe(1);
    expect(summary.critical).toBe(0);
    expect(summary.canAdvance).toBe(false);
    expect(hasBlockingGovernanceRisk([
      { severity: "high", status: "mitigating", blocks_progress: true },
    ])).toBe(true);
  });
});
