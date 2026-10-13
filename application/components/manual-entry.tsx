export function ManualEntry({ children }: { children: React.ReactNode }) {
  return (
    <details data-manual-entry="true" className="group rounded-[var(--cc-radius-lg)] border border-[var(--cc-border)] bg-[var(--cc-surface)] shadow-[var(--cc-shadow-sm)]">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-[var(--cc-foreground)]">
        <span>Rever / editar campos</span>
        <span className="text-xs font-medium text-[var(--cc-secondary)] group-open:hidden">Ver</span>
        <span className="hidden text-xs font-medium text-[var(--cc-secondary)] group-open:inline">Ocultar</span>
      </summary>
      <div className="border-t border-[var(--cc-border)] p-5">
        {children}
      </div>
    </details>
  );
}
