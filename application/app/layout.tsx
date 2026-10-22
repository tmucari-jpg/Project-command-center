import type { Metadata, Viewport } from "next";
import { RegisterServiceWorker } from "@/components/register-service-worker";
import { LanguageProvider } from "@/components/language-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Project Command Center", template: "%s · Project Command Center" },
  description: "Centro de execução de projectos com foco em resultados, evidência e próxima acção.",
  applicationName: "Project Command Center",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Project Command Center" },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#073f36",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-MZ" suppressHydrationWarning>
      <body>
        <LanguageProvider>
          {children}
          <RegisterServiceWorker />
        </LanguageProvider>
      </body>
    </html>
  );
}
