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
          <header className="cc-safe-top sticky top-0 z-40 border-b border-[var(--cc-border)] bg-white/90 backdrop-blur-xl">
            <div className="flex min-h-16 items-center justify-between gap-4 px-5 sm:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <Image src="/icons/icon-192.png" alt="PCC" width={36} height={36} className="rounded-[10px]" priority />
                <div className="min-w-0">
                  <p className="text-sm font-semibold tracking-[-0.01em] text-[var(--cc-foreground)]">Project Command Center</p>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--cc-gold)]">Da estratégia à execução</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
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
                <OfflineSyncManager />
                <LanguageSwitcher compact />
                <InstallAppButton />
                {process.env.NODE_ENV !== "development" && <SecureLogoutButton />}
              </div>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[var(--cc-content-max)] px-5 py-7 pb-28 sm:px-8 sm:py-10 sm:pb-28 lg:pb-10">
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
