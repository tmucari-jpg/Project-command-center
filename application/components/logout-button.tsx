"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/auth/actions";
import { clearOfflineData, getOfflineQueue } from "@/lib/offline-client";

export function LogoutButton() {
  const [leaving, setLeaving] = useState(false);

  async function leave() {
    if (leaving) return;
    const pending = await getOfflineQueue().catch(() => []);
    if (pending.length > 0) {
      const confirmed = window.confirm(
        `Existem ${pending.length} alteração(ões) ainda por sincronizar. Se terminar sessão agora, os dados locais serão removidos. Deseja continuar?`,
      );
      if (!confirmed) return;
    }

    setLeaving(true);
    await clearOfflineData();
    await logoutAction();
  }

  return (
    <button
      type="button"
      aria-label="Terminar sessão"
      disabled={leaving}
      onClick={() => void leave()}
      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--cc-border)] bg-[var(--cc-surface)] px-3.5 py-2 text-sm font-semibold text-[var(--cc-foreground)] shadow-sm backdrop-blur-xl transition hover:bg-[var(--cc-surface-muted)] disabled:cursor-wait disabled:opacity-60"
    >
      <LogOut aria-hidden="true" size={16} />
      <span className="hidden sm:inline">{leaving ? "A sair…" : "Sair"}</span>
    </button>
  );
}
