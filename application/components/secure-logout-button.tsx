"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/auth/actions";
import { clearOfflineData } from "@/lib/offline-client";

export function SecureLogoutButton() {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      aria-label="Terminar sessão"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await clearOfflineData();
          await logoutAction();
        })
      }
      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--cc-border)] bg-[var(--cc-surface)] px-3.5 py-2 text-sm font-semibold text-[var(--cc-foreground)] shadow-sm backdrop-blur-xl transition hover:bg-[var(--cc-surface-muted)] disabled:cursor-wait disabled:opacity-60"
    >
      <LogOut aria-hidden="true" size={16} />
      <span className="hidden sm:inline">{pending ? "A sair…" : "Sair"}</span>
    </button>
  );
}
