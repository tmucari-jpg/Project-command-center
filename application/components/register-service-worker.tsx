"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function RegisterServiceWorker() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname === "/gie360" || pathname.startsWith("/gie360/")) return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // The web app continues to work normally if registration is unavailable.
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => window.removeEventListener("load", register);
  }, [pathname]);

  return null;
}
