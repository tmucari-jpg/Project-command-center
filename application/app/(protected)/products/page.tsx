import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { Card, EmptyState, secondaryButtonClass } from "@/components/ui";
import { GIE360ProvisionForm, GIE360SettingsForm } from "@/components/gie360-provision-form";

export default async function ProductsPage() {
  const { supabase, user } = await requireUser();
  const [products, packages, organizations, cases] = await Promise.all([
    supabase.from("pcc_products").select("code,name,description,status,version"),
    supabase.from("pcc_product_packages").select("code,product_code,name,modules,price_mzn,commercial_status,version").eq("code","gie360-enterprise").order("code"),
    supabase.from("gie360_organizations").select("id,name,package_code,approved_modules,ai_cloud_authorized,contract_reference").eq("manager_user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("project_factory_cases").select("id,title").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
  ]);
  const [{ data: submittedAssessments }, { data: initialDiagnostics }] = await Promise.all([supabase.from("gie360_assessments").select("organization_id,status,answers").eq("status","submitted"),supabase.from("client_diagnostic_requests").select("factory_case_id,status").eq("user_id",user.id).in("status",["submitted","analyzing","completed"])]);
  const eligibleCaseIds = new Set((initialDiagnostics ?? []).map(row => row.factory_case_id));
  const submittedOrganizationIds = new Set((submittedAssessments ?? []).map(row => row.organization_id));
  const error = [products, packages, organizations, cases].some((result) => result.error);
  return <>
    <PageHeader eyebrow="Gestão empresarial" title="GIE360°" />
    {error ? <EmptyState>Não foi possível carregar as empresas GIE360°. Verifique o acesso aos dados ou contacte o administrador.</EmptyState> : <div className="space-y-6">
      <GIE360ProvisionForm cases={(cases.data ?? []).filter(item => eligibleCaseIds.has(item.id))} />
      {(organizations.data ?? []).map((organization) => <div key={organization.id} className="space-y-3">
        {submittedOrganizationIds.has(organization.id) ? <GIE360SettingsForm organization={organization} packages={packages.data ?? []} assessmentAnswers={(submittedAssessments ?? []).find(item => item.organization_id === organization.id)?.answers ?? {}} /> : <Card className="p-5"><h3 className="font-semibold text-[#073f36]">{organization.name} · Diagnóstico GIE360° pendente</h3><p className="mt-2 text-sm text-slate-600">O segundo diagnóstico deve ser preenchido no portal GIE360°. A confirmação do âmbito só fica disponível após a submissão das respostas. Nenhum módulo é considerado validado automaticamente.</p></Card>}
        <div className="flex flex-wrap gap-3"><Link href={`/gie360?organization=${organization.id}`} className={secondaryButtonClass}>Abrir área de {organization.name}</Link><Link href={`/gie360/imports?organization=${organization.id}`} className={secondaryButtonClass}>Rever dados importados</Link></div>
      </div>)}
      {!organizations.data?.length && <EmptyState>Ainda não há empresas GIE360° associadas à sua conta. Conclua primeiro o diagnóstico inicial em Novo projecto para disponibilizar o caso nesta associação.</EmptyState>}
    </div>}
  </>;
}
