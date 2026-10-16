export type WeeklyReviewInput = {
  projects: Array<{ id: string; title: string; status: string; progress: number | null }>;
  actions: Array<{ project_id: string | null; status: string; due_at?: string | null }>;
  blockers: Array<{ project_id: string | null; status: string }>;
  evidence: Array<{ project_id: string | null; created_at: string }>;
};

export function buildWeeklyReview(input: WeeklyReviewInput, now = new Date()) {
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  return input.projects.map((project) => {
    const actions = input.actions.filter((item) => item.project_id === project.id);
    const openActions = actions.filter((item) => !["completed", "cancelled"].includes(item.status)).length;
    const completedActions = actions.filter((item) => item.status === "completed").length;
    const overdueActions = actions.filter((item) => {
      if (!item.due_at || ["completed", "cancelled"].includes(item.status)) return false;
      const due = new Date(item.due_at);
      return !Number.isNaN(due.getTime()) && due < now;
    }).length;
    const dueThisWeek = actions.filter((item) => {
      if (!item.due_at || ["completed", "cancelled"].includes(item.status)) return false;
      const due = new Date(item.due_at);
      return !Number.isNaN(due.getTime()) && due >= weekStart && due < weekEnd;
    }).length;
    const openBlockers = input.blockers.filter(
      (item) => item.project_id === project.id && !["resolved", "ignored"].includes(item.status),
    ).length;
    const evidenceCount = input.evidence.filter((item) => item.project_id === project.id).length;

    return {
      project_id: project.id,
      title: project.title,
      status: project.status,
      progress: Number(project.progress ?? 0),
      open_actions: openActions,
      completed_actions: completedActions,
      overdue_actions: overdueActions,
      due_this_week: dueThisWeek,
      open_blockers: openBlockers,
      evidence_count: evidenceCount,
    };
  }).sort((a, b) => {
    if (b.overdue_actions !== a.overdue_actions) return b.overdue_actions - a.overdue_actions;
    if (b.open_blockers !== a.open_blockers) return b.open_blockers - a.open_blockers;
    return a.title.localeCompare(b.title);
  });
}
