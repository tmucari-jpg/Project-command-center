import Link from "next/link";
import { BriefcaseBusiness, CircleDollarSign, FileCheck2, Megaphone, PackageCheck, Target } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, EmptyState, secondaryButtonClass } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";

type JsonObject = Record<string, unknown>;
const obj = (value: unknown): JsonObject => value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
const arr = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const text = (value: unknown, fallback = "Em falta") => typeof value === "string" && value.trim() ? value : fallback;
const num = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;
const strings = (value: unknown) => arr(value).filter((item): item is string => typeof item === "string" && item.trim().length > 0);
const money = (value: unknown, prefix = "") => {
  const amount = num(value);
  return amount == null ? "Em falta" : `${prefix}${new Intl.NumberFormat("pt-MZ", { maximumFractionDigits: 0 }).format(amount)} MZN`;
};

export default async function CommercialMasterPage() {
  const { supabase, user } = await requireAdmin();
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id,title,status,progress,next_action")
    .eq("user_id", user.id)
    .eq("title", "Marketing, Vendas e Lançamento do PCC")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (projectError) return <><PageHeader eyebrow="Comercial" title="Guia Comercial PCC" /><Card className="p-5 text-sm text-[var(--cc-danger)]">{projectError.message}</Card></>;
  if (!project) return <><PageHeader eyebrow="Comercial" title="Guia Comercial PCC" /><Card className="p-5"><EmptyState>O projecto comercial do PCC ainda não está registado.</EmptyState></Card></>;

  const [
    { data: plan, error: planError },
    { data: deliverables, error: deliverablesError },
    { data: actions, error: actionsError },
    { data: metrics, error: metricsError },
    { data: costs, error: costsError },
    { data: giePackages, error: giePackagesError },
  ] = await Promise.all([
    supabase.from("project_strategy_execution_plans").select("strategy,monetization,marketing,sales,execution,measurement,missing_items,status,updated_at").eq("user_id", user.id).eq("project_id", project.id).maybeSingle(),
    supabase.from("deliverables").select("id,title,status,progress,artifact_type").eq("user_id", user.id).eq("project_id", project.id).order("created_at"),
    supabase.from("actions").select("id,title,status,priority,is_next_action").eq("user_id", user.id).eq("project_id", project.id).order("is_next_action", { ascending: false }).order("created_at"),
    supabase.from("metrics").select("id,name,unit,current_value,target_value").eq("user_id", user.id).eq("project_id", project.id).order("created_at"),
    supabase.from("financial_entries").select("id,description,amount,currency,status,evidence_reference").eq("user_id", user.id).eq("project_id", project.id).eq("entry_type", "cost").order("occurred_on", { ascending: false }),
    supabase.from("pcc_product_packages").select("code,name,modules,price_mzn,commercial_status,export_rights").eq("product_code","gie360").eq("code","gie360-enterprise").order("code"),
  ]);
  const error = planError ?? deliverablesError ?? actionsError ?? metricsError ?? costsError;

  const strategy = obj(plan?.strategy);
  const monetization = obj(plan?.monetization);
  const marketing = obj(plan?.marketing);
  const sales = obj(plan?.sales);
  const execution = obj(plan?.execution);
  const measurement = obj(plan?.measurement);
  const costModel = obj(monetization.cost_model);
  const packages = arr(monetization.packages).map(obj);
  const entryPaths = arr(strategy.entry_paths).map(obj);
  const objectiveSteps = strings(strategy.objectives);
  const deliverableBase = arr(execution.deliverables_base).map(obj);
  const missingItems = strings(plan?.missing_items);
  const openDeliverables = (deliverables ?? []).filter((item) => !["completed", "cancelled"].includes(item.status));
  const openActions = (actions ?? []).filter((item) => !["completed", "cancelled"].includes(item.status));

  return (
    <>
      <PageHeader
        eyebrow="Pré-visualização do entregável comercial"
        title="Guia Comercial do PCC"
        action={
          <div className="flex flex-wrap gap-2">
            <a className={secondaryButtonClass} href="/api/exports/commercial-master">Exportar snapshot operacional (.doc)</a>
            <Link className={secondaryButtonClass} href="/monetization">Voltar ao Comercial</Link>
          </div>
        }
      />
      {error && <Card className="mb-5 p-4 text-sm text-[var(--cc-danger)]">{error.message}</Card>}

      <Card className="mb-6 p-5">
        <p className="text-sm leading-6 text-[var(--cc-secondary)]">
          <strong className="text-[var(--cc-foreground)]">Entregável do projecto:</strong> Marketing, Vendas e Lançamento do PCC.
          Esta página apresenta a versão operacional viva. O Guia Comercial validado preserva a identidade oficial e prevalece como referência comercial; a exportação .doc é apenas um snapshot de trabalho. Os resultados finais continuam a ser arquivados através de Entregáveis.
        </p>
      </Card>

      <Card className="mb-6 border-[color-mix(in_srgb,var(--cc-gold)_50%,var(--cc-border))] bg-[color-mix(in_srgb,var(--cc-gold)_8%,var(--cc-surface))] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--cc-gold)]">Regra comercial</p>
        <h2 className="mt-2 text-xl font-semibold text-[var(--cc-accent)]">O PCC funciona como consultor de projectos.</h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--cc-foreground)]">{text(strategy.positioning)} {text(strategy.technology_role, "")}</p>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5"><p className="text-sm text-[var(--cc-secondary)]">Projecto comercial</p><p className="mt-2 text-2xl font-semibold">{project.progress ?? 0}%</p><p className="mt-2 text-xs text-[var(--cc-secondary)]">{openActions.length} acções abertas · {metrics?.length ?? 0} métricas</p></Card>
        <Card className="p-5"><p className="text-sm text-[var(--cc-secondary)]">Entregáveis em aberto</p><p className="mt-2 text-2xl font-semibold">{openDeliverables.length}</p><p className="mt-2 text-xs text-[var(--cc-secondary)]">Fecho apenas com resultado utilizável e evidência.</p></Card>
        <Card className="p-5"><p className="text-sm text-[var(--cc-secondary)]">Pacotes definidos</p><p className="mt-2 text-2xl font-semibold">{packages.length}</p><p className="mt-2 text-xs text-[var(--cc-secondary)]">Personalizado · Agregado · Integrado</p></Card>
        <Card className="p-5"><p className="text-sm text-[var(--cc-secondary)]">Custo tecnológico interno</p><p className="mt-2 text-2xl font-semibold">{money(costModel.internal_budget_mzn_month_max)}</p><p className="mt-2 text-xs text-[var(--cc-secondary)]">Envelope conservador mensal.</p></Card>
      </div>

      <Card className="mt-6 p-5">
        <h2 className="text-lg font-semibold">GIE360° — Gestão Inteligente Empresarial</h2>
        <p className="mt-2 text-sm leading-6">Oferta única GIE360° Empresarial, com identidade própria para o cliente. Cada empresa escolhe individualmente os módulos pretendidos; a selecção não altera o preço único. Inclui diagnóstico, recolha e validação documental e, conforme o âmbito aprovado, análise de dados, acompanhamento, planos de melhoria e relatórios reais para descarregar. Não constitui software de emissão de facturas nem certificação contabilística automática.</p>
        <h3 className="mt-4 font-semibold">Custo do serviço e pacotes</h3>
        {giePackagesError ? <p role="alert" className="mt-2 text-sm">Catálogo GIE360° indisponível: {giePackagesError.message}</p> :
          <div className="mt-3 grid gap-3 md:grid-cols-2">{(giePackages ?? []).map(p => <div key={p.code} className="rounded-lg border p-4"><strong>{p.name}</strong><p className="mt-1 text-sm">{"32.350 MZN · pagamento único"}</p><p className="mt-2 text-xs text-[var(--cc-secondary)]">Módulos à escolha individual, sem alteração de preço · Exportações: {(p.export_rights ?? []).join(", ") || "a definir"} · Disponibilidade efectiva sujeita a validação.</p></div>)}</div>}
        <p className="mt-4 text-sm leading-6"><strong>Composição do custo:</strong> configuração e implementação inicial, diagnóstico, tratamento e validação de dados, produção de relatórios, acompanhamento e suporte, infra-estrutura, armazenamento e eventuais consumos de IA. Preço único de 32.350 MZN pelo serviço, sem mensalidade de subscrição definida nesta oferta; consumos externos e serviços extraordinários só poderão ser cobrados separadamente quando expressamente acordados.</p>
        <p className="mt-2 text-sm leading-6"><strong>Condição comercial:</strong> o preço único é de 32.350 MZN, independentemente dos módulos seleccionados. A selecção de módulos, o âmbito, os limites de utilização e as condições contratuais são registados na proposta aprovada. Os dados não validados não geram conclusões financeiras definitivas.</p>
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold"><Target size={18}/> Objectivos do PCC</h2>
          <div className="mt-4 flex flex-wrap gap-2">{(objectiveSteps.length ? objectiveSteps : ["Avaliar","Decidir","Estruturar","Acompanhar","Comprovar valor"]).map((item,index)=><span key={item} className="rounded-full border border-[var(--cc-border)] bg-[var(--cc-surface-muted)] px-3 py-2 text-sm font-semibold text-[var(--cc-accent)]">{index+1}. {item}</span>)}</div>
          <p className="mt-4 text-sm leading-6 text-[var(--cc-secondary)]">{text(strategy.promise)}</p>
        </Card>
        <Card className="p-5">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold"><BriefcaseBusiness size={18}/> Dois pontos de entrada</h2>
          <div className="mt-4 space-y-3">{entryPaths.map((entry,index)=><div key={index} className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-4"><p className="font-semibold text-[var(--cc-accent)]">{text(entry.name)}</p><p className="mt-1 text-sm leading-6 text-[var(--cc-secondary)]">{text(entry.description)}</p></div>)}</div>
        </Card>
      </div>

      <Card className="mt-6">
        <div className="border-b border-[var(--cc-border)] p-5"><h2 className="inline-flex items-center gap-2 text-lg font-semibold"><CircleDollarSign size={18}/> Pacotes e preços</h2><p className="mt-1 text-sm text-[var(--cc-secondary)]">A diferença está na profundidade da consultoria, complexidade, acompanhamento e entregáveis — não em utilizadores da plataforma.</p></div>
        <div className="grid gap-4 p-5 lg:grid-cols-3">
          {packages.map((item,index)=>{
            const price=item.price_mzn_from!=null?money(item.price_mzn_from,"desde "):money(item.price_mzn);
            const maxProjects=num(item.max_simultaneous_projects);
            return <article key={index} className="rounded-[var(--cc-radius-lg)] border border-[color-mix(in_srgb,var(--cc-gold)_44%,var(--cc-border))] bg-[color-mix(in_srgb,var(--cc-gold)_6%,var(--cc-surface))] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[var(--cc-gold)]">{text(item.name)}</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--cc-accent)]">{price} / {text(item.period,"")}</p>
              {maxProjects!=null&&<p className="mt-1 text-xs font-semibold text-[var(--cc-secondary)]">Até {maxProjects} projectos em simultâneo</p>}
              <p className="mt-4 text-sm leading-6">{text(item.scope)}</p>
              <p className="mt-3 text-sm leading-6 text-[var(--cc-secondary)]"><strong className="text-[var(--cc-foreground)]">Benefício:</strong> {text(item.benefit)}</p>
            </article>;
          })}
        </div>
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-lg font-semibold">Custos associados · uso interno</h2>
          <p className="mt-1 text-sm text-[var(--cc-secondary)]">Base para controlo de sustentabilidade; não é preço apresentado ao cliente.</p>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4"><span>Vercel Pro</span><strong>US$ {num(costModel.vercel_pro_usd_month) ?? "—"}/mês</strong></div>
            <div className="flex justify-between gap-4"><span>Supabase Pro</span><strong>US$ {num(costModel.supabase_pro_usd_month) ?? "—"}/mês</strong></div>
            <div className="flex justify-between gap-4"><span>Brevo Starter</span><strong>US$ {num(costModel.brevo_starter_usd_month) ?? "—"}/mês</strong></div>
            <div className="flex justify-between gap-4"><span>Reserva IA</span><strong>US$ {num(costModel.ai_reserve_usd_month_min) ?? "—"}–{num(costModel.ai_reserve_usd_month_max) ?? "—"}/mês</strong></div>
            <div className="mt-3 flex justify-between gap-4 border-t border-[var(--cc-border)] pt-3"><span>Base técnica estimada</span><strong>US$ {num(costModel.technology_total_usd_month_min) ?? "—"}–{num(costModel.technology_total_usd_month_max) ?? "—"}/mês</strong></div>
            <div className="flex justify-between gap-4"><span>Envelope conservador PCC</span><strong>{money(costModel.internal_budget_mzn_month_min)}–{money(costModel.internal_budget_mzn_month_max)}/mês</strong></div>
          </div>
          <div className="mt-4 rounded-[var(--cc-radius-md)] bg-[var(--cc-surface-muted)] p-4 text-sm leading-6"><strong>Margem/reserva:</strong> {text(monetization.margin_policy)}</div>
          {(costs ?? []).length>0&&<p className="mt-3 text-xs text-[var(--cc-secondary)]">Forecast registado: {(costs ?? [])[0]?.amount} {(costs ?? [])[0]?.currency} · {(costs ?? [])[0]?.description}</p>}
        </Card>
        <Card className="p-5">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold"><Megaphone size={18}/> Marketing e vendas</h2>
          <p className="mt-3 text-sm font-semibold">Canais</p><p className="mt-1 text-sm text-[var(--cc-secondary)]">{strings(marketing.channels).join(" · ") || "Em falta"}</p>
          <p className="mt-4 text-sm font-semibold">Funil</p><p className="mt-1 text-sm text-[var(--cc-secondary)]">{strings(sales.funnel).join(" → ") || "Em falta"}</p>
          <p className="mt-4 text-sm font-semibold">Prioridades imediatas</p><p className="mt-1 text-sm text-[var(--cc-secondary)]">{strings(marketing.priority_ids).join(" → ") || "Em falta"}</p>
          <p className="mt-4 text-sm font-semibold">Pergunta de diagnóstico</p><p className="mt-1 rounded-[var(--cc-radius-md)] border-l-4 border-[var(--cc-gold)] bg-[var(--cc-surface-muted)] p-4 text-sm leading-6">{text(sales.discovery_opener)}</p>
          <Link href="/monetization" className="mt-4 inline-flex text-sm font-semibold text-[var(--cc-accent)]">Abrir Comercial</Link>
        </Card>
      </div>

      <Card className="mt-6">
        <div className="border-b border-[var(--cc-border)] p-5"><h2 className="inline-flex items-center gap-2 text-lg font-semibold"><PackageCheck size={18}/> Base de entregáveis da consultoria</h2><p className="mt-1 text-sm text-[var(--cc-secondary)]">O cliente recebe material utilizável fora do PCC; o PCC mantém estrutura, evidência e controlo interno.</p></div>
        <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">{deliverableBase.map((stage,index)=><article key={index} className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-4"><p className="font-semibold text-[var(--cc-accent)]">{text(stage.stage)}</p><ul className="mt-2 space-y-1 text-sm text-[var(--cc-secondary)]">{strings(stage.items).map(item=><li key={item}>• {item}</li>)}</ul></article>)}</div>
        <div className="border-t border-[var(--cc-border)] px-5 py-4"><p className="text-sm text-[var(--cc-secondary)]"><strong className="text-[var(--cc-foreground)]">Formatos:</strong> {strings(execution.delivery_formats).join(" · ")}</p><p className="mt-2 text-sm text-[var(--cc-secondary)]">{text(execution.artifact_rule)}</p></div>
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between border-b border-[var(--cc-border)] p-5"><h2 className="inline-flex items-center gap-2 font-semibold"><FileCheck2 size={18}/> Entregáveis do projecto comercial</h2><Link className={secondaryButtonClass} href={`/deliverables?project_id=${project.id}`}>Gerir</Link></div>
          <div className="divide-y divide-[var(--cc-border)]">{(deliverables ?? []).map(item=><div key={item.id} className="p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium">{item.title}</p><span className="text-xs font-semibold text-[var(--cc-secondary)]">{item.status}</span></div><p className="mt-1 text-xs text-[var(--cc-secondary)]">{item.artifact_type} · {item.progress ?? 0}%</p></div>)}</div>
        </Card>
        <Card>
          <div className="flex items-center justify-between border-b border-[var(--cc-border)] p-5"><h2 className="font-semibold">Execução e validação</h2><Link className={secondaryButtonClass} href={`/actions?project_id=${project.id}`}>Gerir</Link></div>
          <div className="p-5"><p className="text-sm font-semibold">Sequência de lançamento</p><p className="mt-1 text-sm text-[var(--cc-secondary)]">{strings(execution.launch_sequence).join(" → ") || "Em falta"}</p><p className="mt-4 text-sm font-semibold">Indicadores mestre</p><p className="mt-1 text-sm text-[var(--cc-secondary)]">{strings(measurement.master_kpis).join(" · ") || "Em falta"}</p>
            <div className="mt-4 space-y-2">{(actions ?? []).slice(0,8).map(item=><div key={item.id} className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-3"><div className="flex items-start justify-between gap-3"><p className="text-sm font-medium">{item.title}</p>{item.is_next_action&&<span className="rounded-full bg-[color-mix(in_srgb,var(--cc-gold)_16%,white)] px-2 py-1 text-[10px] font-semibold text-[var(--cc-accent)]">PRÓXIMA</span>}</div><p className="mt-1 text-xs text-[var(--cc-secondary)]">{item.status} · {item.priority}</p></div>)}</div>
          </div>
        </Card>
      </div>

      <Card className="mt-6 p-5">
        <h2 className="text-lg font-semibold">Validação ainda necessária</h2>
        {missingItems.length?<ul className="mt-3 space-y-2 text-sm text-[var(--cc-secondary)]">{missingItems.map(item=><li key={item}>• {item}</li>)}</ul>:<p className="mt-2 text-sm text-[var(--cc-secondary)]">Sem pendências registadas.</p>}
        <p className="mt-4 text-xs leading-5 text-[var(--cc-secondary)]">Validação funcional da plataforma, validação operacional do projecto e validação de mercado permanecem separadas. Só conversas, demonstrações, propostas, pilotos e clientes reais contam como evidência de mercado.</p>
      </Card>
    </>
  );
}
