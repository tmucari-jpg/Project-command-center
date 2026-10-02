import { describe, expect, it } from "vitest";
import { calculateToolGovernanceScore, optimizationStatus } from "@/lib/optimization";

describe("optimizationStatus", () => {
  it("supports higher and lower targets", () => {
    expect(optimizationStatus({ key: "x", label: "x", current: 90, target: 80, direction: "higher_better" })).toBe("on_target");
    expect(optimizationStatus({ key: "y", label: "y", current: 12, target: 10, direction: "lower_better" })).toBe("above_target");
  });

  it("does not invent a target", () => {
    expect(optimizationStatus({ key: "x", label: "x", current: 90, direction: "higher_better" })).toBe("untracked");
  });
});

describe("calculateToolGovernanceScore", () => {
  it("scores only explicit governance controls", () => {
    expect(calculateToolGovernanceScore({
      localFirst: true,
      workOnlyWhenJustified: true,
      secretsProtected: true,
      destructiveActionsGated: true,
    })).toBe(100);
  });
});
