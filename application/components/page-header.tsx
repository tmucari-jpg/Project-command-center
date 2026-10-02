export function PageHeader({
  eyebrow,
  title,
  description,
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
          <p className="mb-2 text-xs font-semibold tracking-[0.01em] text-[var(--cc-accent)]">
            {eyebrow}
          </p>
        )}
        <h1 className="text-[2rem] font-semibold leading-[1.08] tracking-[-0.035em] text-[var(--cc-foreground)] sm:text-[2.4rem]">
          {title}
        </h1>
        {description && (
          <p className="mt-3 max-w-3xl text-[15px] leading-6 text-[var(--cc-secondary)]">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
