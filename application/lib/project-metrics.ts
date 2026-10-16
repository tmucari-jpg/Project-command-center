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
}: {
  progress: number;
  dueDate?: string | null;
  openBlockers: number;
}) {
  if (openBlockers > 0) return "at_risk";
  if (dueDate && new Date(`${dueDate}T23:59:59`).getTime() < Date.now() && progress < 100) {
    return "delayed";
  }
  return progress >= 100 ? "completed" : "on_track";
}


export function isProjectPlanStale(
  planUpdatedAt: string | null | undefined,
  sourceTimestamps: Array<string | null | undefined>,
) {
  if (!planUpdatedAt) return true;
  const planTime = new Date(planUpdatedAt).getTime();
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
  activeDependencies,
  nextReviewDate,
  planStale,
  gateStatus,
  hasOwner,
}: {
  progress: number;
  dueDate?: string | null;
  openBlockers: number;
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
