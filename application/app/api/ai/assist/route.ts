import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateWithOpenAI, openAIConfigured, openAIModel } from "@/lib/openai";

const requestSchema = z.object({
  input: z.string().trim().min(3).max(12000),
  instructions: z.string().trim().max(6000).optional(),
});

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  return NextResponse.json({
    provider: "openai",
    configured: openAIConfigured(),
    model: openAIModel(),
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

  if (!openAIConfigured()) {
    return NextResponse.json({ error: "cloud_not_configured", fallback: "local" }, { status: 503 });
  }

  try {
    const text = await generateWithOpenAI(parsed.data.input, parsed.data.instructions);
    return NextResponse.json({ provider: "openai", model: openAIModel(), text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "cloud_error";
    return NextResponse.json({ error: message, fallback: "local" }, { status: 502 });
  }
}
