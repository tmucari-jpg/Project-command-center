import Image from "next/image";
import Link from "next/link";
import { Bell } from "lucide-react";
import { InstallAppButton } from "@/components/install-app-button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { OfflineSyncManager } from "@/components/offline-sync-manager";
import { SecureLogoutButton } from "@/components/secure-logout-button";
import { MobileNav, Sidebar } from "@/components/sidebar";

export function AppShell({
  children,
  isAdmin,
  notificationCount,
}: {
  children: React.ReactNode;
  isAdmin: boolean;
  notificationCount: number;
}) {
  return (
    <div className="min-h-screen bg-[var(--cc-background)]">
      <div className="flex min-h-screen">
        <Sidebar isAdmin={isAdmin} notificationCount={notificationCount} />
        <div className="min-w-0 flex-1">
          <header className="cc-safe-top sticky top-0 z-40 border-b border-[var(--cc-border)] bg-white/94 backdrop-blur-xl">
            <div className="mx-auto w-full max-w-[var(--cc-content-max)] px-4 py-3 sm:px-8">
              <div className="flex min-h-11 items-center justify-between gap-3">
                <Link href="/dashboard" className="flex min-w-0 items-center gap-3" aria-label="Project Command Center — Início">
                  <Image src="/icons/icon-192.png" alt="PCC" width={36} height={36} className="h-9 w-9 shrink-0 rounded-[10px]" priority />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold tracking-[-0.01em] text-[var(--cc-foreground)] sm:text-sm">
                      Project Command Center
                    </p>
                    <p className="hidden text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--cc-gold)] min-[390px]:block">
                      Da estratégia à execução
                    </p>
                  </div>
                </Link>

                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href="/notifications"
                    className="relative grid h-10 w-10 place-items-center rounded-full border border-[var(--cc-border)] bg-white text-[var(--cc-accent)] transition hover:bg-[var(--cc-surface-muted)]"
                    aria-label={notificationCount > 0 ? `${notificationCount} notificações não lidas` : "Centro de Notificações"}
                  >
                    <Bell aria-hidden="true" size={18} strokeWidth={1.8} />
                    {notificationCount > 0 && (
                      <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[#c99439] px-1.5 py-0.5 text-center text-[10px] font-bold leading-4 text-white">
                        {notificationCount > 99 ? "99+" : notificationCount}
                      </span>
                    )}
                  </Link>
                  <div className="hidden sm:block"><OfflineSyncManager /></div>
                  <div className="hidden sm:block"><LanguageSwitcher compact /></div>
                  <div className="hidden sm:block"><InstallAppButton /></div>
                  {process.env.NODE_ENV !== "development" && <SecureLogoutButton />}
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between gap-3 border-t border-[var(--cc-border)]/70 pt-2 sm:hidden">
                <LanguageSwitcher compact />
                <InstallAppButton compact />
              </div>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[var(--cc-content-max)] px-4 py-6 pb-28 sm:px-8 sm:py-9 sm:pb-28 lg:pb-10">
            {children}
          </main>

          <div className="fixed inset-x-0 bottom-0 z-50 lg:hidden">
            <MobileNav notificationCount={notificationCount} />
          </div>
        </div>
      </div>
    </div>
  );
}
