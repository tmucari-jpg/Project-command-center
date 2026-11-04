import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "GIE360° — Área do Cliente",
  applicationName: "GIE360°",
  description: "Gestão Inteligente Empresarial: acesso reservado à empresa.",
  manifest: "/gie360.webmanifest",
  icons: { icon: [{ url: "/gie360-icon.svg", type: "image/svg+xml" }] },
  appleWebApp: { capable: true, title: "GIE360°", statusBarStyle: "default" },
};

export default async function Gie360ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f8f6f0] text-[#17322d]">
      <header className="border-b border-[#d0ded6] bg-[#073f36] px-5 py-5 text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/gie-client" className="text-xl font-bold">GIE360°</Link>
          <span className="text-xs text-[#f6dca7]">Acompanhamento de projectos</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-8">{children}</main>
      <footer className="mx-auto max-w-5xl px-5 pb-8 text-xs text-[#63716c]">GIE360° · Acompanhamento do seu projecto</footer>
    </div>
  );
}
