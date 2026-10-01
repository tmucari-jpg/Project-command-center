export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-[16px] border border-[var(--cc-border)] bg-white ${className}`}>{children}</section>;
}

export function StatCard({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm font-medium text-[var(--cc-secondary)]">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-[var(--cc-foreground)]">{value}</p>
      {detail && <p className="mt-2 text-xs text-[var(--cc-secondary)]">{detail}</p>}
    </Card>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="rounded-[12px] border border-dashed border-[var(--cc-border)] px-5 py-10 text-center text-sm text-[var(--cc-secondary)]">{children}</div>;
}

export const inputClass = "mt-1.5 min-h-11 w-full rounded-[12px] border border-[var(--cc-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--cc-foreground)] outline-none transition focus:border-[var(--cc-accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--cc-accent)_18%,transparent)]";
export const textareaClass = `${inputClass} min-h-24 resize-y`;
export const selectClass = inputClass;
export const primaryButtonClass = "inline-flex min-h-11 items-center justify-center rounded-[12px] bg-[var(--cc-foreground)] px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)] disabled:cursor-not-allowed disabled:opacity-50";
export const secondaryButtonClass = "inline-flex min-h-11 items-center justify-center rounded-[12px] border border-[var(--cc-border)] bg-white px-3.5 py-2 text-sm font-medium text-[var(--cc-foreground)] transition hover:bg-[var(--cc-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)]";
