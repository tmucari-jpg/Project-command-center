import Image from "next/image";
import Link from "next/link";
import { requireGIE360User } from "@/lib/gie360-auth";
export default async function GIE360PortalLayout({ children }: { children: React.ReactNode }) {
  await requireGIE360User();
  return <><header className="border-b border-[#C99439]/30 bg-white"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5 px-5 py-4"><Link href="/gie360" aria-label="Início GIE360°"><Image src="/gie360/logo.png" width={260} height={83} alt="GIE360° — Gestão Inteligente Empresarial" priority className="h-auto w-48 sm:w-64" /></Link><nav aria-label="Navegação GIE360°" className="flex gap-5 text-sm font-medium"><Link href="/gie360" className="underline-offset-4 hover:underline">Diagnóstico</Link><Link href="/gie360/imports" className="underline-offset-4 hover:underline">Dados e validação</Link></nav></div></header><div className="mx-auto max-w-6xl px-5 py-6">{children}</div></>;
}
