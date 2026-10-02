import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/auth/actions";
import { InstallAppButton } from "@/components/install-app-button";
import { MobileNav, Sidebar } from "@/components/sidebar";

export function AppShell({ children, email }: { children: React.ReactNode; email?: string | null }) {
  return (
    <div className="min-h-screen bg-[var(--cc-background)]">
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="min-w-0 flex-1">
          <header className="cc-safe-top sticky top-0 z-40 border-b border-[var(--cc-border)] bg-[var(--cc-glass)] backdrop-blur-2xl">
            <div className="flex min-h-16 items-center justify-between gap-4 px-5 sm:px-8">
              <div className="min-w-0">
                <p className="text-xs font-medium text-[var(--cc-tertiary)]">Centro de execução</p>
                <p className="truncate text-sm font-semibold tracking-[-0.01em] text-[var(--cc-foreground)]">{email}</p>
              </div>
              <div className="flex items-center gap-2">
                <InstallAppButton />
                <form action={logoutAction}>
                  <button
                    type="submit"
                    aria-label="Terminar sessão"
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--cc-border)] bg-[var(--cc-surface)] px-3.5 py-2 text-sm font-semibold text-[var(--cc-foreground)] shadow-sm backdrop-blur-xl transition hover:bg-[var(--cc-surface-muted)]"
                  >
                    <LogOut aria-hidden="true" size={16} />
                    <span className="hidden sm:inline">Sair</span>
                  </button>
                </form>
              </div>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[var(--cc-content-max)] px-5 py-7 pb-28 sm:px-8 sm:py-10 sm:pb-28 lg:pb-10">
            {children}
          </main>

          <div className="fixed inset-x-0 bottom-0 z-50 lg:hidden">
            <MobileNav />
          </div>
        </div>
      </div>
    </div>
  );
}
