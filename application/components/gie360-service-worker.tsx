"use client";
import { useEffect } from "react";

export function GIE360ServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/gie360/sw.js", { scope: "/gie360/" }).catch(() => undefined);
    }
  }, []);
  return null;
}
