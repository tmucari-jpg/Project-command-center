"use client";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-600">
        Erro
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
        Não foi possível carregar esta área.
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
        {process.env.NODE_ENV === "development"
          ? error.message
          : "Tente novamente. Se o problema persistir, verifique a ligação ao Supabase e os logs da aplicação."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-5 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
      >
        Tentar novamente
      </button>
    </div>
  );
}
