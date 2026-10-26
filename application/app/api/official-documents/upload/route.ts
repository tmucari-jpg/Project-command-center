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
  if (!parsed.success) return redirectTo(request, { error: parsed.error.issues[0]?.message ?? "Dados inválidos." });

  const file = formData.get("file");
  if (!(file instanceof File) || file.size <= 0) return redirectTo(request, { error: "Seleccione um ficheiro válido." });
  if (file.size > 20 * 1024 * 1024) return redirectTo(request, { error: "O ficheiro excede o limite de 20 MB." });

  const extension = file.name.toLowerCase().split(".").pop() ?? "other";
  const format = extension === "aab" ? "aab" : extension === "apk" ? "apk" : (mimeToFormat[file.type] ?? extension);
  if (!["docx", "pdf", "zip", "txt", "json", "apk", "aab", "other"].includes(format)) return redirectTo(request, { error: "Formato de ficheiro não permitido." });

  if (parsed.data.status === "current") {
    const releaseSha = process.env.VERCEL_GIT_COMMIT_SHA ?? null;
    const { data: releaseValidation, error: releaseValidationError } = await supabase
      .from("operational_validation_runs")
      .select("status,release_sha,created_at")
      .eq("user_id", user.id)
      .eq("scope", "release")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (releaseValidationError) {
      return redirectTo(request, { error: "Não foi possível validar o estado operacional da release." });
    }

    const sameRelease =
      !releaseSha ||
      !releaseValidation?.release_sha ||
      releaseValidation.release_sha === releaseSha;

    if (!releaseValidation || releaseValidation.status !== "passed" || !sameRelease) {
      return redirectTo(request, {
        error: "A versão oficial só pode ser promovida depois de a release actual estar validada operacionalmente em pleno.",
      });
    }
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const documentId = randomUUID();
  const safeName = sanitizeOfficialFileName(file.name);
  const storagePath = `${user.id}/${documentId}/${safeName}`;

  const { error: uploadError } = await supabase.storage.from("pcc-official-documents").upload(storagePath, bytes, { contentType: file.type || "application/octet-stream", upsert: false });
  if (uploadError) return redirectTo(request, { error: uploadError.message });

  const { error: insertError } = await supabase.from("pcc_official_documents").insert({
    id: documentId, user_id: user.id, project_id: null, deliverable_id: null,
    document_key: parsed.data.document_key, title: parsed.data.title, format, version_label: parsed.data.version_label,
    status: parsed.data.status, storage_path: storagePath, file_name: safeName, mime_type: file.type || null,
    file_size: file.size, sha256, released_at: parsed.data.status === "current" ? new Date().toISOString() : null,
  });
  if (insertError) {
    await supabase.storage.from("pcc-official-documents").remove([storagePath]);
    return redirectTo(request, { error: insertError.message });
  }

  if (parsed.data.status === "current") {
    await supabase.from("pcc_official_documents").update({ status: "superseded" }).eq("user_id", user.id).eq("document_key", parsed.data.document_key).eq("format", format).eq("status", "current").neq("id", documentId);
    await supabase.from("operational_validation_runs").insert({
      user_id: user.id, scope: "downloads", status: "partial", release_sha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      details: { document_id: documentId, document_key: parsed.data.document_key, format, storage_verified: true, desktop_mobile_download_requires_client_confirmation: true },
    });
  }
  return redirectTo(request, { uploaded: "1" });
}
