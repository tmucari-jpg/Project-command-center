type BarItem = {
  label: string;
  value: number;
  meta?: string;
};

export function SimpleBarChart({
  items,
  emptyLabel = "Sem dados para apresentar.",
  valueSuffix = "",
}: {
  items: BarItem[];
  emptyLabel?: string;
  valueSuffix?: string;
}) {
  if (!items.length) {
    return <p className="text-sm text-[var(--cc-secondary)]">{emptyLabel}</p>;
  }

  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const width = Math.max(4, Math.round((item.value / max) * 100));
        return (
          <div key={item.label} className="grid gap-2 sm:grid-cols-[minmax(150px,0.8fr)_minmax(180px,2fr)_auto] sm:items-center">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[var(--cc-foreground)]">{item.label}</p>
              {item.meta && <p className="text-xs text-[var(--cc-secondary)]">{item.meta}</p>}
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-[var(--cc-surface-muted)]">
              <div
                className="h-full rounded-full bg-[var(--cc-accent)]"
                style={{ width: `${width}%` }}
                aria-hidden="true"
              />
            </div>
            <span className="text-sm font-semibold tabular-nums text-[var(--cc-foreground)]">{item.value}{valueSuffix}</span>
          </div>
        );
      })}
    </div>
  );
}
