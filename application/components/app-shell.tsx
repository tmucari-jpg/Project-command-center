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
          <header className="border-b border-[var(--cc-border)] bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
            <div className="flex min-h-16 items-center justify-between gap-4 px-5 sm:px-8">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--cc-tertiary)]">Centro de execução</p>
                <p className="truncate text-sm font-medium text-[var(--cc-foreground)]">{email}</p>
              </div>
              <div className="flex items-center gap-2">
                <InstallAppButton />
                <form action={logoutAction}>
                  <button type="submit" className="inline-flex min-h-11 items-center gap-2 rounded-[12px] border border-[var(--cc-border)] px-3 py-2 text-sm font-medium text-[var(--cc-foreground)] transition hover:bg-[var(--cc-surface-muted)]">
                    <LogOut size={16} /><span className="hidden sm:inline">Sair</span>
                  </button>
                </form>
              </div>
            </div>
            <MobileNav />
          </header>
          <main className="mx-auto w-full max-w-[var(--cc-content-max)] px-5 py-7 sm:px-8 sm:py-9">{children}</main>
        </div>
      </div>
    </div>
  );
}
