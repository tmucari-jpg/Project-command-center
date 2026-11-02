import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceUser } from "@/lib/auth";
import { isFreeAIEligible } from "@/lib/ai-runtime";
import { generateAssistWithFallback } from "@/lib/ai-assist-router";

const requestSchema = z.object({
  input: z.string().trim().min(3).max(12000),
  instructions: z.string().trim().max(6000).optional(),
});

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const workspaceUser = await resolveWorkspaceUser(supabase, user);
  const { data: providers, error } = await supabase
    .from("ai_provider_profiles")
    .select("provider,label,mode,enabled,cost_class,priority,last_health_status")
    .eq("user_id", workspaceUser.id)
    .order("priority", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "provider_registry_unavailable" }, { status: 500 });
  }

  return NextResponse.json({
    configured: Boolean(providers?.some(isFreeAIEligible)),
    policy: "local-first-free-only",
    providers: providers ?? [],
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const workspaceUser = await resolveWorkspaceUser(supabase, user);
    const result = await generateAssistWithFallback(
      supabase,
      workspaceUser.id,
      parsed.data.input,
      parsed.data.instructions,
    );

    return NextResponse.json({
      provider: result.provider.provider,
      provider_label: result.provider.label,
      text: result.text,
      attempts: result.attempts,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "assist_unavailable";
    return NextResponse.json(
      { error: message, fallback: "local_or_manual" },
      { status: 503 },
    );
  }
}
