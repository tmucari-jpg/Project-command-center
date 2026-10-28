import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { requirePublicSupabaseEnv } from "@/lib/env";
import { isGIE360Client, isGIE360Path } from "@/lib/pcc-access";

const AUTH_PATHS = ["/auth/login", "/auth/sign-up", "/auth/forgot-password"];
const PUBLIC_PATHS = [
  "/",
  ...AUTH_PATHS,
  "/auth/callback",
  "/manifest.webmanifest",
  "/sw.js",
  "/offline.html",
  "/offline-app.js",
  "/client-diagnostic",
  "/project-status",
  "/gie360",
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export async function updateSession(request: NextRequest) {
  const { url, key } = requirePublicSupabaseEnv();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });

        Object.entries(headers).forEach(([header, value]) => {
          response.headers.set(header, value);
        });
      },
    },
  });

  const claimsResult = await supabase.auth.getClaims();
  const claims = claimsResult.data?.claims;

  const isAuthenticated = Boolean(claims?.sub);
  const pathname = request.nextUrl.pathname;

  // API handlers still own authentication; the shared boundary only prevents
  // authenticated client accounts from entering any internal PCC API.
  const isApi = pathname === "/api" || pathname.startsWith("/api/");
  if (isAuthenticated && !isGIE360Path(pathname)) {
    let clientIdentity: boolean;
    try { clientIdentity = await isGIE360Client(supabase, String(claims!.sub)); }
    catch { return NextResponse.json({ error: "identity_boundary_unavailable" }, { status: 503 }); }
    if (clientIdentity) {
      if (isApi) return NextResponse.json({ error: "pcc_access_forbidden" }, { status: 403 });
      const target = request.nextUrl.clone(); target.pathname = "/gie360"; target.search = "";
      const redirected = NextResponse.redirect(target);
      response.cookies.getAll().forEach((cookie) => redirected.cookies.set(cookie));
      redirected.headers.set("Cache-Control", "no-store");
      return redirected;
    }
  }
  if (isApi) return response;

  if (!isAuthenticated && !isPublicPath(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/auth/login";
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (isAuthenticated && AUTH_PATHS.some((path) => pathname.startsWith(path))) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
