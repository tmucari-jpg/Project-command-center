import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Gie360Assistant } from "@/components/gie360-assistant";

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
  const {data: projects, error: projectError} = await supabase.from("gie360_projects")
    .select("id,title,status,created_at,diagnostic_summary")
    .eq("organization_id",id).order("created_at",{ascending:false});
  const {data: workItems, error: workError} = await supabase.from("gie360_work_items")
    .select("id,project_id,module_code,title,completion_criterion,status,evidence_reference")
    .eq("organization_id",id).order("created_at",{ascending:false});
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
        <h2 className="font-semibold">Projectos da empresa</h2>
        {projectError ? <p role="alert">Não foi possível carregar os projectos.</p> :
          projects?.length ? <div className="mt-3 space-y-3">
            {projects.map(project => <div key={project.id} className="rounded-lg border border-[#d0ded6] p-3">
              <h3 className="font-semibold">{project.title}</h3>
              <p className="mt-1 text-sm text-[#63716c]">{project.status === "awaiting_scope" ? "Âmbito por aprovar" : project.status}</p>
              <div className="mt-3 text-sm text-[#63716c]">
                <p className="font-semibold">Informação do diagnóstico de origem — declarada, por validar</p>
                {Object.entries(project.diagnostic_summary ?? {}).filter(([key]) =>
                  ["context","focus","desired_result","conditions","deadline_urgency","success_criteria"].includes(key),
                ).map(([key,value])=><p key={key} className="mt-1"><strong>{key.replaceAll("_"," ")}:</strong> {String(value ?? "Por confirmar")}</p>)}
              </div>
            </div>)}
          </div> : <p className="mt-3 text-sm text-[#63716c]">Nenhum projecto transferido para esta empresa.</p>}
      </section>
      <section className="rounded-2xl border border-[#d0ded6] bg-white p-5">
        <h2 className="font-semibold">Execução e evidências GIE360°</h2>
        <p className="mt-1 text-sm text-[#63716c]">Acompanhamento dos trabalhos aprovados, sem acesso administrativo ao PCC.</p>
        {workError ? <p role="alert" className="mt-3 text-sm text-red-700">Não foi possível carregar os trabalhos.</p> :
          workItems?.length ? (
            <div className="mt-3 space-y-3">
              {workItems.map(work => (
                <div key={work.id} className="rounded-lg border border-[#d0ded6] p-3 text-sm">
                  <p className="font-semibold">{work.title}</p>
                  <p className="mt-1 text-[#63716c]">Módulo {work.module_code} · Estado: {work.status}</p>
                  <p className="mt-1">Critério de conclusão: {work.completion_criterion}</p>
                  {work.evidence_reference && <p className="mt-1 text-[#63716c]">Referência de evidência: {work.evidence_reference}</p>}
                </div>
              ))}
            </div>
          ) : <p className="mt-3 text-sm text-[#63716c]">Ainda não existem tarefas de execução registadas.</p>}
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
      {organization.contract_approved && organization.ai_cloud_authorized &&
        organization.approved_modules.includes("ai") && (
          <Gie360Assistant organizationId={organization.id} clientMode />
        )}
      <p className="text-xs text-[#63716c]">As decisões de âmbito e as acções com custos exigem autorização. Os dados do PCC administrativo não são acessíveis neste portal.</p>
    </div>
  );
}
