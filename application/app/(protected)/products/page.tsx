import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { Card, EmptyState, secondaryButtonClass } from "@/components/ui";
import { GIE360ProvisionForm, GIE360SettingsForm } from "@/components/gie360-provision-form";

export default async function ProductsPage() {
  const { supabase, user } = await requireUser();
  const [products, packages, organizations, cases] = await Promise.all([
    supabase.from("pcc_products").select("code,name,description,status,version"),
    supabase.from("pcc_product_packages").select("code,product_code,name,modules,price_mzn,commercial_status,version").order("code"),
    supabase.from("gie360_organizations").select("id,name,package_code,approved_modules,ai_cloud_authorized,contract_reference").eq("manager_user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("project_factory_cases").select("id,title").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
  ]);
  const error = [products, packages, organizations, cases].some((result) => result.error);
  return <>
    <PageHeader eyebrow="Catálogo PCC" title="Produtos e Pacotes" />
    {error ? <EmptyState>Não foi possível carregar o catálogo ou as empresas. Verifique se as migrações GIE360° foram aplicadas no ambiente de testes antes de associar clientes.</EmptyState> : <div className="space-y-6">
      {(products.data ?? []).map((product) => <Card key={product.code} className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">{product.name}</h2><p className="mt-2 text-sm text-[var(--cc-secondary)]">{product.description} · Versão {product.version}</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs">{product.status === "proposed" ? "Proposta em validação" : product.status === "active" ? "Activo" : "Descontinuado"}</span></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">{(packages.data ?? []).filter((item) => item.product_code === product.code).map((item) => <div key={item.code} className="rounded-xl border border-[var(--cc-border)] p-4"><h3 className="font-semibold">{item.name}</h3><p className="mt-2 text-sm">{item.price_mzn == null ? "Preço por definir" : `${Number(item.price_mzn).toLocaleString("pt-MZ")} MZN`}</p><p className="mt-2 text-xs text-[var(--cc-secondary)]">{item.modules.length} módulos previstos · O pacote contratado não comprova a existência de dados nem a aprovação do âmbito.</p></div>)}</div>
      </Card>)}
      <GIE360ProvisionForm cases={cases.data ?? []} />
      {(organizations.data ?? []).map((organization) => <div key={organization.id} className="space-y-3">
        <GIE360SettingsForm organization={organization} packages={packages.data ?? []} />
        <div className="flex flex-wrap gap-3"><Link href={`/gie360?organization=${organization.id}`} className={secondaryButtonClass}>Abrir área de {organization.name}</Link><Link href={`/gie360/imports?organization=${organization.id}`} className={secondaryButtonClass}>Rever dados importados</Link></div>
      </div>)}
      {!organizations.data?.length && <EmptyState>Ainda não há empresas GIE360° associadas à sua conta. Use o formulário acima com um caso existente e o email confirmado do cliente.</EmptyState>}
    </div>}
  </>;
}
