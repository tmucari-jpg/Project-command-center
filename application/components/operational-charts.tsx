import type { CSSProperties } from "react";

export type DonutItem = {
  label: string;
  value: number;
  color: string;
};

export function DonutChart({
  items,
  centerLabel = "Total",
}: {
  items: DonutItem[];
  centerLabel?: string;
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  let cursor = 0;
  const stops = items
    .filter((item) => item.value > 0)
    .map((item) => {
      const start = cursor;
      cursor += total > 0 ? (item.value / total) * 100 : 0;
      return `${item.color} ${start}% ${cursor}%`;
    });

  const style: CSSProperties = {
    background: total > 0
      ? `conic-gradient(${stops.join(", ")})`
      : "conic-gradient(var(--cc-surface-muted) 0 100%)",
  };

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <div
        className="relative h-36 w-36 shrink-0 rounded-full"
        style={style}
        role="img"
        aria-label={items.map((item) => `${item.label}: ${item.value}`).join(", ")}
      >
        <div className="absolute inset-[22%] grid place-items-center rounded-full bg-[var(--cc-surface-strong)] text-center shadow-sm">
          <div>
            <p className="text-2xl font-semibold leading-none text-[var(--cc-foreground)]">{total}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--cc-secondary)]">{centerLabel}</p>
          </div>
        </div>
      </div>
      <div className="grid min-w-0 flex-1 gap-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2 text-[var(--cc-secondary)]">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
              <span className="truncate">{item.label}</span>
            </span>
            <span className="font-semibold text-[var(--cc-foreground)]">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PressureLegend() {
  const items = [
    ["Bloqueado", "var(--cc-blocked)"],
    ["Em atraso", "var(--cc-overdue)"],
    ["A vencer", "var(--cc-due-soon)"],
    ["Revisão vencida", "var(--cc-accent-soft)"],
  ] as const;

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-[var(--cc-secondary)]">
      {items.map(([label, color]) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
          {label}
        </span>
      ))}
    </div>
  );
}

export function PressureBar({
  blocked,
  overdue,
  dueSoon,
  reviewOverdue = false,
  max,
}: {
  blocked: number;
  overdue: number;
  dueSoon: number;
  reviewOverdue?: boolean;
  max: number;
}) {
  const safeMax = Math.max(1, max);
  const segments = [
    { key: "blocked", value: blocked, color: "var(--cc-blocked)", label: "Bloqueado" },
    { key: "overdue", value: overdue, color: "var(--cc-overdue)", label: "Em atraso" },
    { key: "dueSoon", value: dueSoon, color: "var(--cc-due-soon)", label: "A vencer" },
    { key: "review", value: reviewOverdue ? 1 : 0, color: "var(--cc-accent-soft)", label: "Revisão vencida" },
  ];

  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  return (
    <div
      className="flex h-3 overflow-hidden rounded-full bg-[var(--cc-surface-muted)]"
      role="img"
      aria-label={segments.filter((segment) => segment.value > 0).map((segment) => `${segment.label}: ${segment.value}`).join(", ") || "Sem pressão operacional"}
    >
      {total === 0 ? null : segments.map((segment) => (
        segment.value > 0 ? (
          <span
            key={segment.key}
            className="h-full"
            style={{
              width: `${Math.max(3, (segment.value / safeMax) * 100)}%`,
              background: segment.color,
            }}
          />
        ) : null
      ))}
    </div>
  );
}
