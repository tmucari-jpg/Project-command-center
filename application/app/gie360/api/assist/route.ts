import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { generateAssistWithFallback } from "@/lib/ai-assist-router";
import { GIE360_AI_INSTRUCTIONS, parseGIE360Answer, type GIESource } from "@/lib/gie360-assistant";

export const runtime = "nodejs";
export const maxDuration = 30;
const requestSchema = z.object({ organizationId: z.uuid(), question: z.string().trim().min(3).max(3000) }).strict();

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return NextResponse.json({ error: "Origem inválida. Reabra o portal e tente novamente." }, { status: 403 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Inicie sessão no GIE360°." }, { status: 401 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Seleccione a empresa e escreva uma pergunta entre 3 e 3000 caracteres." }, { status: 400 });
  const { organizationId, question } = parsed.data;
  // All context reads use the authenticated tenant's RLS, never the privileged client.
  const { data: org, error: orgError } = await supabase.from("gie360_organizations")
    .select("id,name,manager_user_id,ai_cloud_authorized,approved_modules,contract_approved")
    .eq("id", organizationId).maybeSingle();
  if (orgError || !org) return NextResponse.json({ error: "Empresa indisponível para esta conta." }, { status: 403 });
  if (!org.ai_cloud_authorized || !org.contract_approved || !org.approved_modules.includes("ai")) return NextResponse.json({ error: "O gestor precisa de aprovar o módulo IA e a autorização de tratamento dos dados desta empresa em Produtos e Pacotes." }, { status: 409 });
  const admin = createServiceClient();
  if (!admin) return NextResponse.json({ error: "O serviço de IA da empresa ainda não está configurado no servidor. Contacte o gestor." }, { status: 503 });
  const [{ data: assessments, error: assessmentError }, { data: imports, error: importError }] = await Promise.all([
    supabase.from("gie360_assessments").select("id,answers,status,revision").eq("organization_id", org.id).order("updated_at", { ascending: false }).limit(3),
    supabase.from("gie360_import_batches").select("id,source_name,original_sha256,snapshot,reviewed_at").eq("organization_id", org.id).eq("state", "approved").order("reviewed_at", { ascending: false }).limit(5),
  ]);
  if (assessmentError || importError) return NextResponse.json({ error: "Não foi possível verificar os dados de origem. Tente novamente; a análise não foi executada." }, { status: 503 });
  const sources: GIESource[] = [];
  for (const assessment of assessments ?? []) {
    for (const [field, value] of Object.entries(assessment.answers ?? {})) {
      if (typeof value === "string" && value.trim()) sources.push({ ref: `assessment:${assessment.id}:r${assessment.revision}:${field}`, label: `Questionário — ${field}`, validation: "declared", content: value.slice(0, 2000) });
    }
  }
  for (const batch of imports ?? []) {
    const { coverage, totals, limitations } = batch.snapshot;
    sources.push({ ref: `batch:${batch.id}:${batch.original_sha256}`, label: batch.source_name, validation: "approved", content: JSON.stringify({ coverage, totals, limitations }) });
  }
  if (!sources.length) return NextResponse.json({ error: "Faltam dados: guarde o questionário ou peça a revisão de uma importação antes de solicitar a análise." }, { status: 409 });
  const { data: requestId, error: rateError } = await supabase.rpc("gie360_reserve_ai", { p_organization_id: org.id });
  if (rateError) {
    const limited = rateError.message.includes("RATE_LIMIT");
    return NextResponse.json({ error: limited ? "Foram atingidas 10 análises por minuto nesta empresa. Aguarde um minuto e tente novamente." : "A autorização ou o pacote da empresa não permitem esta análise. Peça ao gestor para verificar o âmbito." }, { status: limited ? 429 : 409 });
  }
  // Privilege is used only for the manager's provider registry and request audit.
  // Credentials, endpoints, internal PCC data and other tenants never enter the prompt.
  try {
    const result = await generateAssistWithFallback(admin, org.manager_user_id, JSON.stringify({ question, sources }), GIE360_AI_INSTRUCTIONS, (text) => { parseGIE360Answer(text, sources); });
    const answer = parseGIE360Answer(result.text, sources);
    const { error: auditError } = await admin.from("gie360_ai_requests").update({ status: "completed", provider: result.provider.provider, source_refs: sources.map((source) => source.ref) }).eq("id", requestId).eq("organization_id", org.id).eq("user_id", user.id);
    if (auditError) throw new Error("GIE360_AI_AUDIT_FAILED");
    return NextResponse.json({ requestId, answer, provider: result.provider.label }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const raw = error instanceof Error ? error.message : "unknown";
    const code = raw.includes("ASSIST_NO_FREE_PROVIDER") ? "no_free_provider" : raw.includes("GIE360_AI_AUDIT_FAILED") ? "audit_failed" : raw.includes("ASSIST_FREE_PROVIDERS_UNAVAILABLE") ? "providers_unavailable" : "unverified_response";
    await admin.from("gie360_ai_requests").update({ status: "failed", error_code: code }).eq("id", requestId).eq("organization_id", org.id).eq("user_id", user.id);
    return NextResponse.json({ requestId, error: code === "no_free_provider" ? "O gestor ainda não configurou um fornecedor gratuito autorizado. Os dados continuam disponíveis no portal." : code === "unverified_response" ? "A IA devolveu uma resposta sem fontes verificáveis. A resposta foi recusada; consulte os dados e tente uma pergunta mais específica." : "Não foi possível concluir uma análise verificada. Os dados estão guardados; tente novamente mais tarde ou contacte o gestor.", code }, { status: 503 });
  }
}
