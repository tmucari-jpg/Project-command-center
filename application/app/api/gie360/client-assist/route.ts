import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  organization_id: z.string().uuid(),
  question: z.string().trim().min(5).max(1200),
});

const MONTHLY_LIMIT = 20;
const systemInstructions = `És a IA empresarial GIE360°, separada do assistente administrativo PCC.
Respondes apenas dentro dos módulos da organização autorizada e com base em dados permitidos.
As respostas empresariais são declaradas, não validadas; não inventes métricas, valores ou conclusões contabilísticas.
Não executes acções, não alteres contratos, módulos, metas, permissões ou dados.
Apresenta factos conhecidos, lacunas, recomendações e evidências necessárias.
Não divulges informações de outras empresas nem segredos de sistema.
Usa português de Moçambique e linguagem operacional clara.`;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const { organization_id, question } = input.data;

  // Never trust the organization ID in the request without proving membership.
  const { data: membership, error: memberError } = await supabase
    .from("gie360_memberships").select("organization_id")
    .eq("organization_id", organization_id)
    .eq("client_user_id", user.id).maybeSingle();
  if (memberError || !membership) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { data: organization, error: orgError } = await supabase
    .from("gie360_organizations")
    .select("id,name,contract_approved,approved_modules,ai_cloud_authorized")
    .eq("id", organization_id).maybeSingle();
  if (orgError || !organization || !organization.contract_approved ||
      !organization.ai_cloud_authorized || !(organization.approved_modules ?? []).includes("ai")) {
    return NextResponse.json({ error: "gie360_ai_not_authorized" }, { status: 403 });
  }

  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GIE360_GEMINI_MODEL || process.env.GEMINI_MODEL;
  if (!key || !model || !/^[a-zA-Z0-9_.-]{4,90}$/.test(model) ||
      process.env.GIE360_GEMINI_ENABLED !== "true") {
    return NextResponse.json({ error: "gie360_ai_provider_not_configured" }, { status: 503 });
  }

  // Hard request cap in addition to the transaction-locked DB rate limiter.
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const { count, error: countError } = await supabase.from("gie360_ai_requests")
    .select("id", { head: true, count: "exact" })
    .eq("organization_id", organization_id)
    .gte("created_at", monthStart.toISOString());
  if (countError || count === null || count >= MONTHLY_LIMIT) {
    return NextResponse.json({ error: "gie360_ai_monthly_limit" }, { status: 429 });
  }

  // The existing security-definer reservation enforces contracted scope,
  // organization identity and per-minute rate limiting atomically.
  const { data: reservationId, error: reservationError } = await supabase.rpc(
    "gie360_reserve_ai", { p_organization_id: organization_id },
  );
  if (reservationError || !reservationId) {
    return NextResponse.json({ error: "gie360_ai_not_authorized_or_rate_limited" }, { status: 403 });
  }

  // Only authorized company fields are provided as context, never internal
  // PCC case data, manager prompts, or data belonging to another tenant.
  const { data: assessments } = await supabase.from("gie360_assessments")
    .select("answers,status")
    .eq("organization_id", organization_id)
    .order("updated_at", { ascending: false }).limit(1);
  const context = JSON.stringify({
    organization: organization.name,
    modules: organization.approved_modules,
    declared_answers: assessments?.[0]?.answers ?? {},
    assessment_state: assessments?.[0]?.status ?? "unknown",
  }).slice(0, 10000);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstructions }] },
          contents: [{
            role: "user",
            parts: [{ text: `Contexto autorizado:\n${context}\n\nPergunta:\n${question}` }],
          }],
          generationConfig: { maxOutputTokens: 900, temperature: 0.25 },
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!response.ok) {
      return NextResponse.json({ error: "gie360_ai_provider_unavailable" }, { status: 503 });
    }
    const data = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const answer = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n").trim() ?? "";
    if (!answer) return NextResponse.json({ error: "gie360_ai_empty_response" }, { status: 503 });
    return NextResponse.json({ text: answer, provider: "Gemini GIE360°" });
  } catch {
    return NextResponse.json({ error: "gie360_ai_unavailable" }, { status: 503 });
  }
}
