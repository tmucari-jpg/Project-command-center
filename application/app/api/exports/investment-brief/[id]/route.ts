import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/auth";
import type { InvestmentOpportunity } from "@/lib/investment-discovery";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function esc(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function list(items: string[]) {
  return "<ul>" + items.map((item) => "<li>" + esc(item) + "</li>").join("") + "</ul>";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const auth = await supabase.auth.getUser();
  const authUser = auth.data.user;

  if (auth.error || !authUser) {
    return NextResponse.json({ error: "Sessão necessária." }, { status: 401 });
  }

  let userId = authUser.id;
  if (await isAdminUser(supabase, authUser.id, authUser.email)) {
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
  }

  const [{ data: factoryCase }, { data: brief }] = await Promise.all([
    supabase
      .from("project_factory_cases")
      .select("id,title,description,constraints,created_at")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("investment_discovery_briefs")
      .select("executive_summary,opportunities,recommended_option_id,recommendation,decision_criteria,status,created_at")
      .eq("factory_case_id", id)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (!factoryCase || !brief) {
    return NextResponse.json({ error: "Resumo de investimento não encontrado." }, { status: 404 });
  }

  const opportunities = Array.isArray(brief.opportunities)
    ? brief.opportunities as InvestmentOpportunity[]
    : [];

  const rows = opportunities.map((option, index) =>
    "<tr>" +
      "<td><strong>" + esc(index + 1) + ". " + esc(option.title) + "</strong>" +
      (option.id === brief.recommended_option_id ? "<br><span class='recommended'>RECOMENDADA</span>" : "") +
      "</td>" +
      "<td>" + esc(option.concept) + "</td>" +
      "<td>" + esc(option.business_model) + "</td>" +
      "<td>" + esc(option.entry_strategy) + "</td>" +
      "<td>" + esc(option.validation_strategy) + "</td>" +
      "<td>" + esc(option.estimated_initial_cost) + "</td>" +
      "<td>" + esc(option.score) + "/100</td>" +
    "</tr>"
  ).join("");

  const detailBlocks = opportunities.map((option, index) =>
    "<div class='option'>" +
      "<h3>" + esc(index + 1) + ". " + esc(option.title) + "</h3>" +
      "<p><strong>Necessidade / oportunidade:</strong> " + esc(option.problem_or_need) + "</p>" +
      "<p><strong>Mercado a validar:</strong> " + esc(option.target_market) + "</p>" +
      "<p><strong>Resultado pretendido:</strong> " + esc(option.expected_value) + "</p>" +
      "<p><strong>Porque encaixa:</strong> " + esc(option.why_fit) + "</p>" +
      "<p><strong>Tempo para validar:</strong> " + esc(option.time_to_validate) + "</p>" +
      "<p><strong>Riscos:</strong></p>" + list(option.key_risks ?? []) +
    "</div>"
  ).join("");

  const html = "<!doctype html><html><head><meta charset='utf-8'><title>PCC Resumo para Decisão</title>" +
    "<style>body{font-family:Aptos,Arial,sans-serif;color:#18332f;margin:42px;background:#fffdf6}h1,h2,h3{color:#073f36}h1{font-size:28px}h2{font-size:18px;border-bottom:1px solid #d7c59b;padding-bottom:6px;margin-top:28px}h3{font-size:15px}.brand{width:230px}.muted{color:#66746f}.note{border-left:4px solid #c99439;padding:12px;background:#fff8e9;margin:14px 0}.option{border:1px solid #e5dcc7;background:#fff;padding:12px;margin:10px 0;border-radius:8px}table{border-collapse:collapse;width:100%;margin-top:12px;font-size:11px}th,td{border:1px solid #ded5c2;padding:7px;text-align:left;vertical-align:top}th{background:#f3ead5;color:#073f36}.recommended{color:#8a611c;font-weight:700;font-size:10px}li{margin:3px 0}</style></head><body>" +
    "<img class='brand' src='https://project-command-center-seven-xi.vercel.app/brand/pcc-logo.png' alt='PCC'>" +
    "<h1>Resumo para Decisão — Oportunidades de Investimento</h1>" +
    "<p class='muted'>Project Command Center · documento de comparação antes da selecção de uma oportunidade para validação.</p>" +
    "<div class='note'><strong>Resumo executivo:</strong><br>" + esc(brief.executive_summary) + "</div>" +
    "<h2>Comparação</h2>" +
    "<table><thead><tr><th>Proposta</th><th>Conceito</th><th>Modelo</th><th>Entrada</th><th>Validação</th><th>Investimento inicial</th><th>Adequação</th></tr></thead><tbody>" + rows + "</tbody></table>" +
    "<h2>Detalhe das propostas</h2>" + detailBlocks +
    "<h2>Recomendação</h2><div class='note'>" + esc(brief.recommendation) + "</div>" +
    "<h2>Critérios de decisão</h2><p>" + esc(brief.decision_criteria) + "</p>" +
    "<p class='muted'>Gerado pelo PCC em " + esc(new Date().toISOString()) + ".</p>" +
    "</body></html>";

  return new NextResponse(html, {
    headers: {
      "content-type": "application/msword; charset=utf-8",
      "content-disposition": 'attachment; filename="PCC_Resumo_Decisao_Investimento.doc"',
      "cache-control": "no-store",
    },
  });
}
