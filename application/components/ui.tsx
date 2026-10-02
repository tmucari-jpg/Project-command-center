export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-[var(--cc-radius-lg)] border border-[var(--cc-border)] bg-[var(--cc-surface)] shadow-[var(--cc-shadow-sm)] backdrop-blur-xl ${className}`}>
      {children}
    </section>
  );
}

export function StatCard({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <Card className="p-5 sm:p-6">
      <p className="text-sm font-medium text-[var(--cc-secondary)]">{label}</p>
      <p className="mt-2 text-[2rem] font-semibold leading-none tracking-[-0.03em] text-[var(--cc-foreground)]">{value}</p>
      {detail && <p className="mt-3 text-xs leading-5 text-[var(--cc-secondary)]">{detail}</p>}
    </Card>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--cc-radius-md)] border border-dashed border-[var(--cc-border)] bg-[var(--cc-surface-muted)]/55 px-5 py-10 text-center text-sm leading-6 text-[var(--cc-secondary)]">
      {children}
    </div>
  );
}

export const inputClass =
  "mt-1.5 min-h-12 w-full rounded-[14px] border border-[var(--cc-border)] bg-[var(--cc-surface-strong)] px-4 py-3 text-[16px] text-[var(--cc-foreground)] shadow-sm outline-none transition-[border-color,box-shadow,background-color] placeholder:text-[var(--cc-tertiary)] focus:border-[var(--cc-accent)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--cc-accent)_14%,transparent)] sm:text-sm";

export const textareaClass = `${inputClass} min-h-28 resize-y`;
export const selectClass = inputClass;

export const primaryButtonClass =
  "inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--cc-accent)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--cc-accent-strong)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color-mix(in_srgb,var(--cc-accent)_18%,transparent)] disabled:cursor-not-allowed disabled:opacity-50";

export const secondaryButtonClass =
  "inline-flex min-h-12 items-center justify-center rounded-full border border-[var(--cc-border)] bg-[var(--cc-surface)] px-4 py-2.5 text-sm font-semibold text-[var(--cc-foreground)] shadow-sm backdrop-blur-xl transition hover:bg-[var(--cc-surface-muted)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color-mix(in_srgb,var(--cc-accent)_16%,transparent)]";
