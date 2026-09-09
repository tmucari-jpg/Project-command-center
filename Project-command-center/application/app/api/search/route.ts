import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { BraveSearchError, searchBrave } from "@/lib/integrations/brave";

const searchSchema = z.object({
  query: z
    .string()
    .trim()
    .min(2)
    .max(400)
    .refine((value) => value.split(/\s+/).length <= 50, "A pesquisa tem palavras a mais."),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "VALIDATION_FAILED" }, { status: 400 });
  }

  const parsed = searchSchema.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_FAILED", message: parsed.error.issues[0]?.message },
      { status: 400 },
    );
  }

  const { data: allowed, error: rateLimitError } =
    await supabase.rpc("check_brave_search_rate_limit");

  if (rateLimitError) {
    console.error("Rate limit check failed:", rateLimitError.message);
    return NextResponse.json({ error: "INTEGRATION_UNAVAILABLE" }, { status: 503 });
  }

  if (!allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED", message: "Muitas pesquisas. Tente novamente dentro de um minuto." },
      { status: 429 },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const results = await searchBrave(parsed.data.query, controller.signal);
    return NextResponse.json({
      query: parsed.data.query,
      trust: "untrusted_external_data",
      results,
    });
  } catch (error) {
    if (error instanceof BraveSearchError) {
      const status =
        error.code === "TIMEOUT"
          ? 504
          : error.code === "RATE_LIMITED"
            ? 429
            : error.code === "AUTHENTICATION_FAILED"
              ? 502
              : 503;
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status },
      );
    }

    console.error("Unexpected Brave Search error");
    return NextResponse.json({ error: "UNKNOWN_ERROR" }, { status: 500 });
  } finally {
    clearTimeout(timeout);
  }
}
