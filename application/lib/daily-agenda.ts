export type AgendaAction = {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  due_at: string | null;
  is_next_action: boolean | null;
  project_id?: string | null;
  estimated_minutes?: number | null;
  projects?: { title: string } | { title: string }[] | null;
};

const priorityScore: Record<string, number> = {
  critical: 40,
  high: 30,
  medium: 20,
  low: 10,
};

function dueScore(dueAt: string | null, now: Date) {
  if (!dueAt) return 0;
  const due = new Date(dueAt).getTime();
  if (Number.isNaN(due)) return 0;

  const diffHours = (due - now.getTime()) / 3_600_000;
  if (diffHours < 0) return 50;
  if (diffHours <= 24) return 30;
  if (diffHours <= 72) return 15;
  return 0;
}

export function agendaScore(action: AgendaAction, now = new Date()) {
  if (["completed", "cancelled"].includes(action.status)) return Number.NEGATIVE_INFINITY;

  return (
    (action.is_next_action ? 100 : 0) +
    (priorityScore[action.priority ?? ""] ?? 0) +
    dueScore(action.due_at, now)
  );
}

export function buildDailyAgenda(actions: AgendaAction[], now = new Date(), limit = 5) {
  return actions
    .filter((action) => !["completed", "cancelled"].includes(action.status))
    .map((action) => ({ action, score: agendaScore(action, now) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;

      const aDue = a.action.due_at ? new Date(a.action.due_at).getTime() : Number.POSITIVE_INFINITY;
      const bDue = b.action.due_at ? new Date(b.action.due_at).getTime() : Number.POSITIVE_INFINITY;
      if (aDue !== bDue) return aDue - bDue;

      return a.action.title.localeCompare(b.action.title);
    })
    .slice(0, limit)
    .map(({ action }) => action);
}
