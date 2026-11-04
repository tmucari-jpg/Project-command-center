import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Card, secondaryButtonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { Gie360Assistant } from "@/components/gie360-assistant";
import { activateGie360Project, configureGie360Scope } from "../actions";

export default async function Gie360AssessmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  return (
    <>
      <PageHeader eyebrow="GIE360° / Organização" title={organization.name} />
      <p className="mb-5 text-sm text-[var(--cc-secondary)]">
        Avaliações ligadas ao diagnóstico PCC. As informações declaradas continuam sujeitas a revisão e aprovação.
      </p>
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
        <h2 className="text-lg font-semibold">Projectos GIE360°</h2>
        <p className="mt-2 text-sm text-[var(--cc-secondary)]">
          A execução especializada é gerida aqui. O caso original permanece apenas como referência de governação no PCC.
        </p>
        {projectError && <p role="alert" className="mt-3 text-sm text-red-700">Não foi possível consultar os projectos GIE360°.</p>}
        {!projectError && !operationalProjects?.length &&
          <p className="mt-3 text-sm text-[var(--cc-secondary)]">Nenhum projecto transferido. A decisão de encaminhamento deve ser aprovada no PCC.</p>}
        <div className="mt-4 space-y-3">
          {(operationalProjects ?? []).map((item) => (
            <div key={item.id} className="rounded-lg border border-[var(--cc-border)] p-4">
              <p className="font-semibold">{item.title}</p>
              <p className="mt-1 text-sm text-[var(--cc-secondary)]">
                {item.status === "awaiting_scope" ? "Aguarda âmbito e contrato aprovados" : item.status === "active" ? "Em execução" : item.status}
              </p>
              <p className="mt-2 text-xs text-[var(--cc-secondary)]">Origem: diagnóstico do PCC preservado para auditoria.</p>
              <dl className="mt-3 space-y-2 text-sm">
                {Object.entries(item.diagnostic_summary ?? {}).filter(([key]) =>
                  ["context","focus","desired_result","conditions","deadline_urgency","success_criteria"].includes(key),
                ).map(([key,value]) => (
                  <div key={key}><dt className="font-semibold">{key.replaceAll("_"," ")}</dt>
                    <dd className="whitespace-pre-wrap text-[var(--cc-secondary)]">{String(value ?? "Por confirmar")}</dd></div>
                ))}
              </dl>
              {item.status === "awaiting_scope" && (
                <form action={activateGie360Project} className="mt-4 space-y-2">
                  <input type="hidden" name="project_id" value={item.id}/>
                  <label className="flex items-center gap-2 text-sm">
                    <input name="explicitly_approved" type="checkbox" required/>
                    Confirmo contrato e âmbito aprovados para iniciar a execução
                  </label>
                  <button className="rounded-lg bg-[#073f36] px-4 py-2 text-sm font-semibold text-white" type="submit">
                    Activar execução GIE360°
                  </button>
                </form>
              )}
            </div>
          ))}
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
