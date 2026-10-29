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
            ["2", "Confirmar âmbito", "Seleccionar os módulos e registar as autorizações necessárias."],
            ["3", "Diagnóstico autónomo", "O cliente responde ao questionário e fornece os dados disponíveis."],
            ["4", "Resultados e evidências", "Importar, rever e disponibilizar ficheiros reais conforme a validação."],
          ].map(([number, title, description]) => <div key={number} className="rounded-xl border border-[#d8e2dc] bg-[#f8f6f0] p-4"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#073f36] text-sm font-semibold text-white">{number}</span><h3 className="mt-3 font-semibold">{title}</h3><p className="mt-2 text-sm text-slate-600">{description}</p></div>)}
        </div>
        <p className="mt-4 text-xs text-slate-600">Após a associação, o cliente pode prosseguir no portal GIE360°. Aprovações e validação de dados continuam necessárias; não são marcadas como concluídas automaticamente.</p>
      </Card>
      <GIE360ProvisionForm cases={cases.data ?? []} />
      {(organizations.data ?? []).map((organization) => <div key={organization.id} className="space-y-3">
        <GIE360SettingsForm organization={organization} packages={packages.data ?? []} />
        <div className="flex flex-wrap gap-3"><Link href={`/gie360?organization=${organization.id}`} className={secondaryButtonClass}>Abrir área de {organization.name}</Link><Link href={`/gie360/imports?organization=${organization.id}`} className={secondaryButtonClass}>Rever dados importados</Link></div>
      </div>)}
      {!organizations.data?.length && <EmptyState>Ainda não há empresas GIE360° associadas à sua conta. Use o formulário acima com um caso existente e o email confirmado do cliente.</EmptyState>}
    </div>}
  </>;
}
