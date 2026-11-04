import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function GieClientOrganization({params}: {params: Promise<{id:string}>}) {
  const {id} = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const {data: membership, error: memberError} = await supabase.from("gie360_memberships")
    .select("organization_id").eq("client_user_id", user.id).eq("organization_id", id).maybeSingle();
  if (memberError || !membership) notFound();
  const {data: organization, error: orgError} = await supabase.from("gie360_organizations")
    .select("id,name,contract_approved,package_code,approved_modules,ai_cloud_authorized")
    .eq("id",id).maybeSingle();
  if (orgError || !organization) notFound();
  const {data: assessments, error: assessmentError} = await supabase.from("gie360_assessments")
    .select("id,status,questionnaire_version,revision,submitted_at")
    .eq("organization_id",id).order("updated_at",{ascending:false});
  return (
    <div className="space-y-5">
      <Link href="/gie-client" className="text-sm underline">Empresas</Link>
      <h1 className="text-2xl font-bold">{organization.name}</h1>
      <section className="rounded-2xl border border-[#d0ded6] bg-white p-5">
        <h2 className="font-semibold">Âmbito contratado</h2>
        <p className="mt-2 text-sm">{organization.contract_approved ? "Contrato aprovado" : "Contrato por aprovar"} · {organization.package_code ?? "Por definir"}</p>
        <p className="mt-2 text-sm">Módulos autorizados: {organization.approved_modules?.length ? organization.approved_modules.join(", ") : "Nenhum aprovado"}</p>
        <p className="mt-2 text-sm">IA na nuvem: {organization.ai_cloud_authorized ? "Autorizada" : "Não autorizada"}</p>
      </section>
      <section className="rounded-2xl border border-[#d0ded6] bg-white p-5">
        <h2 className="font-semibold">Avaliações empresariais</h2>
        {assessmentError ? <p role="alert">Não foi possível carregar avaliações.</p> :
          assessments?.length ? (
            <div className="mt-3 space-y-3">
              {assessments.map(a=><div key={a.id} className="rounded-lg border border-[#d0ded6] p-3 text-sm">
                <p className="font-semibold">{a.status === "submitted" ? "Avaliação submetida" : "Avaliação em preparação"}</p>
                <p className="text-[#63716c]">Versão {a.questionnaire_version} · Revisão {a.revision}</p>
              </div>)}
            </div>
          ) : <p className="mt-3 text-sm text-[#63716c]">Nenhuma avaliação disponível.</p>}
      </section>
      <p className="text-xs text-[#63716c]">As decisões de âmbito e as acções com custos exigem autorização. Os dados do PCC administrativo não são acessíveis neste portal.</p>
    </div>
  );
}
