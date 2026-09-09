import { describe, expect, it } from "vitest";
import { projectHealth, timeEfficiency } from "@/lib/project-metrics";

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
});
