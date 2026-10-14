import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--cc-background)] px-5">
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--cc-gold)]">404</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--cc-foreground)]">
          Página não encontrada
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--cc-secondary)]">
          O endereço não corresponde a uma área disponível do Project Command Center.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white"
        >
          Voltar ao dashboard
        </Link>
      </div>
    </main>
  );
}
