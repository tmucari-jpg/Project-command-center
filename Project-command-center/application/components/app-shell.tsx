import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/auth/actions";
import { MobileNav, Sidebar } from "@/components/sidebar";

export function AppShell({
  children,
  email,
}: {
  children: React.ReactNode;
  email?: string | null;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="min-w-0 flex-1">
          <header className="border-b border-slate-200 bg-white">
            <div className="flex min-h-16 items-center justify-between gap-4 px-5 sm:px-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Centro de execução
                </p>
                <p className="truncate text-sm font-medium text-slate-700">{email}</p>
              </div>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <LogOut size={16} />
                  Sair
                </button>
              </form>
            </div>
            <MobileNav />
          </header>
          <main className="mx-auto max-w-7xl px-5 py-7 sm:px-8 sm:py-9">{children}</main>
        </div>
      </div>
    </div>
  );
}
