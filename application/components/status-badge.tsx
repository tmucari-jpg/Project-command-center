import { displayLabel } from "@/lib/display-label";

const tone: Record<string, string> = {
  active: "bg-[var(--cc-success-soft)] text-[var(--cc-success)] ring-[color-mix(in_srgb,var(--cc-success)_20%,transparent)]",
  on_track: "bg-[var(--cc-success-soft)] text-[var(--cc-success)] ring-[color-mix(in_srgb,var(--cc-success)_20%,transparent)]",
  completed: "bg-[var(--cc-success-soft)] text-[var(--cc-success)] ring-[color-mix(in_srgb,var(--cc-success)_20%,transparent)]",
  resolved: "bg-[var(--cc-success-soft)] text-[var(--cc-success)] ring-[color-mix(in_srgb,var(--cc-success)_20%,transparent)]",

  in_progress: "bg-[var(--cc-in-progress-soft)] text-[var(--cc-in-progress)] ring-[color-mix(in_srgb,var(--cc-in-progress)_22%,transparent)]",

  at_risk: "bg-[var(--cc-warning-soft)] text-[#8A611C] ring-[color-mix(in_srgb,var(--cc-warning)_28%,transparent)]",
  investigating: "bg-[var(--cc-warning-soft)] text-[#8A611C] ring-[color-mix(in_srgb,var(--cc-warning)_28%,transparent)]",
  due_soon: "bg-[var(--cc-due-soon-soft)] text-[#8A611C] ring-[color-mix(in_srgb,var(--cc-due-soon)_28%,transparent)]",

  pending: "bg-[var(--cc-surface-muted)] text-[var(--cc-secondary)] ring-[var(--cc-border)]",
  draft: "bg-[var(--cc-surface-muted)] text-[var(--cc-secondary)] ring-[var(--cc-border)]",
  idea: "bg-[var(--cc-surface-muted)] text-[var(--cc-secondary)] ring-[var(--cc-border)]",
  captured: "bg-[var(--cc-surface-muted)] text-[var(--cc-secondary)] ring-[var(--cc-border)]",
  waiting: "bg-[var(--cc-surface-muted)] text-[var(--cc-secondary)] ring-[var(--cc-border)]",

  delayed: "bg-[var(--cc-overdue-soft)] text-[var(--cc-overdue)] ring-[color-mix(in_srgb,var(--cc-overdue)_24%,transparent)]",
  overdue: "bg-[var(--cc-overdue-soft)] text-[var(--cc-overdue)] ring-[color-mix(in_srgb,var(--cc-overdue)_24%,transparent)]",
  blocked: "bg-[var(--cc-blocked-soft)] text-[var(--cc-blocked)] ring-[color-mix(in_srgb,var(--cc-blocked)_24%,transparent)]",
  open: "bg-[var(--cc-blocked-soft)] text-[var(--cc-blocked)] ring-[color-mix(in_srgb,var(--cc-blocked)_24%,transparent)]",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
        tone[status] ?? "bg-[var(--cc-surface-muted)] text-[var(--cc-secondary)] ring-[var(--cc-border)]"
      }`}
    >
      {displayLabel(status)}
    </span>
  );
}
