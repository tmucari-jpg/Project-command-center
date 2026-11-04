import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateGie360Response } from "@/lib/gie360-gemini";

const schema = z.object({
  organization_id: z.string().uuid(),
  question: z.string().trim().min(5).max(1200),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const { organization_id, question } = parsed.data;

  const { data: organization, error } = await supabase.from("gie360_organizations")
    .select("id,name,manager_user_id,contract_approved,approved_modules,ai_cloud_authorized")
    .eq("id", organization_id)
    .eq("manager_user_id", user.id).maybeSingle();
  if (error || !organization) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!organization.contract_approved || !organization.ai_cloud_authorized ||
      !(organization.approved_modules ?? []).includes("ai")) {
    return NextResponse.json({ error: "gie360_ai_not_authorized" }, { status: 403 });
  }

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const { count, error: countError } = await supabase.from("gie360_ai_requests")
    .select("id", { head: true, count: "exact" }).eq("organization_id", organization_id)
    .gte("created_at", monthStart.toISOString());
  if (countError || count === null || count >= 20) {
    return NextResponse.json({ error: "gie360_ai_monthly_limit" }, { status: 429 });
  }

  const { data: reservationId, error: reservationError } = await supabase.rpc(
    "gie360_reserve_ai", { p_organization_id: organization_id },
  );
  if (reservationError || !reservationId) {
    return NextResponse.json({ error: "gie360_ai_not_available_or_rate_limited" }, { status: 403 });
  }

  const { data: assessments } = await supabase.from("gie360_assessments")
    .select("answers,status").eq("organization_id", organization_id)
    .order("updated_at", { ascending: false }).limit(1);
  try {
    const result = await generateGie360Response({
      question,
      context: {
        organization: organization.name,
        approved_modules: organization.approved_modules,
        declared_answers: assessments?.[0]?.answers ?? {},
        assessment_status: assessments?.[0]?.status ?? "unknown",
      },
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({
      error: "gie360_ai_unavailable",
      fallback: "Continue a análise manual; nenhuma alteração foi aplicada.",
    }, { status: 503 });
  }
}
