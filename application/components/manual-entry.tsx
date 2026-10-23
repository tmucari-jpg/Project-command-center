export function ManualEntry({
  children,
  defaultOpen = false,
  label = "Adicionar / definir",
}: {
  children: React.ReactNode;
  defaultOpen?: boolean;
  label?: string;
}) {
  return (
    <details
      data-manual-entry="true"
      open={defaultOpen}
      className="group rounded-[var(--cc-radius-lg)] border border-[var(--cc-border)] bg-[var(--cc-surface)] shadow-[var(--cc-shadow-sm)]"
    >
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-[var(--cc-foreground)]">
        <span>{label}</span>
        <span className="text-xs font-medium text-[var(--cc-secondary)] group-open:hidden">Ver detalhes</span>
        <span className="hidden text-xs font-medium text-[var(--cc-secondary)] group-open:inline">Ocultar detalhes</span>
      </summary>
      <div className="border-t border-[var(--cc-border)] p-5">{children}</div>
    </details>
  );
}
