import { displayLabel } from "@/lib/display-label";

const tone: Record<string, string> = {
  active: "bg-[var(--cc-success-soft)] text-[var(--cc-success)] ring-[color-mix(in_srgb,var(--cc-success)_20%,transparent)]",
  on_track: "bg-[var(--cc-success-soft)] text-[var(--cc-success)] ring-[color-mix(in_srgb,var(--cc-success)_20%,transparent)]",
  completed: "bg-[var(--cc-success-soft)] text-[var(--cc-success)] ring-[color-mix(in_srgb,var(--cc-success)_20%,transparent)]",
  resolved: "bg-[var(--cc-success-soft)] text-[var(--cc-success)] ring-[color-mix(in_srgb,var(--cc-success)_20%,transparent)]",

  at_risk: "bg-[var(--cc-warning-soft)] text-[#8A611C] ring-[color-mix(in_srgb,var(--cc-warning)_28%,transparent)]",
  investigating: "bg-[var(--cc-warning-soft)] text-[#8A611C] ring-[color-mix(in_srgb,var(--cc-warning)_28%,transparent)]",

  pending: "bg-[var(--cc-surface-muted)] text-[var(--cc-secondary)] ring-[var(--cc-border)]",
  draft: "bg-[var(--cc-surface-muted)] text-[var(--cc-secondary)] ring-[var(--cc-border)]",
  idea: "bg-[var(--cc-surface-muted)] text-[var(--cc-secondary)] ring-[var(--cc-border)]",
  captured: "bg-[var(--cc-surface-muted)] text-[var(--cc-secondary)] ring-[var(--cc-border)]",
  waiting: "bg-[var(--cc-surface-muted)] text-[var(--cc-secondary)] ring-[var(--cc-border)]",

  delayed: "bg-[var(--cc-danger-soft)] text-[var(--cc-danger)] ring-[color-mix(in_srgb,var(--cc-danger)_22%,transparent)]",
  blocked: "bg-[var(--cc-danger-soft)] text-[var(--cc-danger)] ring-[color-mix(in_srgb,var(--cc-danger)_22%,transparent)]",
  open: "bg-[var(--cc-danger-soft)] text-[var(--cc-danger)] ring-[color-mix(in_srgb,var(--cc-danger)_22%,transparent)]",
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
