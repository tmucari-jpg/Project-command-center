import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { sanitizeOfficialFileName } from "@/lib/official-documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  document_key: z.enum(["master_mind", "commercial_guide", "technical_package", "release_diagnostic", "android_apk", "android_aab", "other"]),
  title: z.string().trim().min(2).max(180),
  version_label: z.string().trim().min(1).max(80),
  status: z.enum(["draft", "current"]),
});

const mimeToFormat: Record<string, string> = {
  "application/pdf": "pdf", "application/msword": "docx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/zip": "zip", "application/x-zip-compressed": "zip", "text/plain": "txt", "application/json": "json",
  "application/vnd.android.package-archive": "apk", "application/octet-stream": "other",
};

function redirectTo(request: Request, params: Record<string, string>) {
  const url = new URL("/official-documents", request.url);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  const { supabase, user } = await requireAdmin();
  const formData = await request.formData();
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  ¶»§q«^