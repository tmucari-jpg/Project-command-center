import { AuthForm } from "@/components/auth-form";

export default async function Page({ searchParams }: { searchParams: Promise<{ logged_out?: string; error?: string }> }) {
  const query = await searchParams;
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--cc-background)] px-5 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(7,63,54,0.10),transparent_30rem),radial-gradient(circle_at_86%_12%,rgba(201,148,57,0.14),transparent_24rem)]" />
      <div className="pointer-events-none absolute -bottom-24 -left-20 h-72 w-72 rounded-full border border-[color-mix(in_srgb,var(--cc-gold)_22%,transparent)]" />
      <div className="pointer-events-none absolute -right-28 top-20 h-80 w-80 rounded-full border border-[color-mix(in_srgb,var(--cc-accent)_10%,transparent)]" />
      <div className="relative z-10 w-full">
        {query.error === "callback" && (
          <p role="alert" className="mx-auto mb-4 max-w-md rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Não foi possível validar o link de acesso. Pode ter expirado, já ter sido utilizado ou ter sido aberto noutro navegador.
            Para recuperar o acesso, use «Esqueci a palavra-passe» e abra o novo link no mesmo navegador em que fez o pedido.
          </p>
        )}
        <AuthForm mode="login" clearOfflineOnLoad={query.logged_out === "1"} />
      </div>
    </main>
  );
}
