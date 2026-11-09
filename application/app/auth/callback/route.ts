import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const requestedNext = requestUrl.searchParams.get("next") || "/dashboard";
  const destination = new URL("/dashboard", requestUrl.origin);

  // Resolve against this origin and reject URL forms browsers normalise externally.
  if (requestedNext.startsWith("/") && !requestedNext.startsWith("//") &&
      !/[\\\u0000-\u001f\u007f]/.test(requestedNext)) {
    const candidate = new URL(requestedNext, requestUrl.origin);
    if (candidate.origin === requestUrl.origin) destination.href = candidate.href;
  }

  const failure = () => NextResponse.redirect(
    new URL("/auth/login?error=callback", requestUrl.origin),
  );

  // Missing, expired or rejected links must never appear to have signed in.
  if (requestUrl.searchParams.has("error") || !code) return failure();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session) return failure();

  return NextResponse.redirect(destination);
}
