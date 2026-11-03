import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  // Only the Vercel-protected, synthetic Gemini probe bypasses the Supabase session:
  // this preview has no database credentials and must not access production data.
  if (process.env.VERCEL_ENV === "preview" && request.nextUrl.pathname === "/api/gemini-verification") {
    return NextResponse.next();
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    "/api/:path*",
  ],
};
