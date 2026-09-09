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
