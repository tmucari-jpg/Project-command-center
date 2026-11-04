import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Card, primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { Gie360Assistant } from "@/components/gie360-assistant";
import { configureGie360Scope } from "../actions";

export default async function Gie360AssessmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ project?: string; scope?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const { supabase, user } = await requireUser();

  const { data: organization, error: organizationError } = await supabase
    .from("gie360_organizations")
    .select("id,name,company_profile,contract_approved,approved_modules,ai_cloud_authorized,package_code,contract_reference")
    .eq("id", id)
    .eq("manager_user_id", user.id)
    .maybeSingle();
  if (organizationError || !organization) notFound();

  const { data: assessments, error } = await supabase
    .from("gie360_assessments")
    .select("id,factory_case_id,questionnaire_version,status,answers,revision,submitted_at")
    .eq("organization_id", organization.id)
    .order("updated_at", { ascending: false });

  const { data: operationalProjects, error: projectError } = await supabase
    .from("gie360_projects")
    .select("id,title,status,created_at,factory_case_id,diagnostic_summary")
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: false });

  const { data: packages, error: packageError } = await supabase
    .from("pcc_product_packages")
    .select("code,modules")
    .eq("product_code", "gie360")
    .order("code", { ascending: true });
  const modulesAvailable = Array.from(new Set((packages ?? []).flatMap((item) => item.modules ?? []))).sort();
  const returnProject = (operationalProjects ?? []).find(project => project.id === query.project);

  return (
    <>
      <PageHeader eyebrow="GIE360° / Organização" title={organization.name} />
      <p className="mb-5 text-sm text-[var(--cc-secondary)]">
        Avaliações ligadas ao diagnóstico PCC. As informações declaradas continuam sujeitas a revisão e aprovação.
      </p>
      {query.error && <p role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{query.error}</p>}
      {query.scope==="approved" && <p role="status" className="mb-4 text-sm">Âmbito aprovado. Abra o projecto para continuar a activação.</p>}
      {returnProject && <Link className={secondaryButtonClass+" mb-4 inline-flex"} href={`/gie360/project/${returnProject.id}`}>Voltar ao projecto {returnProject.title}</Link>}
      <Card className="p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Situação da organização</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="text-[var(--cc-secondary)]">Contrato</dt><dd className="font-medium">{organization.contract_approved ? "Aprovado" : "Por aprovar"}</dd></div>
          <div><dt className="text-[var(--cc-secondary)]">IA na nuvem</dt><dd className="font-medium">{organization.ai_cloud_authorized ? "Autorizada" : "Não autorizada"}</dd></div>
          <div className="sm:col-span-2"><dt className="text-[var(--cc-secondary)]">Módulos aprovados</dt>
            <dd className="font-medium">{(organization.approved_modules ?? []).length ? organization.approved_modules.join(", ") : "Ainda não definidos"}</dd>
          </div>
        </dl>
      </Card>
      <Card className="mt-5 p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Aprovar âmbito e módulos GIE360°</h2>
        <p className="mt-2 text-sm text-[var(--cc-secondary)]">
          A escolha confirma um contrato real e define os módulos autorizados; o sistema valida o pacote antes de permitir o uso da IA. Nenhum preço ou contrato é inventado.
        </p>
        {packageError ? <p role="alert" className="mt-3 text-sm text-red-700">Não foi possível consultar os pacotes definidos.</p> :
          <form action={configureGie360Scope} className="mt-4 space-y-4">
            <input type="hidden" name="organization_id" value={organization.id}/>
            {returnProject && <input type="hidden" name="return_project_id" value={returnProject.id}/>}

            <label className="block text-sm font-medium">Pacote contratado
              <select name="package_code" required defaultValue={organization.package_code ?? ""} className="mt-1 block w-full rounded-lg border border-[var(--cc-border)] p-2.5">
                <option value="" disabled>Seleccione o pacote aprovado</option>
                {(packages ?? []).map(item=><option key={item.code} value={item.code}>{item.code}</option>)}
              </select>
            </label>
            <fieldset className="grid gap-2 sm:grid-cols-2">
              <legend className="mb-2 text-sm font-semibold">Módulos expressamente autorizados</legend>
              {modulesAvailable.map(module=><label key={module} className="flex gap-2 text-sm">
                <input type="checkbox" name="approved_modules" value={module} defaultChecked={organization.approved_modules.includes(module)}/>
                {module}
              </label>)}
            </fieldset>
            <label className="block text-sm font-medium">Referência de contrato assinado
              <input name="contract_reference" required minLength={3} maxLength={500} defaultValue={organization.contract_reference ?? ""}
                className="mt-1 block w-full rounded-lg border border-[var(--cc-border)] p-2.5" />
            </label>
            <label className="flex gap-2 text-sm"><input type="checkbox" name="ai_cloud_authorized" defaultChecked={organization.ai_cloud_authorized}/>
              Autorizar expressamente tratamento IA na nuvem, apenas no âmbito contratado
            </label>
            <label className="flex gap-2 text-sm font-semibold"><input type="checkbox" name="explicitly_approved" required />
              Confirmo que contrato, pacote e módulos foram aprovados pelo gestor
            </label>
            <button type="submit" className="rounded-lg bg-[#073f36] px-4 py-2 text-sm font-semibold text-white">Guardar âmbito aprovado</button>
          </form>}
      </Card>
      <Card className="mt-5 p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Projectos da organização</h2>
        <p className="mt-2 text-sm text-[var(--cc-secondary)]">
          Abra um projecto para continuar exactamente a etapa em que ficou:
          aprovação do âmbito, activação, execução ou acompanhamento do cliente.
        </p>
        {projectError && <p role="alert" className="mt-3 text-sm text-red-700">Não foi possível carregar os projectos.</p>}
        {!projectError && !operationalProjects?.length && <p className="mt-3 text-sm text-[var(--cc-secondary)]">
          Ainda não há projectos encaminhados. O encaminhamento é decidido no PCC depois de analisar o diagnóstico.
        </p>}
        <div className="mt-4 space-y-3">
          {(operationalProjects ?? []).map(item=><article key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--cc-border)] p-4">
            <div>
              <h3 className="font-semibold">{item.title}</h3>
              <p className="mt-1 text-sm text-[var(--cc-secondary)]">
                {item.status==="awaiting_scope" ? "Aguarda preparação / activação" :
                 item.status==="active" ? "Em execução" : item.status==="completed"?"Concluído":"Em pausa"}
              </p>
            </div>
            <Link className={primaryButtonClass+" inline-flex"} href={`/gie360/project/${item.id}`}>Abrir projecto e continuar</Link>
          </article>)}
        </div>
      </Card>
      <Card className="mt-5 p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Avaliações e projectos associados</h2>
        {error && <p role="alert" className="mt-3 text-sm text-red-700">Não foi possível consultar as avaliações.</p>}
        {!error && !assessments?.length && <p className="mt-3 text-sm text-[var(--cc-secondary)]">Ainda não há avaliações associadas.</p>}
        <div className="mt-4 space-y-4">
          {(assessments ?? []).map((assessment) => (
            <section key={assessment.id} className="rounded-xl border border-[var(--cc-border)] p-4">
              <p className="font-semibold">Diagnóstico empresarial — {assessment.status === "submitted" ? "Respondido" : "Em preparação"}</p>
              <p className="mt-1 text-xs text-[var(--cc-secondary)]">Versão: {assessment.questionnaire_version} · Revisão {assessment.revision}</p>
              <Link href={`/project-factory/${assessment.factory_case_id}`} className={secondaryButtonClass + " mt-3 inline-flex"}>Abrir caso PCC de origem</Link>
              {assessment.status === "submitted" && (
                <p className="mt-3 text-sm text-[var(--cc-secondary)]">O resultado submetido está disponível para a revisão de âmbito e de módulos.</p>
              )}
            </section>
          ))}
        </div>
      </Card>
      <Gie360Assistant organizationId={organization.id} />
      <Link href="/gie360" className={secondaryButtonClass + " mt-5 inline-flex"}>Voltar ao GIE360°</Link>
    </>
  );
}
