import { describe, expect, it } from "vitest";
import { buildDailyAgenda } from "@/lib/daily-agenda";

const now = new Date("2026-10-02T08:00:00Z");

describe("buildDailyAgenda", () => {
  it("keeps at most five open actions and prioritises the explicit next action", () => {
    const actions = [
      { id: "1", title: "Normal", status: "pending", priority: "medium", due_at: null, is_next_action: false },
      { id: "2", title: "Next", status: "pending", priority: "low", due_at: null, is_next_action: true },
      { id: "3", title: "Overdue", status: "pending", priority: "high", due_at: "2026-10-01T08:00:00Z", is_next_action: false },
      { id: "4", title: "Today", status: "pending", priority: "medium", due_at: "2026-10-02T12:00:00Z", is_next_action: false },
      { id: "5", title: "Later", status: "pending", priority: "low", due_at: "2026-10-10T08:00:00Z", is_next_action: false },
      { id: "6", title: "Extra", status: "pending", priority: "low", due_at: null, is_next_action: false },
    ];

    const agenda = buildDailyAgenda(actions, now);

    expect(agenda).toHaveLength(5);
    expect(agenda[0].id).toBe("2");
    expect(agenda.map((item) => item.id)).not.toContain("6");
  });

  it("never returns completed or cancelled actions", () => {
    const agenda = buildDailyAgenda([
      { id: "1", title: "Done", status: "completed", priority: "critical", due_at: "2026-10-01T08:00:00Z", is_next_action: true },
      { id: "2", title: "Cancelled", status: "cancelled", priority: "critical", due_at: "2026-10-01T08:00:00Z", is_next_action: true },
      { id: "3", title: "Open", status: "pending", priority: "low", due_at: null, is_next_action: false },
    ], now);

    expect(agenda.map((item) => item.id)).toEqual(["3"]);
  });
});
