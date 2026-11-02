import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type JsonObject = Record<string, unknown>;

function obj(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown, fallback = "Em falta") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function esc(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function list(items: unknown[]) {
  return "<ul>" + items.map((item) => "<li>" + esc(item) + "</li>").join("") + "</ul>";
}

export async function GET() {
  const supabase = await createClient();
  const auth = await supabase.auth.getUser();
  const authUser = auth.data.user;

  if (auth.error || !authUser) {
    return NextResponse.json({ error: "Sessão necessária." }, { status: 401 });
  }

  if (!(await isAdminUser(supabase, authUser.id, authUser.email))) {
    return NextResponse.json({ error: "Acesso de administração necessário." }, { status: 403 });
  }

  let userId = authUser.id;
  const owner = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("scope_type", "global")
    .eq("role", "owner")
    .is("project_id", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (owner.data?.user_id) userId = owner.data.user_id;

  const projectResult = await supabase
    .from("projects")
    .select("id,title,status,progress,next_action")
    .eq("user_id", userId)
    .eq("title", "Marketing, Vendas e Lançamento do PCC")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const project = projectResult.data;
  if (projectResult.error || !project) {
    return NextResponse.json({ error: projectResult.error?.message ?? "Projecto comercial não encontrado." }, { status: 404 });
  }

  const [planResult, costResult, deliverableResult] = await Promise.all([
    supabase.from("project_strategy_execution_plans")
      .select("strategy,monetization,marketing,sales,execution,measurement,updated_at")
      .eq("user_id", userId)
      .eq("project_id", project.id)
      .maybeSingle(),
    supabase.from("financial_entries")
      .select("description,amount,currency,status,cost_treatment,cost_frequency,external_provider")
      .eq("user_id", userId)
      .eq("project_id", project.id)
      .eq("entry_type", "cost")
      .order("occurred_on", { ascending: false }),
    supabase.from("deliverables")
      .select("title,description,status,progress,workstream,artifact_type")
      .eq("user_id", userId)
      .eq("project_id", project.id)
      .order("created_at"),
  ]);

  const plan = (planResult.data ?? {}) as {
    strategy?: unknown;
    monetization?: unknown;
    marketing?: unknown;
    sales?: unknown;
    execution?: unknown;
    measurement?: unknown;
    updated_at?: unknown;
  };
  const strategy = obj(plan.strategy);
  const monetization = obj(plan.monetization);
  const marketing = obj(plan.marketing);
  const sales = obj(plan.sales);
  const execution = obj(plan.execution);
  const packages = arr(monetization.packages).map(obj);
  const entryPaths = arr(strategy.entry_paths).map(obj);
  const objectives = arr(strategy.objectives).filter((item): item is string => typeof item === "string");
  const deliveryBase = arr(execution.deliverables_base).map(obj);
  const channels = arr(marketing.channels).filter((item): item is string => typeof item === "string");
  const funnel = arr(sales.funnel).filter((item): item is string => typeof item === "string");

  const packageRows = packages.map((item) => {
    const price = item.price_mzn_from ?? item.price_mzn ?? "—";
    const prefix = item.price_mzn_from ? "desde " : "";
    const projects = item.max_simultaneous_projects ? " · até " + esc(item.max_simultaneous_projects) + " projectos em simultâneo" : "";
    return "<tr><td><strong>" + esc(item.name) + "</strong></td><td>" + prefix + esc(price) + " MZN / " + esc(item.period) + "</td><td>" + esc(item.scope) + projects + "</td><td>" + esc(item.benefit) + "</td></tr>";
  }).join("");

  const entryBlocks = entryPaths.map((item) =>
    "<div class='box'><strong>" + esc(item.name) + "</strong><p>" + esc(item.description) + "</p></div>"
  ).join("");

  const deliverableBlocks = deliveryBase.map((stage) =>
    "<div class='box'><strong>" + esc(stage.stage) + "</strong>" + list(arr(stage.items)) + "</div>"
  ).join("");

  const registeredDeliverables = (deliverableResult.data ?? []).map((item) =>
    "<tr><td>" + esc(item.title) + "</td><td>" + esc(item.workstream ?? "general") + "</td><td>" + esc(item.status) + "</td><td>" + esc(item.progress ?? 0) + "%</td><td>" + esc(item.artifact_type) + "</td></tr>"
  ).join("");

  const costs = (costResult.data ?? []).map((item) =>
    "<tr><td>" + esc(item.description) + "</td><td>" + esc(item.amount) + " " + esc(item.currency) + "</td><td>" +
    esc(item.cost_treatment ?? "pcc_internal") + "</td><td>" + esc(item.cost_frequency ?? "one_off") + "</td><td>" +
    esc(item.external_provider ?? "—") + "</td><td>" + esc(item.status) + "</td></tr>"
  ).join("");

  // Incorporar a imagem no documento: caminhos relativos falham em aplicações Word fora do PCC.
  let logoMarkup = "";
  try {
    const bytes = await readFile(path.join(process.cwd(), "public", "brand", "pcc-logo-transparent.svg"));
    logoMarkup = `<img src="data:image/svg+xml;base64,${bytes.toString("base64")}" alt="Logótipo PCC" style="max-width:190px;height:auto" />`;
  } catch {
    return NextResponse.json({ error: "Logótipo oficial em falta. Exportação bloqueada." }, { status: 503 });
  }

  const html = "<!doctype html><html><head><meta charset='utf-8'><title>PCC Snapshot Operacional Comercial</title>" +
    "<style>body{font-family:Aptos,Arial,sans-serif;color:#18332f;margin:42px;background:#fffdf6}h1,h2{color:#073f36}h1{font-size:28px}h2{font-size:18px;border-bottom:1px solid #d7c59b;padding-bottom:6px;margin-top:28px}.wordmark{font-size:28px;font-weight:800;letter-spacing:.08em;color:#073f36}.muted{color:#66746f}.box{border:1px solid #e5dcc7;background:#f8f1df;padding:12px;margin:8px 0;border-radius:8px}table{border-collapse:collapse;width:100%;margin-top:10px}th,td{border:1px solid #ded5c2;padding:8px;text-align:left;vertical-align:top}th{background:#073f36;color:#fffdf6}li{margin:4px 0}.note{border-left:4px solid #c99439;padding:10px;background:#fff8e9}</style></head><body>" +
    "<div>" + logoMarkup + "</div>" +
    "<h1>Snapshot Operacional Comercial do PCC</h1>" +
    "<p class='muted'>Documento de trabalho — validação visual e documental pendente. Snapshot operacional do projecto Marketing, Vendas e Lançamento do PCC. Não substitui o Guia Comercial validado nem a sua identidade visual oficial.</p>" +
    "<div class='note'><strong>Posicionamento:</strong> " + esc(strategy.positioning) + " " + esc(strategy.technology_role) + "</div>" +
    "<h2>Objectivos</h2>" + list(objectives.length ? objectives : ["Avaliar", "Decidir", "Estruturar", "Acompanhar", "Comprovar valor"]) +
    "<h2>Pontos de entrada</h2>" + entryBlocks +
    "<h2>Pacotes e preços</h2><table><thead><tr><th>Pacote</th><th>Preço</th><th>Âmbito</th><th>Benefício</th></tr></thead><tbody>" + packageRows + "</tbody></table>" +
    "<h2>Custos e condições de execução</h2>" +
    "<div class='note'><strong>Regra:</strong> o preço base do PCC remunera a consultoria e os entregáveis expressamente contratados. Domínio, hosting, licenças, publicidade, fornecedores e trabalhos paralelos são identificados e aprovados separadamente, salvo inclusão explícita na proposta.</div>" +
    "<table><thead><tr><th>Custo</th><th>Valor</th><th>Tratamento</th><th>Frequência</th><th>Fornecedor</th><th>Estado</th></tr></thead><tbody>" + costs + "</tbody></table>" +
    "<h2>Marketing e vendas</h2><p><strong>Canais:</strong> " + esc(channels.join(" · ")) + "</p><p><strong>Funil:</strong> " + esc(funnel.join(" → ")) + "</p>" +
    "<h2>Compromisso de entrega</h2><div class='box'><strong>Não vender o que não conseguimos entregar.</strong><p>Antes da execução material, o PCC valida capacidade, custos, segurança, riscos e dependências; o cliente valida explicitamente o resultado esperado, âmbito, entregáveis, exclusões e critérios de aceitação. A versão aprovada torna-se a Baseline de Compromisso e alterações materiais passam por controlo de alterações.</p></div>" +
    "<h2>Base de entregáveis</h2>" + deliverableBlocks +
    "<h2>Entregáveis registados no projecto</h2><table><thead><tr><th>Entregável</th><th>Vertente</th><th>Estado</th><th>Progresso</th><th>Formato</th></tr></thead><tbody>" + registeredDeliverables + "</tbody></table>" +
    "<p class='muted'>Gerado em " + esc(new Date().toISOString()) + ". A decisão humana, as evidências reais e as versões oficiais registadas no PCC prevalecem.</p>" +
    "</body></html>";

  return new NextResponse(html, {
    headers: {
      "content-type": "application/msword; charset=utf-8",
      "content-disposition": 'attachment; filename="PCC_Snapshot_Operacional_Comercial.doc"',
      "cache-control": "no-store",
    },
  });
}
