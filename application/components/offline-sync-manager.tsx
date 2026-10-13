"use client";

import { useEffect, useState } from "react";
import { getOfflineQueue, refreshOfflineSnapshot, syncOfflineQueue } from "@/lib/offline-client";

export function OfflineSyncManager() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let active = true;

    async function updatePending() {
      const items = await getOfflineQueue().catch(() => []);
      if (active) setPending(items.length);
    }

    async function synchronize() {
      if (!navigator.onLine) {
        if (active) setOnline(false);
        await updatePending();
        return;
      }
      if (active) {
        setOnline(true);
        setSyncing(true);
      }
      await refreshOfflineSnapshot().catch(() => false);
      await syncOfflineQueue().catch(() => ({ synced: 0, pending: 0 }));
      await updatePending();
      if (active) setSyncing(false);
    }

    void synchronize();

    const onOnline = () => void synchronize();
    const onOffline = () => {
      setOnline(false);
      void updatePending();
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const interval = window.setInterval(() => {
      if (navigator.onLine) void synchronize();
      else void updatePending();
    }, 60_000);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  if (online && pending === 0 && !syncing) return null;

  return (
    <span className="hidden rounded-full border border-[var(--cc-border)] bg-[var(--cc-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--cc-secondary)] sm:inline-flex">
      {!online ? `Offline · ${pending} por sincronizar` : syncing ? "A sincronizar…" : `${pending} por sincronizar`}
    </span>
  );
}
