export type WeeklyReviewInput = {
  projects: Array<{ id: string; title: string; status: string; progress: number | null }>;
  actions: Array<{ project_id: string | null; status: string }>;
  blockers: Array<{ project_id: string | null; status: string }>;
  evidence: Array<{ project_id: string | null; created_at: string }>;
};

export function buildWeeklyReview(input: WeeklyReviewInput) {
  return input.projects.map((project) => {
    const actions = input.actions.filter((item) => item.project_id === project.id);
    const openActions = actions.filter((item) => !["completed", "cancelled"].includes(item.status)).length;
    const completedActions = actions.filter((item) => item.status === "completed").length;
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
      open_blockers: openBlockers,
      evidence_count: evidenceCount,
    };
  });
}
