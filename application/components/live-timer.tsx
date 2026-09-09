"use client";

import { useEffect, useMemo, useState } from "react";

function formatElapsed(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return [hours, minutes, secs].map((value) => String(value).padStart(2, "0")).join(":");
}

export function LiveTimer({ startedAt }: { startedAt: string }) {
  const started = useMemo(() => new Date(startedAt).getTime(), [startedAt]);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const initialTick = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(initialTick);
      window.clearInterval(id);
    };
  }, []);

  return (
    <div className="font-mono text-4xl font-semibold tracking-tight text-slate-950">
      {formatElapsed(now === null ? 0 : (now - started) / 1000)}
    </div>
  );
}
