import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateGie360Response } from "@/lib/gie360-gemini";

const schema = z.object({
  organization_id: z.string().uuid(),
  question: z.string().trim().min(5).max(1200),
});
const MONTHLY_LIMIT = 20;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const { organization_id, question } = input.data;

  const { data: membership, error: memberError } = await supabase.from("gie360_memberships")
    .select("organization_id").eq("organization_id", organization_id)
    .eq("client_user_id", user.id).maybeSingle();
  if (memberError || !membership) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { data: organization, error: orgError } = await supabase.from("gie360_organizations")
    .select("id,name,contract_approved,approved_modules,ai_cloud_authorized")
    .eq("id", organization_id).maybeSingle();
  if (orgError || !organization || !organization.contract_approved ||
      !organization.ai_cloud_authorized || !(organization.approved_modules ?? []).includes("ai")) {
    return NextResponse.json({ error: "gie360_ai_not_authorized" }, { status: 403 });
  }

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

  const { data: reservationId, error: reservationError } = await supabase.rpc(
    "gie360_reserve_ai", { p_organization_id: organization_id },
  );
  if (reservationError || !reservationId) {
    return NextResponse.json({ error: "gie360_ai_not_authorized_or_rate_limited" }, { status: 403 });
  }

  const { data: assessments } = await supabase.from("gie360_assessments")
    .select("answers,status").eq("organization_id", organization_id)
    .order("updated_at", { ascending: false }).limit(1);

  try {
    const result = await generateGie360Response({
      question,
      context: {
        organization: organization.name,
        modules: organization.approved_modules,
        declared_answers: assessments?.[0]?.answers ?? {},
        assessment_state: assessments?.[0]?.status ?? "unknown",
      },
    });
    await supabase.rpc("gie360_finish_ai_request", {
      p_request_id: reservationId,
      p_status: "completed",
      p_provider: "gemini",
      p_error_code: null,
    });
    return NextResponse.json(result);
  } catch {
    await supabase.rpc("gie360_finish_ai_request", {
      p_request_id: reservationId,
      p_status: "failed",
      p_provider: "gemini",
      p_error_code: "GIE360_AI_PROVIDER_UNAVAILABLE",
    });
    return NextResponse.json({ error: "gie360_ai_unavailable" }, { status: 503 });
  }
}
