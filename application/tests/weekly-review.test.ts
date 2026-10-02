import { describe, expect, it } from "vitest";
import { buildWeeklyReview } from "@/lib/weekly-review";

describe("buildWeeklyReview", () => {
  it("summarises execution by project without inventing data", () => {
    const review = buildWeeklyReview({
      projects: [{ id: "p1", title: "Projecto A", status: "active", progress: 40 }],
      actions: [
        { project_id: "p1", status: "completed" },
        { project_id: "p1", status: "pending" },
      ],
      blockers: [{ project_id: "p1", status: "open" }],
      evidence: [{ project_id: "p1", created_at: "2026-10-02T08:00:00Z" }],
    });

    expect(review[0]).toMatchObject({
      open_actions: 1,
      completed_actions: 1,
      open_blockers: 1,
      evidence_count: 1,
    });
  });
});
