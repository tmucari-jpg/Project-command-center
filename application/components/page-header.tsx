export function PageHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--cc-gold)]">
            {eyebrow}
          </p>
        )}
        <h1 className="text-[28px] font-semibold leading-[1.15] tracking-[-0.025em] text-[var(--cc-accent)]">
          {title}
        </h1>
        {/* O Guia/Ajuda concentra instruções. Cabeçalhos mantêm apenas contexto essencial. */}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
