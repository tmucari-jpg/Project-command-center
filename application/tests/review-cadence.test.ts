import { describe, expect, it } from "vitest";
import { resolveNextReviewDate } from "@/lib/review-cadence";

describe("review cadence", () => {
  it("preserves an existing review date", () => {
    expect(resolveNextReviewDate({
      existingDate: "2026-10-23",
      cadenceDays: 7,
      from: new Date("2026-10-19T00:00:00Z"),
    })).toEqual({ date: "2026-10-23", source: "existing" });
  });

  it("does not invent a cadence", () => {
    expect(resolveNextReviewDate({
      existingDate: null,
      cadenceDays: null,
      from: new Date("2026-10-19T00:00:00Z"),
    })).toEqual({ date: null, source: "missing" });
  });

  it("calculates from an explicit parameter", () => {
    expect(resolveNextReviewDate({
      cadenceDays: 7,
      from: new Date("2026-10-19T00:00:00Z"),
    })).toEqual({ date: "2026-10-26", source: "calculated" });
  });
});
