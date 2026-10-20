import { describe, expect, it } from "vitest";
import { executiveProjectHealth, isProjectPlanStale, projectHealth, timeEfficiency } from "@/lib/project-metrics";

describe("timeEfficiency", () => {
  it("returns estimated/actual x 100", () => {
    expect(timeEfficiency(60, 120)).toBe(50);
    expect(timeEfficiency(120, 60)).toBe(200);
  });

  it("does not invent a result without usable time data", () => {
    expect(timeEfficiency(null, 60)).toBeNull();
    expect(timeEfficiency(60, 0)).toBeNull();
  });
});

describe("projectHealth", () => {
  it("flags open blockers", () => {
    expect(projectHealth({ progress: 50, openBlockers: 1 })).toBe("at_risk");
  });

  it("marks completed work", () => {
    expect(projectHealth({ progress: 100, openBlockers: 0 })).toBe("completed");
  });

  it("flags overdue actions even without a project due date", () => {
    expect(projectHealth({ progress: 20, openBlockers: 0, overdueActions: 1 })).toBe("at_risk");
  });

});


describe("isProjectPlanStale", () => {
  it("stays current when no material source is newer", () => {
    expect(isProjectPlanStale("2026-10-16T12:00:00Z", {})).toBe(false);
  });

  it("becomes stale when new evidence arrives", () => {
    expect(
      isProjectPlanStale("2026-10-16T12:00:00Z", {
        latestEvidenceAt: "2026-10-17T12:00:00Z",
      }),
    ).toBe(true);
  });

  it("supports an explicit material project timestamp without treating generic maintenance as a source", () => {
    expect(
      isProjectPlanStale("2026-10-16T12:00:00Z", {
        materialProjectUpdatedAt: "2026-10-17T12:00:00Z",
      }),
    ).toBe(true);
  });
});

describe("executiveProjectHealth overdue execution", () => {
  it("reduces executive health when operational actions are overdue", () => {
    const health = executiveProjectHealth({
      progress: 0,
      openBlockers: 0,
      overdueActions: 3,
      activeDependencies: 1,
      planStale: false,
      gateStatus: "in_progress",
      hasOwner: true,
    });
    expect(health.status).toBe("at_risk");
    expect(health.score).toBe(65);
  });
});
