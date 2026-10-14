import Image from "next/image";
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
    <main className="relative min-h-screen overflow-hidden bg-[var(--cc-background)] text-[var(--cc-foreground)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(7,63,54,0.10),transparent_32rem),radial-gradient(circle_at_82%_16%,rgba(201,148,57,0.14),transparent_25rem)]" />
      <section className="relative mx-auto flex min-h-screen max-w-6xl items-center px-6 py-20">
        <div className="max-w-3xl">
          <Image
            src="/brand/pcc-logo.png"
            alt="Project Command Center"
            width={550}
            height={182}
            className="h-auto w-full max-w-[420px]"
            priority
          />
          <h1 className="mt-10 text-5xl font-semibold tracking-[-0.045em] sm:text-6xl">
            Transforme objectivos em execução mensurável.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--cc-secondary)]">
            Um centro de execução para saber o que pretende alcançar, o que deve acontecer agora e que evidência comprova o avanço.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              className="rounded-[14px] bg-[var(--cc-accent)] px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-[var(--cc-accent-strong)]"
              href={authenticated ? "/dashboard" : "/auth/sign-up"}
            >
              {authenticated ? "Abrir PCC" : "Começar"}
            </Link>
            {!authenticated && (
              <Link
                className="rounded-[14px] border border-[var(--cc-border)] bg-white/70 px-5 py-3 font-semibold text-[var(--cc-foreground)] transition hover:bg-white"
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
