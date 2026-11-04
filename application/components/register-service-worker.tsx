"use client";

import { useEffect } from "react";

export function RegisterServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      // The enterprise portal has its own scoped worker. Never register the
      // PCC offline worker for a GIE-only client session.
      const gieClient = window.location.pathname.startsWith("/gie-client");
      navigator.serviceWorker.register(
        gieClient ? "/gie360-sw.js" : "/sw.js",
        gieClient ? { scope: "/gie-client/" } : undefined,
      ).catch(() => {
        // The web app continues to work normally if registration is unavailable.
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
