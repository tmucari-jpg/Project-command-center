import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function GieClientHome() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const { data: memberships, error } = await supabase
    .from("gie360_memberships").select("organization_id")
    .eq("client_user_id", user.id);
  if (error) return <p role="alert">Não foi possível verificar as organizações autorizadas.</p>;
  const organizationIds = (memberships ?? []).map((membership) => membership.organization_id);
  if (!organizationIds.length) return <p>Não existe uma empresa GIE360° associada a esta conta.</p>;
  const { data: organizations, error: orgError } = await supabase
    .from("gie360_organizations")
    .select("id,name,approved_modules,contract_approved,package_code,ai_cloud_authorized")
    .in("id", organizationIds)
    .order("created_at", { ascending: false });
  if (orgError) return <p role="alert">Não foi possível carregar as empresas autorizadas.</p>;
  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-bold">As suas empresas</h1>
        <p className="mt-1 text-sm text-[#63716c]">Apenas os módulos e avaliações autorizados para a sua organização.</p></div>
      {(organizations ?? []).map((org) => (
        <section key={org.id} className="rounded-2xl border border-[#d0ded6] bg-white p-5">
          <h2 className="text-lg font-bold">{org.name}</h2>
          <p className="mt-2 text-sm">{org.contract_approved ? "Contrato aprovado" : "Contrato por aprovar"} · {org.package_code ?? "Pacote por definir"}</p>
          <p className="mt-2 text-xs text-[#63716c]">Módulos: {org.approved_modules?.length ? org.approved_modules.join(", ") : "Aguardam aprovação"}</p>
          <Link className="mt-4 inline-flex rounded-lg bg-[#073f36] px-4 py-2 text-sm font-semibold text-white" href={`/gie-client/${org.id}`}>Abrir GIE360°</Link>
        </section>
      ))}
    </div>
  );
}
