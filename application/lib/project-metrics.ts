export function timeEfficiency(estimatedMinutes: number | null, actualMinutes: number | null) {
  if (!estimatedMinutes || !actualMinutes || actualMinutes <= 0) return null;
  return (estimatedMinutes / actualMinutes) * 100;
}

export function progressLabel(progress: number | null | undefined) {
  const value = Math.min(100, Math.max(0, Number(progress ?? 0)));
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

export function projectHealth({
  progress,
  dueDate,
  openBlockers,
  overdueActions = 0,
}: {
  progress: number;
  dueDate?: string | null;
  openBlockers: number;
  overdueActions?: number;
}) {
  if (progress >= 100) return "completed";
  if (dueDate && new Date(`${dueDate}T23:59:59`).getTime() < Date.now()) {
    return "delayed";
  }
  if (openBlockers > 0 || overdueActions > 0) return "at_risk";
  return "on_track";
}


export function isProjectPlanStale(
  planUpdatedAt: string | null | undefined,
  sources: {
    latestEvidenceAt?: string | null;
    latestDecisionAt?: string | null;
    materialProjectUpdatedAt?: string | null;
  },
) {
  if (!planUpdatedAt) return true;
  const planTime = new Date(planUpdatedAt).getTime();
  const sourceTimestamps = [
    sources.latestEvidenceAt,
    sources.latestDecisionAt,
    sources.materialProjectUpdatedAt,
  ];

  return sourceTimestamps.some((value) => {
    if (!value) return false;
    const sourceTime = new Date(value).getTime();
    return Number.isFinite(sourceTime) && sourceTime > planTime;
  });
}

export function executiveProjectHealth({
  progress,
  dueDate,
  openBlockers,
  overdueActions = 0,
  activeDependencies,
  nextReviewDate,
  planStale,
  gateStatus,
  hasOwner,
}: {
  progress: number;
  dueDate?: string | null;
  openBlockers: number;
  overdueActions?: number;
  activeDependencies: number;
  nextReviewDate?: string | null;
  planStale: boolean;
  gateStatus?: string | null;
  hasOwner: boolean;
}) {
  const now = Date.now();
  const delayed =
    Boolean(dueDate) &&
    new Date(`${dueDate}T23:59:59`).getTime() < now &&
    progress < 100;

  const reviewOverdue =
    Boolean(nextReviewDate) &&
    new Date(`${nextReviewDate}T23:59:59`).getTime() < now;

  if (progress >= 100) return { status: "completed", score: 100, reviewOverdue };

  let score = 100;
  if (delayed) score -= 30;
  if (openBlockers > 0) score -= 25;
  if (overdueActions > 0) score -= 20;
  if (activeDependencies > 0) score -= 15;
  if (reviewOverdue) score -= 15;
  if (planStale) score -= 10;
  if (gateStatus === "blocked") score -= 15;
  if (!hasOwner) score -= 10;
  score = Math.max(0, score);

  const status =
    delayed ? "delayed" :
    score < 70 ? "at_risk" :
    "on_track";

  return { status, score, reviewOverdue };
}
