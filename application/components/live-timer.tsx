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
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="font-mono text-4xl font-semibold tracking-tight text-slate-950">
      {formatElapsed((now - started) / 1000)}
    </div>
  );
}
