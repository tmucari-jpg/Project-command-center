import { describe, expect, it } from "vitest";
import { canPassRun, requiresHumanApproval } from "@/lib/agentic-core";

describe("requiresHumanApproval", () => {
  it("requires approval for high-impact actions", () => {
    expect(requiresHumanApproval("payment")).toBe(true);
    expect(requiresHumanApproval("external_message")).toBe(true);
    expect(requiresHumanApproval("pricing_change")).toBe(true);
  });

  it("does not require approval for ordinary analysis", () => {
    expect(requiresHumanApproval("analysis")).toBe(false);
    expect(requiresHumanApproval("read")).toBe(false);
  });
});

describe("canPassRun", () => {
  it("passes only with QA evidence and no unresolved execution risk", () => {
    expect(canPassRun({
      qaStatus: "pass",
      evidenceCount: 2,
      pendingApprovals: 0,
      failedSteps: 0,
    })).toBe(true);

    expect(canPassRun({
      qaStatus: "pass",
      evidenceCount: 0,
      pendingApprovals: 0,
      failedSteps: 0,
    })).toBe(false);
  });
});
