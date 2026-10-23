"use client";

import type { MouseEvent } from "react";
import { LogOut } from "lucide-react";
import { clearOfflineData } from "@/lib/offline-client";

export function LogoutButton() {
  async function clearAndSubmit(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    await clearOfflineData().catch(() => undefined);
    event.currentTarget.form?.requestSubmit();
  }

  return (
    <button
      type="submit"
      aria-label="Terminar sessão"
      onClick={clearAndSubmit}
      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--cc-border)] bg-[var(--cc-surface)] px-3.5 py-2 text-sm font-semibold text-[var(--cc-foreground)] shadow-sm backdrop-blur-xl transition hover:bg-[var(--cc-surface-muted)]"
    >
      <LogOut aria-hidden="true" size={16} />
      <span className="hidden sm:inline">Sair</span>
    </button>
  );
}
