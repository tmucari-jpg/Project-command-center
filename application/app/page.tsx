import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  let authenticated = false;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    authenticated = Boolean(user);
  } catch {
    // The landing page remains renderable before environment variables are configured.
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-20">
        <div className="max-w-3xl">
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.22em] text-blue-300">
            Project Command Center
          </p>
          <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">
            Transforme objectivos em execução mensurável.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            Um centro de execução para responder sempre a três perguntas: o que quero
            alcançar, o que estou a fazer agora e que evidência prova que avancei.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              className="rounded-xl bg-white px-5 py-3 font-medium text-slate-950 transition hover:bg-slate-100"
              href={authenticated ? "/dashboard" : "/auth/sign-up"}
            >
              {authenticated ? "Abrir dashboard" : "Começar"}
            </Link>
            {!authenticated && (
              <Link
                className="rounded-xl border border-slate-700 px-5 py-3 font-medium text-white transition hover:bg-slate-900"
                href="/auth/login"
              >
                Entrar
              </Link>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
