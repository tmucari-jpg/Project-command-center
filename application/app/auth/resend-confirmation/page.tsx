import { AuthForm } from "@/components/auth-form";

export default async function Page() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--cc-background)] px-5 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(7,63,54,0.10),transparent_30rem),radial-gradient(circle_at_86%_12%,rgba(201,148,57,0.14),transparent_24rem)]" />
      <div className="relative z-10 w-full">
        <AuthForm mode="resend-confirmation" />
      </div>
    </main>
  );
}
