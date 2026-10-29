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
  const [{ data: submittedAssessments }, { data: initialDiagnostics }] = await Promise.all([supabase.from("gie360_assessments").select("organization_id,status").eq("status","submitted"),supabase.from("client_diagnostic_requests").select("factory_case_id,status").eq("user_id",user.id).in("status",["submitted","analyzing","completed"])]);
  const eligibleCaseIds = new Set((initialDiagnostics ?? []).map(row => row.factory_case_id));
  const submittedOrganizationIds = new Set((submittedAssessments ?? []).map(row => row.organization_id));
  const error = [products, packages, organizations, cases].some((result) => result.error);
  return <>
    <PageHeader eyebrow="Gestão empresarial" title="GIE360°" />
    {error ? <EmptyState>Não foi possível carregar as empresas GIE360°. Verifique o acesso aos dados ou contacte o administrador.</EmptyState> : <div className="space-y-6">
      <Card className="p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#146453]">Percurso GIE360°</p>
        <h2 className="mt-2 text-lg font-semibold text-[#073f36]">Da associação ao acompanhamento da empresa</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {[
            ["1", "Associar empresa", "Escolher o diagnóstico existente e a conta confirmada do cliente."],
            ["2", "Diagnóstico GIE360°", "Enviar e receber o segundo diagnóstico empresarial, ligado à empresa associada."],
            ["3", "Validar e confirmar âmbito", "Rever as respostas do diagnóstico GIE360° e aprovar os módulos seleccionados."],
            ["4", "Operação GIE360°", "Recolher dados, produzir resultados e validar os materiais antes da partilha."],
          ].map(([number, title, description]) => <div key={number} className="rounded-xl border border-[#d8e2dc] bg-[#f8f6f0] p-4"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#073f36] text-sm font-semibold text-white">{number}</span><h3 className="mt-3 font-semibold">{title}</h3><p className="mt-2 text-sm text-slate-600">{description}</p></div>)}
        </div>
        <p className="mt-4 text-xs text-slate-600">Após a associação, o cliente pode prosseguir no portal GIE360°. Aprovações e validação de dados continuam necessárias; não são marcadas como concluídas automaticamente.</p>
      </Card>
      <GIE360ProvisionForm cases={(cases.data ?? []).filter(item => eligibleCaseIds.has(item.id))} />
      {(organizations.data ?? []).map((organization) => <div key={organization.id} className="space-y-3">
        {submittedOrganizationIds.has(organization.id) ? <GIE360SettingsForm organization={organization} packages={packages.data ?? []} /> : <Card className="p-5"><h3 className="font-semibold text-[#073f36]">{organization.name} · Diagnóstico GIE360° pendente</h3><p className="mt-2 text-sm text-slate-600">O segundo diagnóstico deve ser preenchido no portal GIE360°. A confirmação do âmbito só fica disponível após a submissão das respostas. Nenhum módulo é considerado validado automaticamente.</p></Card>}
        <div className="flex flex-wrap gap-3"><Link href={`/gie360?organization=${organization.id}`} className={secondaryButtonClass}>Abrir área de {organization.name}</Link><Link href={`/gie360/imports?organization=${organization.id}`} className={secondaryButtonClass}>Rever dados importados</Link></div>
      </div>)}
      {!organizations.data?.length && <EmptyState>Ainda não há empresas GIE360° associadas à sua conta. Conclua primeiro o diagnóstico inicial em Novo projecto para disponibilizar o caso nesta associação.</EmptyState>}
    </div>}
  </>;
}
