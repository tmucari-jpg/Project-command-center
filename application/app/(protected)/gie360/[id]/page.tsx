import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Card, secondaryButtonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { Gie360Assistant } from "@/components/gie360-assistant";

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
    .select("id,name,company_profile,contract_approved,approved_modules,ai_cloud_authorized")
    .eq("id", id)
    .eq("manager_user_id", user.id)
    .maybeSingle();
  if (organizationError || !organization) notFound();

  const { data: assessments, error } = await supabase
    .from("gie360_assessments")
    .select("id,factory_case_id,questionnaire_version,status,answers,revision,submitted_at")
    .eq("organization_id", organization.id)
    .order("updated_at", { ascending: false });

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
