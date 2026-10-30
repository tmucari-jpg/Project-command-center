import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceUser } from "@/lib/auth";
import { renderDocument } from "@/lib/artifacts/render";
import type { ArtifactSnapshot } from "@/lib/artifacts/model";

export const runtime = "nodejs";
const uuid = z.string().uuid();
const missing = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : "PENDENTE DE CONFIRMAÇÃO";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) return NextResponse.json({ error: "Projecto inválido." }, { status: 400 });
  const format = new URL(request.url).searchParams.get("format") ?? "pdf";
  if (!["pdf", "docx"].includes(format)) return NextResponse.json({ error: "Formato inválido." }, { status: 400 });

  const db = await createClient();
  const auth = await db.auth.getUser();
  if (auth.error || !auth.data.user) return NextResponse.json({ error: "Sessão necessária." }, { status: 401 });
  const user = await resolveWorkspaceUser(db, auth.data.user);

  const [{ data: project }, { data: baselines }] = await Promise.all([
    db.from("projects").select("id,title,expected_result,currency").eq("id", id).eq("user_id", user.id).maybeSingle(),
    db.from("project_commitment_baselines").select("id,version,status,expected_result,scope,exclusions,deliverables_summary,pcc_responsibilities,client_responsibilities,external_costs_terms,acceptance_terms,security_conditions,client_validation_reference").eq("project_id", id).eq("user_id", user.id).order("version", { ascending: false }).limit(1),
  ]);
  if (!project) return NextResponse.json({ error: "Projecto não encontrado." }, { status: 404 });
  const baseline = baselines?.[0];
  if (!baseline || !["internal_approved", "client_approved"].includes(baseline.status)) {
    return NextResponse.json({ error: "Valide internamente o diagnóstico e o compromisso antes de gerar o rascunho." }, { status: 409 });
  }

  const fields = {
    "Partes e identificação legal": "PENDENTE DE CONFIRMAÇÃO",
    "Resultado esperado": missing(baseline.expected_result),
    "Objecto e âmbito dos serviços": missing(baseline.scope),
    "Exclusões": missing(baseline.exclusions),
    "Entregáveis": missing(baseline.deliverables_summary),
    "Obrigações do prestador": missing(baseline.pcc_responsibilities),
    "Obrigações do cliente": missing(baseline.client_responsibilities),
    "Preço, moeda, pagamentos e impostos": "PENDENTE DE CONFIRMAÇÃO",
    "Custos externos e serviços adicionais": missing(baseline.external_costs_terms),
    "Cronograma e condições de início": "PENDENTE DE CONFIRMAÇÃO",
    "Critérios de aceitação": missing(baseline.acceptance_terms),
    "Confidencialidade e tratamento de dados": missing(baseline.security_conditions),
    "Responsabilidade, resolução de litígios e cessação": "PENDENTE DE REVISÃO JURÍDICA",
    "Lei aplicável e foro": "PENDENTE DE REVISÃO JURÍDICA",
    "Assinaturas e datas": "PENDENTE DE ASSINATURA",
  };

  const snapshot: ArtifactSnapshot = {
    version: baseline.id,
    generatedAt: new Date().toISOString(),
    kind: "document",
    project: { title: project.title, expected_result: project.expected_result, currency: project.currency },
    deliverable: {
      title: `Carta de Compromisso - ${project.title}`,
      description: "MINUTA NÃO ASSINADA — requer revisão jurídica e aprovação pelas partes. A geração não autoriza o início dos serviços.",
      completion_criteria: "Confirmar termos comerciais, jurídicos e assinatura antes da eficácia contratual.",
    },
    sections: [{ title: `Condições propostas — baseline v${baseline.version}`, rows: [fields] }],
  };
  const files = await renderDocument(snapshot);
  const result = files.find(f => f.extension === format)!;
  const title = project.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9 _-]/g, "").trim().replace(/\s+/g, "_").slice(0, 75) || "Projecto";
  return new NextResponse(new Uint8Array(result.bytes), {
    headers: {
      "Content-Type": result.mime,
      "Content-Disposition": `attachment; filename="Carta_de_Compromisso_${title}_v${baseline.version}.${format}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
