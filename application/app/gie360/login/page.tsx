import Image from "next/image";
import { GIE360LoginForm } from "@/components/gie360-login-form";
export default function GIE360LoginPage() {
  return <main className="mx-auto max-w-md px-5 py-16"><section className="rounded-2xl border border-[#C99439]/30 bg-white p-8 shadow-sm">
    <Image src="/gie360/logo.png" width={360} height={114} alt="GIE360° — Gestão Inteligente Empresarial" priority className="mb-8 h-auto w-full" />
    <h1 className="mb-3 text-2xl font-semibold text-[#073F36]">Acesso à sua empresa</h1>
    <p className="mb-8 text-sm text-slate-600">Utilize a conta associada pelo seu gestor. O acesso ao diagnóstico e aos dados é limitado à sua empresa.</p>
    <GIE360LoginForm />
  </section></main>;
}
