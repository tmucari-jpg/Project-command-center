import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsedId = z.string().uuid().safeParse(id);
  if (!parsedId.success) return NextResponse.json({ error: "Documento inválido." }, { status: 400 });

  const { supabase, user } = await requireUser();
  const { data: document, error } = await supabase.from("pcc_official_documents")
    .select("id,user_id,storage_path,file_name,mime_type,file_size")
    .eq("id", parsedId.data).eq("user_id", user.id).maybeSingle();
  if (error || !document) return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });

  const { data: file, error: downloadError } = await supabase.storage.from("pcc-official-documents").download(document.storage_path);
  if (downloadError || !file) return NextResponse.json({ error: downloadError?.message ?? "Ficheiro indisponível." }, { status: 404 });

  const safeFallback = document.file_name.replace(/[^a-zA-Z0-9._-]+/g, "_") || "PCC_documento";
  const encoded = encodeURIComponent(document.file_name);
  const bytes = await file.arrayBuffer();
  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": document.mime_type || file.type || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${safeFallback}"; filename*=UTF-8''${encoded}`,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
