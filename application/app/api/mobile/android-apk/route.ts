import { NextResponse } from "next/server";

const APK_URL =
  "https://raw.githubusercontent.com/tmucari-jpg/Project-command-center/mobile-builds/downloads/PCC-Android.apk";

export const dynamic = "force-dynamic";

export async function GET() {
  const upstream = await fetch(APK_URL, { cache: "no-store" });

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: "APK indisponível" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const headers = new Headers({
    "Content-Type": "application/vnd.android.package-archive",
    "Content-Disposition": 'attachment; filename="PCC-Android.apk"',
    "Cache-Control": "no-store, no-transform",
    "X-Content-Type-Options": "nosniff",
  });

  const contentLength = upstream.headers.get("content-length");
  if (contentLength) headers.set("Content-Length", contentLength);

  return new Response(upstream.body, {
    status: 200,
    headers,
  });
}
