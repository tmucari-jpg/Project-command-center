import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { resolveOfficialAndroidApk } from "@/lib/android-distribution";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const { supabase, user } = await requireUser();
  const build = await resolveOfficialAndroidApk(supabase, user.id, process.env.VERCEL_GIT_COMMIT_SHA);
  if (!build) return NextResponse.json({ error: "Ainda não existe uma APK oficial com assinatura de distribuição, hash e instalação validados para esta versão. Use a instalação PWA ou peça ao administrador a validação da build em Mobile & Distribuição." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  return NextResponse.redirect(new URL(`/api/official-documents/${build.id}/download`, request.url), 307);
}
