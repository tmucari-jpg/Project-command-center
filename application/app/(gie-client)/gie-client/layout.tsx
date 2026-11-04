import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "GIE360° — Área do Cliente",
  description: "Gestão Inteligente Empresarial: acesso reservado à empresa.",
};

export default async function Gie360ClientLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/auth/login");
  const { data: memberships, error: membershipError } = await supabase
    .from("gie360_memberships").select("organization_id")
    .eq("client_user_id", user.id).limit(1);
  if (membershipError || !memberships?.length) redirect("/auth/login");
  return (
    <div className="min-h-screen bg-[#f8f6f0] text-[#17322d]">
      <header className="border-b border-[#d0ded6] bg-[#073f36] px-5 py-5 text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/gie-client" className="text-xl font-bold">GIE360°</Link>
          <span className="text-xs text-[#f6dca7]">Área reservada à empresa</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-8">{children}</main>
      <footer className="mx-auto max-w-5xl px-5 pb-8 text-xs text-[#63716c]">GIE360° · Acesso segregado do PCC</footer>
    </div>
  );
}
