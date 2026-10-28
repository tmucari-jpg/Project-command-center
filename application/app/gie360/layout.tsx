import type { Metadata } from "next";
import { GIE360ServiceWorker } from "@/components/gie360-service-worker";

export const metadata: Metadata = {
  title: { default: "GIE360°", template: "%s · GIE360°" },
  applicationName: "GIE360°",
  description: "Gestão Inteligente Empresarial: diagnóstico, dados e decisões com evidência.",
  manifest: "/gie360/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "GIE360°" },
  icons: {
    icon: [{ url: "/gie360/icon-192.png", sizes: "192x192", type: "image/png" }, { url: "/gie360/icon-512.png", sizes: "512x512", type: "image/png" }],
    apple: [{ url: "/gie360/apple-touch-icon.png", type: "image/png" }],
  },
  robots: { index: false, follow: false },
};

export default function GIE360Layout({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: "100vh", background: "#F8F6F0", color: "#073F36" }}>{children}<GIE360ServiceWorker /></div>;
}
