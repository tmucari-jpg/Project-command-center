import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  createClientDiagnosticToken,
  clientDiagnosticPublicUrl,
} from "@/lib/client-diagnostic-token";

const schema = z.object({
  reviewed: z.literal(true),
  intent: z.enum(["idea", "client_request", "investment", "internal_improvement", "digital_solution", "problem", "gie360"]),
  case_title: z.string().trim().min(2).max(180),
  client_name: z.string().trim().min(2).max(200),
  client_organization: z.string().trim().min(2).max(300),
  public_context: z.string().trim().max(2000).optional().default(""),
});

const intentMeta = {
  gie360: {
    label: "GIE360° — Gestão Inteligente Empresarial",
    problem: "Recolher o diagnóstico inicial da empresa para definir necessidades e preparar o questionário empresarial específico.",
    expected: "Identificar o ponto de partida e preparar a avaliação empresarial personalizada GIE360°.",
    projectType: "commercial" as const,
  },
  idea: {
    label: "Ideia / projecto a avaliar",
    problem: "Recolher informação inicial para compreender e avaliar uma ideia ou projecto.",
    expected: "Preparar um diagnóstico inicial e definir os próximos passos.",
    projectType: "commercial" as const,
  },
  client_request: {
    label: "Pedido de cliente",
    problem: "Recolher informação factual do cliente antes de estruturar o diagnóstico e a resposta.",
    expected: "Compreender o pedido, condições e resultado esperado para iniciar o diagnóstico.",
    projectType: "commercial" as const,
  },
  investment: {
    label: "Oportunidade de negócio / investimento",
    problem: "Compreender o perfil, recursos e objectivos antes de identificar oportunidades de negócio ou investimento.",
    expected: "Preparar uma base real para pesquisar e comparar oportunidades adequadas ao perfil.",
    projectType: "commercial" as const,
  },
  internal_improvement: {
    label: "Melhoria de processo interno",
    problem: "Recolher informação sobre o processo actual, principais limitações e resultado pretendido.",
    expected: "Preparar um diagnóstico inicial da melhoria interna.",
    projectType: "non_commercial" as const,
  },
  digital_solution: {
    label: "Solução digital / produto",
    problem: "Recolher informação essencial sobre utilizadores, necessidade e resultado esperado antes de definir a solução.",
    expected: "Preparar o diagnóstico inicial da solução digital.",
    projectType: "commercial" as const,
  },
  problem: {
    label: "Problema a resolver",
    problem: "Recolher informação factual sobre o problema, impacto e contexto antes de propor uma solução.",
    expected: "Preparar um diagnóstico inicial orientado para a resolução do problema.",
    projectType: "non_commercial" as const,
  },
};

export async function POST(request: Request) {
  try {
    const payload = schema.safeParse(await request.json());
    if (!payload.success) {
      return NextResponse.json({ error: "Revise os dados antes de gerar o questionário." }, { status: 400 });
    }

    const { supabase, user } = await requireUser();
    const meta = intentMeta[payload.data.intent];
    const now = new Date().toISOString();

    const { data: factoryCase, error: caseError } = await supabase
      .from("project_factory_cases")
      .insert({
        user_id: user.id,
        title: payload.data.case_title,
        description: `Questionário de diagnóstico gerado antes do diagnóstico completo. Natureza: ${meta.label}.`,
        problem: meta.problem,
        project_type: meta.projectType,
        target_user: null,
        expected_value: meta.expected,
        constraints: null,
        source: `questionnaire_preintake_${payload.data.intent}`,
        stage: "viability",
        competitive_intelligence_required: meta.projectType === "commercial",
        governance_gate: "g1_triage",
        governance_gate_status: "in_progress",
        g1_completed_at: null,
      })
      .select("id")
      .single();

    if (caseError || !factoryCase) {
      return NextResponse.json(
        { error: caseError?.message ?? "Não foi possível criar o caso de diagnóstico." },
        { status: 500 },
      );
    }

    const { token, tokenHash } = createClientDiagnosticToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: diagnosticRequest, error: requestError } = await supabase
      .from("client_diagnostic_requests")
      .insert({
        user_id: user.id,
        factory_case_id: factoryCase.id,
        token_hash: tokenHash,
        questionnaire_version: payload.data.intent === "gie360" ? "executive-gie360-v1" : "executive-v3",
        client_name: payload.data.client_name || null,
        client_organization: payload.data.client_organization || null,
        public_context:
          payload.data.public_context ||
          "Este breve questionário permite-nos compreender o essencial e preparar um diagnóstico mais focado e uma próxima conversa mais objectiva.",
        status: "active",
        expires_at: expiresAt,
      })
      .select("id")
      .single();

    if (requestError || !diagnosticRequest) {
      await supabase
        .from("project_factory_cases")
        .delete()
        .eq("id", factoryCase.id)
        .eq("user_id", user.id);

      return NextResponse.json(
        { error: requestError?.message ?? "Não foi possível gerar o questionário." },
        { status: 500 },
      );
    }

    const material = JSON.stringify({
      factoryCaseId: factoryCase.id,
      clientName: payload.data.client_name,
      clientOrganization: payload.data.client_organization,
      publicContext: payload.data.public_context || "Este breve questionário permite-nos compreender o essencial e preparar um diagnóstico mais focado e uma próxima conversa mais objectiva.",
      expiresAt,
      version: payload.data.intent === "gie360" ? "executive-gie360-v1" : "executive-v3",
    });
    const { error: approvalError } = await supabase.from("pcc_external_share_approvals").insert({
      request_id: diagnosticRequest.id,
      factory_case_id: factoryCase.id,
      manager_user_id: user.id,
      audience_name: payload.data.client_name,
      audience_organization: payload.data.client_organization,
      public_context: payload.data.public_context || "Este breve questionário permite-nos compreender o essencial e preparar um diagnóstico mais focado e uma próxima conversa mais objectiva.",
      content_sha256: createHash("sha256").update(material).digest("hex"),
      content_version: payload.data.intent === "gie360" ? "executive-gie360-v1" : "executive-v3",
      expires_at: expiresAt,
    });
    if (approvalError) {
      await supabase.from("client_diagnostic_requests").update({ status: "revoked" }).eq("id", diagnosticRequest.id).eq("user_id", user.id);
      return NextResponse.json({ error: "Não foi possível registar a aprovação interna. O link não foi disponibilizado." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      url: clientDiagnosticPublicUrl(token),
      factoryCaseId: factoryCase.id,
      requestId: diagnosticRequest.id,
      expiresAt,
      createdAt: now,
    });
  } catch {
    return NextResponse.json({ error: "Não foi possível gerar o questionário." }, { status: 500 });
  }
}
