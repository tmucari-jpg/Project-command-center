"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  actionSchema,
  automationJobSchema,
  automationWorkflowSchema,
  blockerSchema,
  deliverableSchema,
  evidenceSchema,
  executionArenaTrialSchema,
  factoryIntakeSchema,
  factoryLibraryItemSchema,
  factoryValidationSchema,
  factoryReportSchema,
  factoryDecisionSchema,
  investmentDiscoveryDecisionSchema,
  ideaSchema,
  metricSchema,
  objectiveSchema,
  orchestratorRouteSchema,
  projectSchema,
  projectMemorySchema,
  decisionSchema,
  commercialProfileSchema,
  commercialLeadSchema,
  competitiveIntelligenceSchema,
  financialEntrySchema,
  commitmentBaselineSchema,
  changeRequestSchema,
  subscriptionFunnelMetricSchema,
  agentRunSchema,
  intelligenceSignalSchema,
  zodMessage,
} from "@/lib/validation";
import { ENTITY_PATHS, STATUS_OPTIONS, type MutableEntity } from "@/lib/constants";
import { requireAdmin, requireUser } from "@/lib/auth";
import { selectExecutionRoute } from "@/lib/orchestrator";
import { createN8nCallback, dispatchToN8n } from "@/lib/n8n";
import { automationCodeFromName } from "@/lib/automation";
import { executionArenaDefaults } from "@/lib/execution-arena";
import { buildStrategyExecutionPlan } from "@/lib/project-plan";
import { validateAIProviderHealth } from "@/lib/ai-provider-health";
import { hasBlockingGovernanceRisk } from "@/lib/governance-risk";
import { resolveNextReviewDate } from "@/lib/review-cadence";
import { defaultMonetizationStatus, defaultReturnType } from "@/lib/value-return";
import { generateAssistWithFallback } from "@/lib/ai-assist-router";
import {
  investmentDiscoveryInstructions,
  parseInvestmentDiscoveryBrief,
  type InvestmentOpportunity,
} from "@/lib/investment-discovery";
import {
  createClientDiagnosticToken,
  clientDiagnosticPublicUrl,
} from "@/lib/client-diagnostic-token";
import {
  CLIENT_DIAGNOSTIC_ANSWER_LABELS,
  diagnosticAnswerEntries,
} from "@/lib/client-diagnostic";

function values(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
  throw new Error("Unreachable after redirect");
}

export type ClientDiagnosticLinkState = {
  ok: boolean;
  url?: string;
  error?: string;
  requestId?: string;
};

export async function createClientDiagnosticRequest(
  _previousState: ClientDiagnosticLinkState,
  formData: FormData,
): Promise<ClientDiagnosticLinkState> {
  const factoryCaseId = z.string().uuid().safeParse(formData.get("factory_case_id"));
  const clientName = z.string().trim().max(200).safeParse(String(formData.get("client_name") ?? ""));
  const clientOrganization = z.string().trim().max(300).safeParse(String(formData.get("client_organization") ?? ""));
  const publicContext = z.string().trim().max(2000).safeParse(String(formData.get("public_context") ?? ""));

  if (!factoryCaseId.success || !clientName.success || !clientOrganization.success || !publicContext.success) {
    return { ok: false, error: "Revise os dados do pedido de diagnóstico." };
  }

  const { supabase, user } = await requireUser();
  const { data: factoryCase, error: caseError } = await supabase
    .from("project_factory_cases")
    .select("id")
    .eq("id", factoryCaseId.data)
    .eq("user_id", user.id)
    .maybeSingle();

  if (caseError || !factoryCase) {
    return { ok: false, error: caseError?.message ?? "Caso não encontrado." };
  }

  const { token, tokenHash } = createClientDiagnosticToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error: revokeError } = await supabase
    .from("client_diagnostic_requests")
    .update({ status: "revoked" })
    .eq("factory_case_id", factoryCase.id)
    .eq("user_id", user.id)
    .in("status", ["active", "opened"]);

  if (revokeError) return { ok: false, error: revokeError.message };

  const { data: request, error } = await supabase
    .from("client_diagnostic_requests")
    .insert({
      user_id: user.id,
      factory_case_id: factoryCase.id,
      token_hash: tokenHash,
      questionnaire_version: "executive-v3",
      client_name: clientName.data || null,
      client_organization: clientOrganization.data || null,
      public_context: publicContext.data || null,
      status: "active",
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (error || !request) {
    return { ok: false, error: error?.message ?? "Não foi possível gerar o questionário." };
  }

  revalidatePath(`/project-factory/${factoryCase.id}`);

  return {
    ok: true,
    url: clientDiagnosticPublicUrl(token),
    requestId: request.id,
  };
}

export async function importClientDiagnosticLink(formData: FormData) {
  const factoryCaseId = z.string().uuid().safeParse(formData.get("factory_case_id"));
  const requestId = z.string().uuid().optional().safeParse(
    String(formData.get("request_id") ?? "").trim() || undefined,
  );
  const sourceUrl = z.string().trim().url().max(2048)
    .refine((value) => /^https?:\/\//i.test(value), "Use um link http ou https.")
    .safeParse(String(formData.get("source_url") ?? ""));
  const note = z.string().trim().max(2000).safeParse(String(formData.get("note") ?? ""));

  if (!factoryCaseId.success || !requestId.success || !sourceUrl.success || !note.success) {
    fail("/project-factory", "Link do questionário inválido.");
  }

  const path = `/project-factory/${factoryCaseId.data}`;
  const { supabase, user } = await requireUser();

  const { data: factoryCase, error: caseError } = await supabase
    .from("project_factory_cases")
    .select("id")
    .eq("id", factoryCaseId.data)
    .eq("user_id", user.id)
    .maybeSingle();

  if (caseError || !factoryCase) fail(path, caseError?.message ?? "Caso não encontrado.");

  if (requestId.data) {
    const { data: request, error: requestError } = await supabase
      .from("client_diagnostic_requests")
      .select("id")
      .eq("id", requestId.data)
      .eq("factory_case_id", factoryCase.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (requestError || !request) fail(path, requestError?.message ?? "Solicitação associada não encontrada.");
  }

  const { error } = await supabase.from("client_diagnostic_external_sources").insert({
    user_id: user.id,
    factory_case_id: factoryCase.id,
    request_id: requestId.data ?? null,
    source_type: "link",
    source_url: sourceUrl.data,
    note: note.data || null,
  });

  if (error) fail(path, error.message);

  revalidatePath(path);
  revalidatePath("/project-factory");
  redirect(`${path}?client_diagnostic=external_added`);
}

export async function uploadClientDiagnosticFile(formData: FormData) {
  const factoryCaseId = z.string().uuid().safeParse(formData.get("factory_case_id"));
  const requestId = z.string().uuid().optional().safeParse(
    String(formData.get("request_id") ?? "").trim() || undefined,
  );
  const note = z.string().trim().max(2000).safeParse(String(formData.get("note") ?? ""));
  const file = formData.get("questionnaire_file");

  if (!factoryCaseId.success || !requestId.success || !note.success || !(file instanceof File)) {
    fail("/project-factory", "Ficheiro do questionário inválido.");
  }

  const allowedTypes = new Set([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "image/png",
    "image/jpeg",
  ]);

  if (!file.size || file.size > 10 * 1024 * 1024) {
    fail(`/project-factory/${factoryCaseId.data}`, "O ficheiro deve ter até 10 MB.");
  }
  if (!allowedTypes.has(file.type)) {
    fail(`/project-factory/${factoryCaseId.data}`, "Formato não suportado. Use PDF, DOC, DOCX, TXT, PNG ou JPG.");
  }

  const path = `/project-factory/${factoryCaseId.data}`;
  const { supabase, user } = await requireUser();

  const { data: factoryCase, error: caseError } = await supabase
    .from("project_factory_cases")
    .select("id")
    .eq("id", factoryCaseId.data)
    .eq("user_id", user.id)
    .maybeSingle();

  if (caseError || !factoryCase) fail(path, caseError?.message ?? "Caso não encontrado.");

  if (requestId.data) {
    const { data: request, error: requestError } = await supabase
      .from("client_diagnostic_requests")
      .select("id")
      .eq("id", requestId.data)
      .eq("factory_case_id", factoryCase.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (requestError || !request) fail(path, requestError?.message ?? "Solicitação associada não encontrada.");
  }

  const safeName = file.name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120) || "questionario";
  const storagePath = `${user.id}/${factoryCase.id}/${Date.now()}-${safeName}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("client-diagnostic-imports")
    .upload(storagePath, bytes, {
      contentType: file.type,
      cacheControl: "0",
      upsert: false,
    });

  if (uploadError) fail(path, uploadError.message);

  const { error: insertError } = await supabase
    .from("client_diagnostic_external_sources")
    .insert({
      user_id: user.id,
      factory_case_id: factoryCase.id,
      request_id: requestId.data ?? null,
      source_type: "file",
      storage_path: storagePath,
      file_name: file.name,
      mime_type: file.type,
      file_size: file.size,
      note: note.data || null,
    });

  if (insertError) {
    await supabase.storage.from("client-diagnostic-imports").remove([storagePath]);
    fail(path, insertError.message);
  }

  revalidatePath(path);
  revalidatePath("/project-factory");
  redirect(`${path}?client_diagnostic=external_added`);
}

export async function revokeClientDiagnosticRequest(formData: FormData) {
  const requestId = z.string().uuid().safeParse(formData.get("request_id"));
  const factoryCaseId = z.string().uuid().safeParse(formData.get("factory_case_id"));
  if (!requestId.success || !factoryCaseId.success) fail("/project-factory", "Pedido de diagnóstico inválido.");

  const path = `/project-factory/${factoryCaseId.data}`;
  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from("client_diagnostic_requests")
    .update({ status: "revoked" })
    .eq("id", requestId.data)
    .eq("factory_case_id", factoryCaseId.data)
    .eq("user_id", user.id)
    .in("status", ["active", "opened"]);

  if (error) fail(path, error.message);
  revalidatePath(path);
  redirect(`${path}?client_diagnostic=revoked`);
}

export async function openNotification(formData: FormData) {
  const notificationId = z.string().uuid().safeParse(formData.get("notification_id"));
  if (!notificationId.success) fail("/notifications", "Notificação inválida.");

  const { supabase, user } = await requireUser();

  const { data: notification, error } = await supabase
    .from("notifications")
    .select("id,related_entity_type,related_entity_id")
    .eq("id", notificationId.data)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !notification) {
    fail("/notifications", error?.message ?? "Notificação não encontrada.");
  }

  const { error: updateError } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notification.id)
    .eq("user_id", user.id);

  if (updateError) fail("/notifications", updateError.message);

  revalidatePath("/notifications");
  revalidatePath("/project-factory");

  const entityId = notification.related_entity_id;
  if (entityId && notification.related_entity_type === "project_factory_case") {
    redirect(`/project-factory/${entityId}`);
  }
  if (entityId && notification.related_entity_type === "project") {
    redirect(`/projects/${entityId}`);
  }
  if (entityId && notification.related_entity_type === "objective") {
    redirect(`/objectives/${entityId}`);
  }

  redirect("/notifications");
}

export async function markNotificationRead(formData: FormData) {
  const notificationId = z.string().uuid().safeParse(formData.get("notification_id"));
  const returnPath = String(formData.get("return_path") ?? "/notifications");

  if (!notificationId.success) fail("/notifications", "Notificação inválida.");

  const safeReturnPath =
    /^\/(notifications|project-factory(?:\/[0-9a-f-]{36})?)$/.test(returnPath)
      ? returnPath
      : "/notifications";

  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId.data)
    .eq("user_id", user.id);

  if (error) fail(safeReturnPath, error.message);

  revalidatePath("/notifications");
  revalidatePath("/project-factory");
  revalidatePath(safeReturnPath);
  redirect(safeReturnPath);
}

export async function markAllNotificationsRead() {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);

  if (error) fail("/notifications", error.message);

  revalidatePath("/notifications");
  revalidatePath("/project-factory");
  redirect("/notifications");
}

export async function openClientDiagnosticNotification(formData: FormData) {
  const notificationId = z.string().uuid().safeParse(formData.get("notification_id"));
  const factoryCaseId = z.string().uuid().safeParse(formData.get("factory_case_id"));

  if (!notificationId.success || !factoryCaseId.success) {
    fail("/project-factory", "Alerta de diagnóstico inválido.");
  }

  const { supabase, user } = await requireUser();

  const { data: factoryCase, error: caseError } = await supabase
    .from("project_factory_cases")
    .select("id")
    .eq("id", factoryCaseId.data)
    .eq("user_id", user.id)
    .maybeSingle();

  if (caseError || !factoryCase) {
    fail("/project-factory", caseError?.message ?? "Caso não encontrado.");
  }

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId.data)
    .eq("user_id", user.id)
    .eq("type", "client_diagnostic_response")
    .eq("related_entity_type", "project_factory_case")
    .eq("related_entity_id", factoryCase.id);

  if (error) fail("/project-factory", error.message);

  revalidatePath("/project-factory");
  redirect(`/project-factory/${factoryCase.id}`);
}

export async function reviewClientDiagnosticResponse(formData: FormData) {
  const requestId = z.string().uuid().safeParse(formData.get("request_id"));
  const factoryCaseId = z.string().uuid().safeParse(formData.get("factory_case_id"));
  const reviewStatus = z.enum(["accepted", "partially_accepted", "clarification_needed"]).safeParse(formData.get("review_status"));
  const reviewNotes = z.string().trim().max(5000).safeParse(String(formData.get("review_notes") ?? ""));
  const missingInformation = z.string().trim().max(5000).safeParse(String(formData.get("missing_information") ?? ""));
  const pointsToConfirm = z.string().trim().max(5000).safeParse(String(formData.get("points_to_confirm") ?? ""));

  if (
    !requestId.success ||
    !factoryCaseId.success ||
    !reviewStatus.success ||
    !reviewNotes.success ||
    !missingInformation.success ||
    !pointsToConfirm.success
  ) {
    fail("/project-factory", "Revisão do diagnóstico inválida.");
  }

  const path = `/project-factory/${factoryCaseId.data}`;
  const { supabase, user } = await requireUser();

  const { data: request, error: requestError } = await supabase
    .from("client_diagnostic_requests")
    .select("id,status")
    .eq("id", requestId.data)
    .eq("factory_case_id", factoryCaseId.data)
    .eq("user_id", user.id)
    .maybeSingle();

  if (requestError || !request) fail(path, requestError?.message ?? "Pedido de diagnóstico não encontrado.");
  if (!["submitted", "analyzing", "reviewed", "clarification_needed"].includes(request.status)) {
    fail(path, "Ainda não existe uma resposta disponível para revisão.");
  }

  const { data: response, error: responseError } = await supabase
    .from("client_diagnostic_responses")
    .select("id")
    .eq("request_id", request.id)
    .maybeSingle();

  if (responseError || !response) fail(path, responseError?.message ?? "Resposta do cliente não encontrada.");

  const { error: reviewError } = await supabase
    .from("client_diagnostic_reviews")
    .upsert(
      {
        request_id: request.id,
        user_id: user.id,
        review_status: reviewStatus.data,
        review_notes: reviewNotes.data || null,
        missing_information: missingInformation.data || null,
        points_to_confirm: pointsToConfirm.data || null,
      },
      { onConflict: "request_id" },
    );

  if (reviewError) fail(path, reviewError.message);

  const { error: statusError } = await supabase
    .from("client_diagnostic_requests")
    .update({
      status: reviewStatus.data === "clarification_needed" ? "clarification_needed" : "reviewed",
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", request.id)
    .eq("user_id", user.id);

  if (statusError) fail(path, statusError.message);

  revalidatePath(path);
  redirect(`${path}?client_diagnostic=reviewed`);
}


async function syncProjectDiagnosticDeliverable(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  userId: string,
  factoryCaseId: string,
  projectId: string,
) {
  const { data: request, error: requestError } = await supabase
    .from("client_diagnostic_requests")
    .select("id,status,submitted_at")
    .eq("factory_case_id", factoryCaseId)
    .eq("user_id", userId)
    .in("status", ["submitted", "reviewed", "incorporated"])
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (requestError) throw new Error(requestError.message);
  if (!request) return;

  const { data: response, error: responseError } = await supabase
    .from("client_diagnostic_responses")
    .select("respondent_name,respondent_role,answers,submitted_at")
    .eq("request_id", request.id)
    .maybeSingle();

  if (responseError) throw new Error(responseError.message);
  if (!response) return;

  const entries = diagnosticAnswerEntries(response.answers);
  const respondentLine =
    "Respondente: " +
    response.respondent_name +
    (response.respondent_role ? " · " + response.respondent_role : "");
  const receivedLine =
    "Recebido em: " +
    (response.submitted_at ?? request.submitted_at ?? new Date().toISOString());
  const answerLines = entries.map(
    ([key, value]) => (CLIENT_DIAGNOSTIC_ANSWER_LABELS[key] ?? key) + ": " + value,
  );

  const description = [
    "DIAGNÓSTICO DO CLIENTE",
    respondentLine,
    receivedLine,
    "",
    ...answerLines,
  ].join("\n");

  const { data: existing, error: existingError } = await supabase
    .from("deliverables")
    .select("id")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .eq("workstream", "general")
    .ilike("title", "Diagnóstico do Cliente%")
    .limit(1)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);

  const payload = {
    title: "Diagnóstico do Cliente",
    description,
    priority: "medium",
    status: "completed",
    progress: 100,
    completion_criteria:
      "Gerado automaticamente a partir do questionário de diagnóstico e dos inputs efectivamente recolhidos.",
    workstream: "general",
  };

  if (existing) {
    const { error } = await supabase
      .from("deliverables")
      .update(payload)
      .eq("id", existing.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase.from("deliverables").insert({
    user_id: userId,
    project_id: projectId,
    ...payload,
  });

  if (error) throw new Error(error.message);
}

export async function incorporateClientDiagnosticResponse(formData: FormData) {
  const requestId = z.string().uuid().safeParse(formData.get("request_id"));
  const factoryCaseId = z.string().uuid().safeParse(formData.get("factory_case_id"));
  if (!requestId.success || !factoryCaseId.success) fail("/project-factory", "Pedido de diagnóstico inválido.");

  const path = `/project-factory/${factoryCaseId.data}`;
  const { supabase, user } = await requireUser();

  const [
    { data: request, error: requestError },
    { data: response, error: responseError },
    { data: review, error: reviewError },
    { data: factoryCase, error: caseError },
  ] = await Promise.all([
    supabase
      .from("client_diagnostic_requests")
      .select("id,status,submitted_at")
      .eq("id", requestId.data)
      .eq("factory_case_id", factoryCaseId.data)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("client_diagnostic_responses")
      .select("respondent_name,respondent_role,respondent_email,answers,submitted_at")
      .eq("request_id", requestId.data)
      .maybeSingle(),
    supabase
      .from("client_diagnostic_reviews")
      .select("review_status")
      .eq("request_id", requestId.data)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("project_factory_cases")
      .select("id,project_id,description,target_user,expected_value,constraints")
      .eq("id", factoryCaseId.data)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (requestError || !request) fail(path, requestError?.message ?? "Pedido de diagnóstico não encontrado.");
  if (responseError || !response) fail(path, responseError?.message ?? "Resposta do cliente não encontrada.");
  if (reviewError || !review) fail(path, reviewError?.message ?? "Reveja a resposta antes de a incorporar.");
  if (caseError || !factoryCase) fail(path, caseError?.message ?? "Caso não encontrado.");
  if (!["accepted", "partially_accepted"].includes(review.review_status)) {
    fail(path, "A resposta precisa de ser aceite, total ou parcialmente, antes de ser incorporada.");
  }
  if (request.status === "incorporated") {
    fail(path, "Esta resposta já foi incorporada no diagnóstico.");
  }

  const entries = diagnosticAnswerEntries(response.answers);
  const declaredBlock = [
    "INFORMAÇÃO DECLARADA PELO CLIENTE",
    `Respondente: ${response.respondent_name}${response.respondent_role ? ` · ${response.respondent_role}` : ""}`,
    `Recebido em: ${response.submitted_at ?? request.submitted_at ?? new Date().toISOString()}`,
    "",
    ...entries.map(([key, value]) => `${CLIENT_DIAGNOSTIC_ANSWER_LABELS[key] ?? key}: ${value}`),
  ].join("\n");

  const answers =
    response.answers && typeof response.answers === "object" && !Array.isArray(response.answers)
      ? (response.answers as Record<string, unknown>)
      : {};

  const affectedPeople = String(answers.affected_people ?? "").trim();
  const desiredResult = String(answers.desired_result ?? "").trim();
  const clientConstraints = String(answers.conditions ?? answers.constraints ?? "").trim();

  const nextDescription = [factoryCase.description?.trim(), declaredBlock].filter(Boolean).join("\n\n");
  const nextConstraints = [factoryCase.constraints?.trim(), clientConstraints].filter(Boolean).join("\n");

  const { error: updateError } = await supabase
    .from("project_factory_cases")
    .update({
      description: nextDescription,
      target_user: factoryCase.target_user?.trim() || affectedPeople || null,
      expected_value: factoryCase.expected_value?.trim() || desiredResult || null,
      constraints: nextConstraints || null,
    })
    .eq("id", factoryCase.id)
    .eq("user_id", user.id);

  if (updateError) fail(path, updateError.message);

  const { error: requestUpdateError } = await supabase
    .from("client_diagnostic_requests")
    .update({
      status: "incorporated",
      incorporated_at: new Date().toISOString(),
    })
    .eq("id", request.id)
    .eq("user_id", user.id);

  if (requestUpdateError) fail(path, requestUpdateError.message);

  if (factoryCase.project_id) {
    try {
      await syncProjectDiagnosticDeliverable(
        supabase,
        user.id,
        factoryCase.id,
        factoryCase.project_id,
      );
    } catch (syncError) {
      fail(
        path,
        syncError instanceof Error
          ? syncError.message
          : "Não foi possível gerar o entregável de diagnóstico.",
      );
    }
  }

  revalidatePath(path);
  redirect(`${path}?client_diagnostic=incorporated`);
}

async function ensureOwned(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  table: string,
  id: string | undefined,
  userId: string,
  path: string,
) {
  if (!id) return;
  const { data, error } = await supabase
    .from(table)
    .select("id")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    fail(path, "A relação seleccionada não existe ou não lhe pertence.");
  }
}

export async function validateAIProviderProfile(formData: FormData) {
  const path = "/ai-providers";
  const providerId = z.string().uuid().safeParse(formData.get("provider_id"));
  if (!providerId.success) fail(path, "Provider inválido.");

  const { supabase, user } = await requireAdmin();
  const { data: provider, error } = await supabase
    .from("ai_provider_profiles")
    .select("id,provider,label,mode,endpoint_hint,model_hint")
    .eq("id", providerId.data)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !provider) fail(path, error?.message ?? "Provider não encontrado.");

  const result = await validateAIProviderHealth(provider);
  const { error: updateError } = await supabase
    .from("ai_provider_profiles")
    .update({
      enabled: result.status === "healthy",
      last_health_status: result.status,
      last_health_message: result.message.slice(0, 1000),
      last_health_at: new Date().toISOString(),
    })
    .eq("id", provider.id)
    .eq("user_id", user.id);

  if (updateError) fail(path, updateError.message);

  await supabase.from("operational_validation_runs").insert({
    user_id: user.id,
    scope: "ai_provider",
    status: result.status === "healthy" ? "passed" : "failed",
    release_sha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    details: {
      provider_id: provider.id,
      provider: provider.provider,
      label: provider.label,
      health_status: result.status,
      message: result.message.slice(0, 1000),
      latency_ms: result.latency_ms ?? null,
    },
  });

  revalidatePath(path);
  revalidatePath("/optimization");
  redirect(`${path}?health=${result.status}&health_message=${encodeURIComponent(result.message)}`);
}

export async function validateAllAIProviderProfiles() {
  const path = "/ai-providers";
  const { supabase, user } = await requireAdmin();
  const { data: providers, error } = await supabase
    .from("ai_provider_profiles")
    .select("id,provider,label,mode,endpoint_hint,model_hint")
    .eq("user_id", user.id)
    .order("priority", { ascending: true });

  if (error) fail(path, error.message);
  if (!providers?.length) fail(path, "Nenhum provider registado.");

  const results: Array<{ label: string; status: string; message: string }> = [];

  for (const provider of providers) {
    const result = await validateAIProviderHealth(provider);
    const enabled = result.status === "healthy";

    const { error: updateError } = await supabase
      .from("ai_provider_profiles")
      .update({
        enabled,
        last_health_status: result.status,
        last_health_message: result.message.slice(0, 1000),
        last_health_at: new Date().toISOString(),
      })
      .eq("id", provider.id)
      .eq("user_id", user.id);

    if (updateError) fail(path, updateError.message);

    await supabase.from("operational_validation_runs").insert({
      user_id: user.id,
      scope: "ai_provider",
      status: enabled ? "passed" : "failed",
      release_sha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      details: {
        provider_id: provider.id,
        provider: provider.provider,
        label: provider.label,
        health_status: result.status,
        message: result.message.slice(0, 1000),
        latency_ms: result.latency_ms ?? null,
      },
    });

    results.push({ label: provider.label, status: result.status, message: result.message.slice(0, 220) });
  }

  const healthy = results.filter((item) => item.status === "healthy").length;
  const overall = healthy === results.length ? "healthy" : healthy > 0 ? "degraded" : "offline";
  const summary = results.map((item) => `${item.label}: ${item.status} — ${item.message}`).join(" | ");

  revalidatePath(path);
  revalidatePath("/optimization");
  redirect(`${path}?health=${overall}&health_message=${encodeURIComponent(summary)}`);
}

export async function registerAIProviderProfile(formData: FormData) {
  const path = "/ai-providers";
  const parsed = z.object({
    provider: z.enum(["openai", "moonshot", "qwen_cloud", "groq", "huggingchat", "qwen_local", "koboldcpp_local", "other"]),
    label: z.string().trim().min(2).max(120),
    mode: z.enum(["cloud", "local"]),
    priority: z.coerce.number().int().min(1).max(100),
    cost_class: z.enum(["free", "low", "medium", "high", "unknown"]),
    endpoint_hint: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.string().trim().max(500).optional(),
    ),
    model_hint: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.string().trim().max(180).optional(),
    ),
    capabilities: z.preprocess(
      (value) => typeof value === "string"
        ? value.split(",").map((item) => item.trim()).filter(Boolean)
        : [],
      z.array(z.string().min(1).max(80)).max(20),
    ),
  }).safeParse(values(formData));

  if (!parsed.success) fail(path, zodMessage(parsed.error));

  const { supabase, user } = await requireAdmin();
  const { error } = await supabase.from("ai_provider_profiles").insert({
    ...parsed.data,
    endpoint_hint: parsed.data.endpoint_hint ?? null,
    model_hint: parsed.data.model_hint ?? null,
    enabled: false,
    last_health_status: "unknown",
    last_health_message: null,
    user_id: user.id,
  });

  if (error) fail(path, error.message);
  revalidatePath(path);
  redirect(`${path}?provider=registered`);
}

export async function createFactoryLibraryItem(formData: FormData) {
  const path = "/factory-library";
  const parsed = factoryLibraryItemSchema.safeParse(values(formData));
  if (!parsed.success) fail(path, zodMessage(parsed.error));

  const { supabase, user } = await requireUser();
  const behaviorChanging = ["workflow", "template", "prompt", "strategy"].includes(parsed.data.asset_type);

  const { error } = await supabase.from("factory_library_items").insert({
    user_id: user.id,
    asset_type: parsed.data.asset_type,
    title: parsed.data.title,
    summary: parsed.data.summary,
    content: { text: parsed.data.content_text },
    source_type: "manual",
    behavior_changing: behaviorChanging,
    status: behaviorChanging ? "candidate" : "approved",
  });

  if (error) fail(path, error.message);
  revalidatePath(path);
  redirect(`${path}?created=1`);
}

export async function approveFactoryLibraryItem(formData: FormData) {
  const path = "/factory-library";
  const itemId = z.string().uuid().safeParse(formData.get("item_id"));
  if (!itemId.success) fail(path, "Activo inválido.");

  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("factory_library_items")
    .update({ status: "approved" })
    .eq("id", itemId.data)
    .eq("user_id", user.id)
    .eq("status", "candidate");

  if (error) fail(path, error.message);
  revalidatePath(path);
  redirect(`${path}?approved=1`);
}

export async function createAutomationWorkflow(formData: FormData) {
  const path = "/automation";
  const raw = values(formData);
  if (!raw.code && raw.name) {
    raw.code = automationCodeFromName(String(raw.name));
  }
  const parsed = automationWorkflowSchema.safeParse(raw);
  if (!parsed.success) fail(path, zodMessage(parsed.error));

  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("automation_workflows").insert({
    ...parsed.data,
    engine: "n8n",
    is_active: true,
    user_id: user.id,
  });

  if (error) fail(path, error.message);
  revalidatePath(path);
  redirect(`${path}?workflow=1`);
}

export async function createAutomationJob(formData: FormData) {
  const path = "/automation";
  const parsed = automationJobSchema.safeParse(values(formData));
  if (!parsed.success) fail(path, zodMessage(parsed.error));

  const { supabase, user } = await requireUser();
  await ensureOwned(supabase, "automation_workflows", parsed.data.workflow_id, user.id, path);
  await ensureOwned(supabase, "orchestrator_routes", parsed.data.orchestrator_route_id, user.id, path);
  await ensureOwned(supabase, "project_factory_cases", parsed.data.factory_case_id, user.id, path);
  await ensureOwned(supabase, "projects", parsed.data.project_id, user.id, path);

  let payload: Record<string, unknown> = {};
  if (parsed.data.payload_json) {
    try {
      const decoded = JSON.parse(parsed.data.payload_json);
      if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
        fail(path, "O payload deve ser um objecto JSON.");
      }
      payload = decoded as Record<string, unknown>;
    } catch {
      fail(path, "Payload JSON inválido.");
    }
  }

  const { payload_json: _payloadJson, ...job } = parsed.data;
  const { error } = await supabase.from("automation_jobs").insert({
    ...job,
    payload,
    status: "queued",
    user_id: user.id,
  });

  if (error) fail(path, error.message);
  revalidatePath(path);
  redirect(`${path}?created=1`);
}

export async function approveAutomationJob(formData: FormData) {
  const path = "/automation";
  const jobId = z.string().uuid().safeParse(formData.get("job_id"));
  if (!jobId.success) fail(path, "Job inválido.");

  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("automation_jobs")
    .update({ status: "approved" })
    .eq("id", jobId.data)
    .eq("user_id", user.id)
    .eq("status", "queued");

  if (error) fail(path, error.message);
  revalidatePath(path);
  redirect(`${path}?approved=1`);
}

export async function dispatchAutomationJob(formData: FormData) {
  const path = "/automation";
  const jobId = z.string().uuid().safeParse(formData.get("job_id"));
  if (!jobId.success) fail(path, "Job inválido.");

  const { supabase, user } = await requireUser();
  const { data: job, error: jobError } = await supabase
    .from("automation_jobs")
    .select("id,objective,payload,status,workflow_id,attempt_count,automation_workflows(code,requires_approval)")
    .eq("id", jobId.data)
    .eq("user_id", user.id)
    .maybeSingle();

  if (jobError || !job) fail(path, "Job não encontrado.");
  if (!["queued", "approved", "failed"].includes(job.status)) {
    fail(path, "Este job não está disponível para execução.");
  }

  const workflow = Array.isArray(job.automation_workflows)
    ? job.automation_workflows[0]
    : job.automation_workflows;

  if (workflow?.requires_approval && job.status !== "approved") {
    fail(path, "Este workflow exige aprovação humana antes da execução.");
  }

  const callback = createN8nCallback(job.id);

  await supabase
    .from("automation_jobs")
    .update({
      status: "dispatching",
      attempt_count: (job.attempt_count ?? 0) + 1,
      last_error: null,
      started_at: new Date().toISOString(),
      completed_at: null,
      result: {},
      callback_token_hash: callback.tokenHash,
    })
    .eq("id", job.id)
    .eq("user_id", user.id);

  try {
    const result = await dispatchToN8n({
      jobId: job.id,
      workflowCode: workflow?.code,
      objective: job.objective,
      payload: (job.payload ?? {}) as Record<string, unknown>,
      callbackUrl: callback.url,
      callbackToken: callback.token,
    });

    const { error } = await supabase
      .from("automation_jobs")
      .update({
        status: "running",
        external_run_id: result.externalRunId ?? null,
      })
      .eq("id", job.id)
      .eq("user_id", user.id);

    if (error) fail(path, error.message);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao contactar o n8n.";
    await supabase
      .from("automation_jobs")
      .update({ status: "failed", last_error: message })
      .eq("id", job.id)
      .eq("user_id", user.id);
    fail(path, message);
  }

  revalidatePath(path);
  redirect(`${path}?dispatched=1`);
}

export async function createExecutionArenaTrial(formData: FormData) {
  const path = "/execution-arena";
  const raw = values(formData);
  const { supabase, user } = await requireUser();

  const routeId =
    typeof raw.orchestrator_route_id === "string" && raw.orchestrator_route_id
      ? raw.orchestrator_route_id
      : undefined;

  let routeDefaults = executionArenaDefaults();

  if (routeId) {
    const { data: route, error: routeError } = await supabase
      .from("orchestrator_routes")
      .select("objective,selected_agent,strategy")
      .eq("id", routeId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (routeError) fail(path, routeError.message);
    if (!route) fail(path, "Rota de execução inválida.");

    routeDefaults = executionArenaDefaults({
      objective: route.objective,
      selectedAgent: route.selected_agent,
      strategy: route.strategy,
    });
  }

  raw.candidate_label = raw.candidate_label || routeDefaults.candidateLabel;
  raw.agent_type = raw.agent_type || routeDefaults.agentType;
  raw.strategy = raw.strategy || routeDefaults.strategy;

  const parsed = executionArenaTrialSchema.safeParse(raw);
  if (!parsed.success) fail(path, zodMessage(parsed.error));

  await ensureOwned(supabase, "project_factory_cases", parsed.data.factory_case_id, user.id, path);
  await ensureOwned(supabase, "orchestrator_routes", parsed.data.orchestrator_route_id, user.id, path);

  const { error } = await supabase.from("execution_arena_trials").insert({
    ...parsed.data,
    status: "measured",
    user_id: user.id,
  });

  if (error) fail(path, error.message);

  if (parsed.data.factory_case_id) {
    const { error: stageError } = await supabase
      .from("project_factory_cases")
      .update({ stage: "execution_arena" })
      .eq("id", parsed.data.factory_case_id)
      .eq("user_id", user.id);

    if (stageError) fail(path, stageError.message);
  }

  revalidatePath(path);
  revalidatePath("/project-factory");
  redirect(`${path}?created=1`);
}

export async function createOrchestratorRoute(formData: FormData) {
  const path = "/orchestrator";
  const parsed = orchestratorRouteSchema.safeParse(values(formData));
  if (!parsed.success) fail(path, zodMessage(parsed.error));

  const { supabase, user } = await requireUser();
  await ensureOwned(supabase, "projects", parsed.data.project_id, user.id, path);
  await ensureOwned(supabase, "project_factory_cases", parsed.data.factory_case_id, user.id, path);

  const route = selectExecutionRoute({
    taskType: parsed.data.task_type,
    riskLevel: parsed.data.risk_level,
    factuality: parsed.data.factuality,
    costSensitivity: parsed.data.cost_sensitivity,
  });

  const { error } = await supabase.from("orchestrator_routes").insert({
    ...parsed.data,
    selected_agent: route.selectedAgent,
    selected_dots: route.selectedDots,
    provider_policy: route.providerPolicy,
    strategy: route.strategy,
    approval_required: route.approvalRequired,
    rationale: route.rationale,
    user_id: user.id,
  });

  if (error) fail(path, error.message);
  revalidatePath(path);
  redirect(`${path}?created=1`);
}

export async function createObjective(formData: FormData) {
  const path = "/objectives";
  const parsed = objectiveSchema.safeParse(values(formData));
  const projectId = z.string().uuid().safeParse(formData.get("project_id"));
  if (!parsed.success) fail(path, zodMessage(parsed.error));
  if (!projectId.success) fail(path, "Seleccione o projecto deste Objectivo Central.");

  const { supabase, user } = await requireUser();
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id,objective_id")
    .eq("id", projectId.data)
    .eq("user_id", user.id)
    .maybeSingle();

  if (projectError || !project) fail(path, projectError?.message ?? "Projecto inválido.");

  let objectiveId = project.objective_id as string | null;

  if (objectiveId) {
    const { error } = await supabase
      .from("objectives")
      .update({ ...parsed.data })
      .eq("id", objectiveId)
      .eq("user_id", user.id);
    if (error) fail(path, error.message);
  } else {
    const { data: objective, error } = await supabase
      .from("objectives")
      .insert({ ...parsed.data, user_id: user.id })
      .select("id")
      .single();

    if (error || !objective) fail(path, error?.message ?? "Não foi possível criar o Objectivo Central.");
    objectiveId = objective.id;

    const { error: linkError } = await supabase
      .from("projects")
      .update({ objective_id: objectiveId })
      .eq("id", project.id)
      .eq("user_id", user.id);

    if (linkError) fail(path, linkError.message);
  }

  revalidatePath(path);
  revalidatePath("/projects");
  revalidatePath(`/projects/${project.id}`);
  revalidatePath("/dashboard");
  redirect(`${path}?project_id=${project.id}&created=1`);
}


async function syncProjectStrategyExecutionPlan(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  userId: string,
  projectId: string,
) {
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id,title,description,expected_result,priority,status,progress,next_action,owner_id,next_review_date,decision_gate,gate_status")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (projectError || !project) {
    throw new Error(projectError?.message ?? "Projecto não encontrado para preparar o plano.");
  }

  const { data: factory, error: factoryError } = await supabase
    .from("project_factory_cases")
    .select("id,problem,target_user,expected_value,constraints")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (factoryError) throw new Error(factoryError.message);

  const [
    reportResult,
    intelligenceResult,
    commercialResult,
    deliverablesResult,
    actionsResult,
    blockersResult,
    evidenceResult,
    leadsResult,
    metricsResult,
    economicsResult,
  ] = await Promise.all([
    factory?.id
      ? supabase
          .from("factory_reports")
          .select("market,competitors,existing_solutions,differentiation,market_trend,revenue_model,estimated_cost,risks")
          .eq("factory_case_id", factory.id)
          .eq("user_id", userId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    factory?.id
      ? supabase
          .from("factory_competitive_intelligence")
          .select("market_summary,competitors,existing_solutions,differentiation,trends,risks_barriers")
          .eq("factory_case_id", factory.id)
          .eq("user_id", userId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("project_commercial_profiles")
      .select("id,offer,ideal_customer,price,currency,channel,validation_status")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.from("deliverables").select("id").eq("project_id", projectId).eq("user_id", userId),
    supabase.from("actions").select("id").eq("project_id", projectId).eq("user_id", userId),
    supabase.from("blockers").select("id,status").eq("project_id", projectId).eq("user_id", userId),
    supabase.from("evidence").select("id").eq("project_id", projectId).eq("user_id", userId),
    supabase
      .from("commercial_leads")
      .select("id,next_action,next_action_at,created_at")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .order("next_action_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("metrics")
      .select("name,unit,baseline_value,target_value,current_value")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .order("created_at"),
    supabase
      .from("project_unit_economics")
      .select("cac,conversion_rate_pct,arpu,gross_margin_pct,payback_months,currency,period_start,period_end,source_notes")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const firstError =
    reportResult.error ??
    intelligenceResult.error ??
    commercialResult.error ??
    deliverablesResult.error ??
    actionsResult.error ??
    blockersResult.error ??
    evidenceResult.error ??
    leadsResult.error ??
    metricsResult.error ??
    economicsResult.error;

  if (firstError) throw new Error(firstError.message);

  const nextSalesAction =
    (leadsResult.data ?? []).find((lead) => typeof lead.next_action === "string" && lead.next_action.trim())
      ?.next_action ?? null;

  const plan = buildStrategyExecutionPlan({
    project,
    factory,
    report: reportResult.data,
    intelligence: intelligenceResult.data,
    commercial: commercialResult.data,
    operational: {
      deliverables: deliverablesResult.data?.length ?? 0,
      actions: actionsResult.data?.length ?? 0,
      openBlockers: (blockersResult.data ?? []).filter(
        (item) => !["resolved", "ignored"].includes(item.status),
      ).length,
      evidence: evidenceResult.data?.length ?? 0,
      leads: leadsResult.data?.length ?? 0,
      nextSalesAction,
    },
    economics: economicsResult.data,
    metrics: metricsResult.data ?? [],
  });

  const { error } = await supabase.from("project_strategy_execution_plans").upsert(
    {
      user_id: userId,
      project_id: projectId,
      ...plan,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "project_id" },
  );

  if (error) throw new Error(error.message);
}

export async function refreshProjectStrategyExecutionPlan(formData: FormData) {
  const projectId = z.string().uuid().safeParse(formData.get("project_id"));
  if (!projectId.success) fail("/projects", "Projecto inválido.");

  const path = `/projects/${projectId.data}/plan`;
  const { supabase, user } = await requireUser();
  await ensureOwned(supabase, "projects", projectId.data, user.id, path);

  try {
    await syncProjectStrategyExecutionPlan(supabase, user.id, projectId.data);
  } catch (error) {
    fail(path, error instanceof Error ? error.message : "Não foi possível actualizar o plano.");
  }

  revalidatePath(path);
  revalidatePath(`/projects/${projectId.data}`);
  redirect(`${path}?updated=1`);
}

type OperationalProjectContext = {
  id: string;
  title: string;
  description?: string | null;
  expected_result?: string | null;
  priority: string;
  progress?: number | string | null;
  start_date?: string | null;
  due_date?: string | null;
  notes?: string | null;
  next_action?: string | null;
  objective_id?: string | null;
};

async function ensureProjectOperationalStructure(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  userId: string,
  project: OperationalProjectContext,
) {
  let objectiveId = project.objective_id ?? null;

  if (!objectiveId) {
    const { data: objective, error } = await supabase
      .from("objectives")
      .insert({
        user_id: userId,
        title: project.title,
        description: project.description,
        expected_result: project.expected_result,
        priority: project.priority,
        status: "draft",
        start_date: project.start_date,
        due_date: project.due_date,
        progress: Number(project.progress ?? 0),
        notes: project.notes,
      })
      .select("id")
      .single();

    if (error || !objective) throw new Error(error?.message ?? "Não foi possível preparar o objectivo.");
    objectiveId = objective.id;

    const { error: linkError } = await supabase
      .from("projects")
      .update({ objective_id: objectiveId })
      .eq("id", project.id)
      .eq("user_id", userId);

    if (linkError) throw new Error(linkError.message);
  }

  const { data: existingDeliverables, error: deliverableReadError } = await supabase
    .from("deliverables")
    .select("id")
    .eq("user_id", userId)
    .eq("project_id", project.id)
    .order("created_at", { ascending: true })
    .limit(1);

  if (deliverableReadError) throw new Error(deliverableReadError.message);

  let deliverableId = existingDeliverables?.[0]?.id ?? null;

  if (!deliverableId && project.expected_result?.trim()) {
    const { data: deliverable, error } = await supabase
      .from("deliverables")
      .insert({
        user_id: userId,
        project_id: project.id,
        title: `Resultado de ${project.title}`,
        description: project.expected_result.trim(),
        priority: project.priority,
        status: "pending",
        due_date: project.due_date,
        progress: 0,
        completion_criteria: project.expected_result.trim(),
      })
      .select("id")
      .single();

    if (error || !deliverable) throw new Error(error?.message ?? "Não foi possível preparar o entregável.");
    deliverableId = deliverable.id;
  }

  const { count: actionCount, error: actionCountError } = await supabase
    .from("actions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("project_id", project.id);

  if (actionCountError) throw new Error(actionCountError.message);

  if ((actionCount ?? 0) === 0) {
    const actionTitle =
      project.next_action?.trim() ||
      (project.expected_result?.trim() ? `Avançar resultado de ${project.title}` : null);

    if (actionTitle) {
      const { error } = await supabase.from("actions").insert({
        user_id: userId,
        project_id: project.id,
        deliverable_id: deliverableId,
        title: actionTitle,
        description: project.description,
        priority: project.priority,
        status: "pending",
        completion_criteria: project.expected_result,
        is_next_action: false,
      });
      if (error) throw new Error(error.message);
    }
  }

  const { count: metricCount, error: metricCountError } = await supabase
    .from("metrics")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("project_id", project.id);

  if (metricCountError) throw new Error(metricCountError.message);

  if ((metricCount ?? 0) === 0 && project.expected_result?.trim()) {
    const { error } = await supabase.from("metrics").insert({
      user_id: userId,
      objective_id: objectiveId,
      project_id: project.id,
      name: `Progresso de ${project.title}`,
      description: `Mede o avanço do projecto face ao resultado esperado: ${project.expected_result.trim()}`,
      metric_type: "custom",
      unit: "%",
      baseline_value: 0,
      target_value: 100,
      current_value: Number(project.progress ?? 0),
    });
    if (error) throw new Error(error.message);
  }

  await syncProjectStrategyExecutionPlan(supabase, userId, project.id);
  return { objectiveId, deliverableId };
}

export async function createProject(formData: FormData) {
  const path = "/projects";
  const parsed = projectSchema.safeParse(values(formData));
  if (!parsed.success) fail(path, zodMessage(parsed.error));
  if (parsed.data.status === "active") {
    fail(path, "Um novo projecto deve passar pelo G3 e pela validação do cliente antes de entrar em execução.");
  }

  const { supabase, user, authUser } = await requireUser();
  await ensureOwned(supabase, "objectives", parsed.data.objective_id, user.id, path);

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      ...parsed.data,
      owner_id: authUser.id,
      next_review_date: null,
      review_cadence_days: null,
      user_id: user.id,
    })
    .select("id,title,description,expected_result,priority,progress,start_date,due_date,notes,next_action,objective_id")
    .single();

  if (error || !project) fail(path, error?.message ?? "Não foi possível criar o projecto.");

  if (project.expected_result?.trim()) {
    try {
      await ensureProjectOperationalStructure(supabase, user.id, project);
    } catch (structureError) {
      fail(`/projects/${project.id}`, structureError instanceof Error ? structureError.message : "Não foi possível preparar a estrutura operacional.");
    }
  }

  revalidatePath(path);
  revalidatePath("/objectives");
  revalidatePath("/deliverables");
  revalidatePath("/actions");
  revalidatePath("/metrics");
  revalidatePath("/dashboard");
  redirect(`/projects/${project.id}?created=1`);
}

export async function updateProjectGovernance(formData: FormData) {
  const parsed = z.object({
    project_id: z.string().uuid(),
    owner_id: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.string().uuid().optional(),
    ),
    review_cadence_days: z.preprocess(
      (value) => (value === "" || value === null || value === undefined ? undefined : value),
      z.coerce.number().int().min(1).max(365).optional(),
    ),
  }).safeParse(values(formData));

  if (!parsed.success) fail("/projects", zodMessage(parsed.error));

  const path = `/projects/${parsed.data.project_id}`;
  const { supabase, user } = await requireUser();

  const { data: currentProject, error: currentError } = await supabase
    .from("projects")
    .select("id,next_review_date,review_cadence_days")
    .eq("id", parsed.data.project_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (currentError || !currentProject) fail(path, currentError?.message ?? "Projecto não encontrado.");

  if (parsed.data.owner_id) {
    const { data: owner, error: ownerError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", parsed.data.owner_id)
      .maybeSingle();
    if (ownerError || !owner) fail(path, "Responsável inválido.");
  }

  const cadence = parsed.data.review_cadence_days ?? currentProject.review_cadence_days ?? null;
  const nextReview = resolveNextReviewDate({
    existingDate: currentProject.next_review_date,
    cadenceDays: cadence,
  });

  const { error } = await supabase
    .from("projects")
    .update({
      owner_id: parsed.data.owner_id ?? null,
      review_cadence_days: cadence,
      next_review_date: nextReview.date,
    })
    .eq("id", parsed.data.project_id)
    .eq("user_id", user.id);

  if (error) fail(path, error.message);

  if (parsed.data.owner_id) {
    await supabase
      .from("project_governance_dependencies")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("project_id", parsed.data.project_id)
      .eq("missing_key", "owner_id")
      .in("status", ["pending", "resolving"]);
  }

  if (cadence) {
    await supabase
      .from("project_governance_dependencies")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("project_id", parsed.data.project_id)
      .eq("missing_key", "review_cadence_days")
      .in("status", ["pending", "resolving"]);
  }

  try {
    await syncProjectStrategyExecutionPlan(supabase, user.id, parsed.data.project_id);
  } catch (syncError) {
    fail(path, syncError instanceof Error ? syncError.message : "Acompanhamento guardado, mas o plano não foi actualizado.");
  }

  revalidatePath(path);
  revalidatePath(`${path}/plan`);
  revalidatePath("/dashboard");
  redirect(`${path}?governance=1`);
}

export async function completeProjectReview(formData: FormData) {
  const projectId = z.string().uuid().safeParse(formData.get("project_id"));
  if (!projectId.success) fail("/projects", "Projecto inválido.");

  const path = `/projects/${projectId.data}`;
  const { supabase, user } = await requireUser();
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("review_cadence_days")
    .eq("id", projectId.data)
    .eq("user_id", user.id)
    .maybeSingle();

  if (projectError || !project) fail(path, projectError?.message ?? "Projecto não encontrado.");
  if (!project.review_cadence_days) {
    fail(path, "Defina primeiro a cadência de revisão. O PCC não cria uma frequência arbitrária.");
  }

  const nextReview = resolveNextReviewDate({
    cadenceDays: project.review_cadence_days,
    from: new Date(),
  });

  const { error } = await supabase
    .from("projects")
    .update({ next_review_date: nextReview.date })
    .eq("id", projectId.data)
    .eq("user_id", user.id);

  if (error) fail(path, error.message);
  revalidatePath(path);
  revalidatePath("/dashboard");
  redirect(`${path}?review=completed`);
}

export async function resolveGovernanceDependency(formData: FormData) {
  const dependencyId = z.string().uuid().safeParse(formData.get("dependency_id"));
  const projectId = z.string().uuid().safeParse(formData.get("project_id"));
  if (!dependencyId.success || !projectId.success) fail("/projects", "Dependência inválida.");

  const path = `/projects/${projectId.data}`;
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("project_governance_dependencies")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("id", dependencyId.data)
    .eq("project_id", projectId.data)
    .eq("user_id", user.id);

  if (error) fail(path, error.message);
  revalidatePath(path);
  revalidatePath("/dashboard");
  redirect(`${path}?governance_dependency=resolved`);
}

export async function createProjectDependency(formData: FormData) {
  const parsed = z.object({
    project_id: z.string().uuid(),
    depends_on_project_id: z.string().uuid(),
    relation_type: z.enum(["depends_on", "blocks", "related"]),
    notes: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.string().trim().max(2000).optional(),
    ),
  }).refine((data) => data.project_id !== data.depends_on_project_id, {
    message: "Um projecto não pode depender de si próprio.",
  }).safeParse(values(formData));

  if (!parsed.success) fail("/projects", zodMessage(parsed.error));

  const path = `/projects/${parsed.data.project_id}`;
  const { supabase, user } = await requireUser();
  await ensureOwned(supabase, "projects", parsed.data.project_id, user.id, path);
  await ensureOwned(supabase, "projects", parsed.data.depends_on_project_id, user.id, path);

  const { error } = await supabase.from("project_dependencies").insert({
    ...parsed.data,
    status: "active",
    user_id: user.id,
  });

  if (error) fail(path, error.message);
  revalidatePath(path);
  revalidatePath("/dashboard");
  redirect(`${path}?dependency=1`);
}

export async function resolveProjectDependency(formData: FormData) {
  const dependencyId = z.string().uuid().safeParse(formData.get("dependency_id"));
  const projectId = z.string().uuid().safeParse(formData.get("project_id"));
  if (!dependencyId.success || !projectId.success) fail("/projects", "Dependência inválida.");

  const path = `/projects/${projectId.data}`;
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("project_dependencies")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("id", dependencyId.data)
    .eq("project_id", projectId.data)
    .eq("user_id", user.id);

  if (error) fail(path, error.message);
  revalidatePath(path);
  revalidatePath("/dashboard");
  redirect(`${path}?dependency=resolved`);
}

export async function upsertProjectUnitEconomics(formData: FormData) {
  const optionalFinite = z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : value),
    z.coerce.number().finite().optional(),
  );

  const parsed = z.object({
    project_id: z.string().uuid(),
    cac: optionalFinite,
    conversion_rate_pct: z.preprocess(
      (value) => (value === "" || value === null || value === undefined ? undefined : value),
      z.coerce.number().min(0).max(100).optional(),
    ),
    arpu: optionalFinite,
    gross_margin_pct: z.preprocess(
      (value) => (value === "" || value === null || value === undefined ? undefined : value),
      z.coerce.number().min(-1000).max(100).optional(),
    ),
    payback_months: z.preprocess(
      (value) => (value === "" || value === null || value === undefined ? undefined : value),
      z.coerce.number().min(0).optional(),
    ),
    currency: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.string().trim().max(8).optional(),
    ),
    period_start: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    ),
    period_end: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    ),
    source_notes: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.string().trim().max(4000).optional(),
    ),
  }).refine(
    (data) => !data.period_start || !data.period_end || data.period_end >= data.period_start,
    { message: "O fim do período não pode ser anterior ao início." },
  ).safeParse(values(formData));

  if (!parsed.success) fail("/projects", zodMessage(parsed.error));

  const path = `/projects/${parsed.data.project_id}`;
  const { supabase, user } = await requireUser();
  await ensureOwned(supabase, "projects", parsed.data.project_id, user.id, path);

  const { error } = await supabase.from("project_unit_economics").upsert(
    {
      user_id: user.id,
      ...parsed.data,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "project_id" },
  );

  if (error) fail(path, error.message);

  try {
    await syncProjectStrategyExecutionPlan(supabase, user.id, parsed.data.project_id);
  } catch (syncError) {
    fail(path, syncError instanceof Error ? syncError.message : "Unit economics guardados, mas o plano não foi actualizado.");
  }

  revalidatePath(path);
  revalidatePath(`${path}/plan`);
  revalidatePath("/dashboard");
  redirect(`${path}?economics=1`);
}

export async function createDeliverable(formData: FormData) {
  const returnPath = formData.get("return_path") === "/monetization" ? "/monetization" : "/deliverables";
  const parsed = deliverableSchema.safeParse(values(formData));
  if (!parsed.success) fail(returnPath, zodMessage(parsed.error));

  const session = parsed.data.workstream === "commercial" ? await requireAdmin() : await requireUser();
  const { supabase, user } = session;
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id,owner_id")
    .eq("id", parsed.data.project_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (projectError || !project) fail(returnPath, projectError?.message ?? "Projecto inválido.");

  const ownerId = parsed.data.owner_id ?? project.owner_id ?? null;
  if (ownerId) {
    const { data: owner, error: ownerError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", ownerId)
      .maybeSingle();
    if (ownerError || !owner) fail(returnPath, "Responsável do entregável inválido.");
  }

  let artifactVersion = 1;
  if (parsed.data.supersedes_deliverable_id) {
    const { data: previous, error: previousError } = await supabase
      .from("deliverables")
      .select("id,project_id,status,artifact_version,workstream")
      .eq("id", parsed.data.supersedes_deliverable_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (previousError || !previous) fail(returnPath, previousError?.message ?? "Versão anterior inválida.");
    if (previous.project_id !== parsed.data.project_id) fail(returnPath, "A versão anterior não pertence ao mesmo projecto.");
    if ((previous.workstream ?? "general") !== parsed.data.workstream) fail(returnPath, "A nova versão deve manter a mesma vertente.");
    if (previous.status !== "completed") fail(returnPath, "Só é possível criar uma nova versão a partir de um entregável final já bloqueado.");

    artifactVersion = Number(previous.artifact_version ?? 1) + 1;
  }

  const { error } = await supabase.from("deliverables").insert({
    ...parsed.data,
    owner_id: ownerId,
    artifact_version: artifactVersion,
    user_id: user.id,
  });

  if (error) fail(returnPath, error.message);
  revalidatePath("/deliverables");
  revalidatePath("/monetization");
  revalidatePath("/dashboard");
  redirect(`${returnPath}?created=1`);
}
export async function createAction(formData: FormData) {
  const path = "/actions";
  const parsed = actionSchema.safeParse(values(formData));
  if (!parsed.success) fail(path, zodMessage(parsed.error));

  const { supabase, user } = await requireUser();
  let projectId = parsed.data.project_id;

  await ensureOwned(supabase, "projects", projectId, user.id, path);
  await ensureOwned(supabase, "deliverables", parsed.data.deliverable_id, user.id, path);

  if (parsed.data.deliverable_id) {
    const { data: deliverable, error: deliverableError } = await supabase
      .from("deliverables")
      .select("project_id")
      .eq("id", parsed.data.deliverable_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (deliverableError || !deliverable) fail(path, "Entregável inválido.");

    if (projectId && deliverable.project_id && projectId !== deliverable.project_id) {
      fail(path, "O entregável seleccionado não pertence ao projecto seleccionado.");
    }

    projectId = deliverable.project_id ?? projectId;
  }

  const wantsNextAction = parsed.data.is_next_action;
  const { data: createdAction, error } = await supabase
    .from("actions")
    .insert({
      ...parsed.data,
      project_id: projectId,
      is_next_action: false,
      user_id: user.id,
    })
    .select("id")
    .single();

  if (error || !createdAction) fail(path, error?.message ?? "Não foi possível criar a acção.");

  if (wantsNextAction) {
    const { error: nextError } = await supabase.rpc("set_next_action", {
      p_action_id: createdAction.id,
    });
    if (nextError) fail(path, nextError.message);
  }

  revalidatePath(path);
  revalidatePath("/dashboard");
  revalidatePath("/focus");
  redirect(`${path}?created=1`);
}

export async function createBlocker(formData: FormData) {
  const path = "/blockers";
  const parsed = blockerSchema.safeParse(values(formData));
  if (!parsed.success) fail(path, zodMessage(parsed.error));

  const { supabase, user } = await requireUser();
  let projectId = parsed.data.project_id;
  let deliverableId = parsed.data.deliverable_id;

  await ensureOwned(supabase, "projects", projectId, user.id, path);
  await ensureOwned(supabase, "deliverables", deliverableId, user.id, path);
  await ensureOwned(supabase, "actions", parsed.data.action_id, user.id, path);

  if (parsed.data.action_id) {
    const { data: action, error: actionError } = await supabase
      .from("actions")
      .select("project_id,deliverable_id")
      .eq("id", parsed.data.action_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (actionError || !action) fail(path, "Acção inválida.");

    if (deliverableId && action.deliverable_id && deliverableId !== action.deliverable_id) {
      fail(path, "A acção seleccionada não pertence ao entregável seleccionado.");
    }
    if (projectId && action.project_id && projectId !== action.project_id) {
      fail(path, "A acção seleccionada não pertence ao projecto seleccionado.");
    }

    deliverableId = action.deliverable_id ?? deliverableId;
    projectId = action.project_id ?? projectId;
  }

  if (deliverableId) {
    const { data: deliverable, error: deliverableError } = await supabase
      .from("deliverables")
      .select("project_id")
      .eq("id", deliverableId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (deliverableError || !deliverable) fail(path, "Entregável inválido.");
    if (projectId && deliverable.project_id && projectId !== deliverable.project_id) {
      fail(path, "O entregável seleccionado não pertence ao projecto seleccionado.");
    }

    projectId = deliverable.project_id ?? projectId;
  }

  const { error } = await supabase.from("blockers").insert({
    ...parsed.data,
    project_id: projectId,
    deliverable_id: deliverableId,
    user_id: user.id,
  });

  if (error) fail(path, error.message);
  revalidatePath(path);
  revalidatePath("/dashboard");
  if (projectId) revalidatePath(`/projects/${projectId}`);
  redirect(`${path}?created=1`);
}

export async function saveFactoryReport(formData: FormData) {
  const parsed = factoryReportSchema.safeParse(values(formData));
  const fallbackPath = "/project-factory";
  if (!parsed.success) fail(fallbackPath, zodMessage(parsed.error));

  const path = `/project-factory/${parsed.data.factory_case_id}`;
  const { supabase, user } = await requireUser();
  await ensureOwned(supabase, "project_factory_cases", parsed.data.factory_case_id, user.id, path);

  const { data: viability, error: viabilityError } = await supabase
    .from("factory_validations")
    .select("viability_status")
    .eq("factory_case_id", parsed.data.factory_case_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (viabilityError) fail(path, viabilityError.message);
  if (!viability?.viability_status || viability.viability_status === "insufficient") {
    fail(path, "A avaliação de viabilidade ainda não está concluída.");
  }

  const { error } = await supabase.from("factory_reports").upsert(
    {
      ...parsed.data,
      user_id: user.id,
      status: "ready",
    },
    { onConflict: "factory_case_id" },
  );

  if (error) fail(path, error.message);

  const { error: stageError } = await supabase
    .from("project_factory_cases")
    .update({ stage: "decision" })
    .eq("id", parsed.data.factory_case_id)
    .eq("user_id", user.id);

  if (stageError) fail(path, stageError.message);
  revalidatePath(path);
  revalidatePath("/project-factory");
  redirect(`${path}?report=1`);
}

export async function finalizeFactoryDecision(formData: FormData) {
  const parsed = factoryDecisionSchema.safeParse(values(formData));
  const fallbackPath = "/project-factory";
  if (!parsed.success) fail(fallbackPath, zodMessage(parsed.error));

  const path = `/project-factory/${parsed.data.factory_case_id}`;
  const { supabase, user, authUser } = await requireUser();

  const { data: factoryCase, error: caseError } = await supabase
    .from("project_factory_cases")
    .select("*")
    .eq("id", parsed.data.factory_case_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (caseError || !factoryCase) fail(path, "Caso da Factory não encontrado.");

  const { data: viability, error: viabilityError } = await supabase
    .from("factory_validations")
    .select("viability_status,viability_summary,conditions_to_proceed,missing_information")
    .eq("factory_case_id", parsed.data.factory_case_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (viabilityError) fail(path, viabilityError.message);
  if (!viability?.viability_status || viability.viability_status === "insufficient") {
    fail(path, "Ainda não existe informação suficiente para uma decisão fundamentada.");
  }

  if (parsed.data.decision === "go") {
    const { data: governanceRisks, error: governanceRiskError } = await supabase
      .from("project_governance_risks")
      .select("severity,status,blocks_progress")
      .eq("factory_case_id", parsed.data.factory_case_id)
      .eq("gate", "g2_viability")
      .eq("user_id", user.id);

    if (governanceRiskError) fail(path, governanceRiskError.message);

    if (hasBlockingGovernanceRisk(governanceRisks ?? [])) {
      fail(
        path,
        "O projecto tem riscos de governança bloqueantes no G2. Mitigue, aceite formalmente ou resolva os riscos antes de Avançar.",
      );
    }
  }

  const { error: reportError } = await supabase
    .from("factory_reports")
    .update({
      status: "decided",
      final_decision: parsed.data.decision,
      decision_rationale: parsed.data.decision_rationale,
      decided_at: new Date().toISOString(),
    })
    .eq("factory_case_id", parsed.data.factory_case_id)
    .eq("user_id", user.id);

  if (reportError) fail(path, reportError.message);

  if (parsed.data.decision === "go") {
    let projectId = factoryCase.project_id as string | null;

    if (!projectId) {
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .insert({
          user_id: user.id,
          title: factoryCase.title,
          description: factoryCase.description,
          expected_result: factoryCase.expected_value,
          priority: "medium",
          status: "planning",
          progress: 0,
          notes: `Criado pela Project Factory. Origem: ${factoryCase.source ?? "não indicada"}`,
          owner_id: authUser.id,
          next_review_date: null,
          review_cadence_days: null,
          governance_gate: "g3_planning",
          governance_gate_status: "in_progress",
        })
        .select("id")
        .single();

      if (projectError || !project) {
        fail(path, projectError?.message ?? "Não foi possível criar o projecto.");
      }
      projectId = project.id;
    }

    const { data: convertedProject, error: convertedProjectError } = await supabase
      .from("projects")
      .select("id,title,description,expected_result,priority,progress,start_date,due_date,notes,next_action,objective_id")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (convertedProjectError || !convertedProject) {
      fail(path, convertedProjectError?.message ?? "Projecto convertido não encontrado.");
    }

    try {
      await syncProjectDiagnosticDeliverable(
        supabase,
        user.id,
        parsed.data.factory_case_id,
        convertedProject.id,
      );
    } catch (syncError) {
      fail(
        path,
        syncError instanceof Error
          ? syncError.message
          : "Não foi possível gerar o entregável de diagnóstico.",
      );
    }

    if (convertedProject.expected_result?.trim()) {
      try {
        await ensureProjectOperationalStructure(supabase, user.id, convertedProject);
      } catch (structureError) {
        fail(path, structureError instanceof Error ? structureError.message : "Não foi possível preparar a estrutura operacional.");
      }
    }

    const { error: stageError } = await supabase
      .from("project_factory_cases")
      .update({
        stage: "converted_to_project",
        project_id: projectId,
        governance_gate: "g2_viability",
        governance_gate_status: "approved",
        g2_completed_at: new Date().toISOString(),
      })
      .eq("id", parsed.data.factory_case_id)
      .eq("user_id", user.id);

    if (stageError) fail(path, stageError.message);
  } else {
    const nextStage =
      parsed.data.decision === "modify"
        ? "validation"
        : parsed.data.decision === "hold"
          ? "on_hold"
          : "killed";

    const governanceStatus =
      parsed.data.decision === "modify"
        ? "in_progress"
        : parsed.data.decision === "hold"
          ? "blocked"
          : "completed";

    const { error: stageError } = await supabase
      .from("project_factory_cases")
      .update({
        stage: nextStage,
        governance_gate: "g2_viability",
        governance_gate_status: governanceStatus,
        g2_completed_at: parsed.data.decision === "kill" ? new Date().toISOString() : null,
      })
      .eq("id", parsed.data.factory_case_id)
      .eq("user_id", user.id);

    if (stageError) fail(path, stageError.message);
  }

  revalidatePath(path);
  revalidatePath("/project-factory");
  revalidatePath("/projects");
  redirect(`${path}?decision=1`);
}

export async function saveFactoryValidation(formData: FormData) {
  const raw = values(formData);
  const evidence = String(raw.evidence ?? "").trim();
  const viabilityStatus = String(raw.viability_status ?? "");

  raw.recommendation =
    viabilityStatus === "viable"
      ? "proceed"
      : viabilityStatus === "not_viable"
        ? "hold"
        : "modify";

  if (!raw.viability_summary) {
    const conclusion =
      viabilityStatus === "viable"
        ? "A evidência disponível suporta a viabilidade do projecto."
        : viabilityStatus === "conditional"
          ? "O projecto apresenta viabilidade, mas o avanço depende do cumprimento de condições críticas."
          : viabilityStatus === "not_viable"
            ? "A evidência disponível não suporta o investimento de recursos neste projecto neste momento."
            : "A informação disponível ainda não permite concluir a viabilidade do projecto.";

    raw.viability_summary = [
      conclusion,
      "",
      "Evidência considerada:",
      evidence,
    ].join("\n");
  }

  if (viabilityStatus === "conditional" && !raw.conditions_to_proceed) {
    raw.conditions_to_proceed = String(raw.critical_hypotheses ?? "").trim();
  }

  if (viabilityStatus === "insufficient" && !raw.missing_information) {
    raw.missing_information = String(raw.validation_plan ?? "").trim();
  }

  if (!raw.result_summary) {
    const nextActions =
      viabilityStatus === "viable"
        ? "Acção seguinte: consolidar a avaliação e preparar a decisão sobre o investimento de recursos."
        : viabilityStatus === "conditional"
          ? "Acção seguinte: confirmar as condições críticas antes da decisão de avançar."
          : viabilityStatus === "not_viable"
            ? "Acção seguinte: levar a conclusão para decisão, sem preparar execução."
            : "Acção seguinte: recolher a informação em falta e voltar a avaliar.";

    raw.result_summary = [
      String(raw.viability_summary ?? "").trim(),
      "",
      nextActions,
    ].join("\n");
  }

  const parsed = factoryValidationSchema.safeParse(raw);
  const fallbackPath = "/project-factory";
  if (!parsed.success) fail(fallbackPath, zodMessage(parsed.error));

  const path = `/project-factory/${parsed.data.factory_case_id}`;
  const { supabase, user } = await requireUser();
  await ensureOwned(supabase, "project_factory_cases", parsed.data.factory_case_id, user.id, path);

  const [{ data: factoryCase, error: factoryCaseError }, { data: existingAssessment, error: assessmentError }] =
    await Promise.all([
      supabase
        .from("project_factory_cases")
        .select("project_type")
        .eq("id", parsed.data.factory_case_id)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("factory_validations")
        .select("monetization_status,monetization_rationale,primary_return_type,secondary_return_types,return_summary,return_evidence,return_confidence")
        .eq("factory_case_id", parsed.data.factory_case_id)
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

  if (factoryCaseError || !factoryCase) fail(path, factoryCaseError?.message ?? "Caso da Factory não encontrado.");
  if (assessmentError) fail(path, assessmentError.message);

  const { arena_required, ...validation } = parsed.data;
  const { error } = await supabase
    .from("factory_validations")
    .upsert(
      {
        ...validation,
        arena_required,
        monetization_status:
          existingAssessment?.monetization_status ?? defaultMonetizationStatus(factoryCase.project_type),
        monetization_rationale: existingAssessment?.monetization_rationale ?? null,
        primary_return_type: existingAssessment?.primary_return_type ?? defaultReturnType(),
        secondary_return_types: existingAssessment?.secondary_return_types ?? [],
        return_summary: existingAssessment?.return_summary ?? null,
        return_evidence: existingAssessment?.return_evidence ?? null,
        return_confidence: existingAssessment?.return_confidence ?? null,
        user_id: user.id,
        status: "complete",
        completed_at: new Date().toISOString(),
      },
      { onConflict: "factory_case_id" },
    );

  if (error) fail(path, error.message);

  const nextStage =
    parsed.data.viability_status === "insufficient"
      ? "validation"
      : parsed.data.viability_status === "not_viable"
        ? "factory_report"
        : arena_required
          ? "execution_arena"
          : "factory_report";

  const { error: stageError } = await supabase
    .from("project_factory_cases")
    .update({
      stage: nextStage,
      governance_gate: "g2_viability",
      governance_gate_status: parsed.data.viability_status === "insufficient" ? "blocked" : "ready",
    })
    .eq("id", parsed.data.factory_case_id)
    .eq("user_id", user.id);

  if (stageError) fail(path, stageError.message);

  revalidatePath(path);
  revalidatePath("/project-factory");
  redirect(`${path}?validated=1`);
}

async function buildInvestmentDiscoveryBrief(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  userId: string,
  factoryCase: {
    id: string;
    title: string;
    description: string | null;
    problem: string;
    constraints: string | null;
  },
) {
  const input = JSON.stringify({
    objective: "Encontrar oportunidades de negócio para decisão antes de seleccionar uma para validação.",
    title: factoryCase.title,
    profile: factoryCase.description,
    constraints: factoryCase.constraints,
  });

  const result = await generateAssistWithFallback(
    supabase,
    userId,
    input,
    investmentDiscoveryInstructions(),
  );

  const brief = parseInvestmentDiscoveryBrief(result.text);
  if (!brief) {
    throw new Error("O PCC não conseguiu estruturar propostas de investimento válidas.");
  }

  const { error } = await supabase
    .from("investment_discovery_briefs")
    .upsert(
      {
        user_id: userId,
        factory_case_id: factoryCase.id,
        executive_summary: brief.executive_summary,
        opportunities: brief.opportunities,
        recommended_option_id: brief.recommended_option_id,
        recommendation: brief.recommendation,
        decision_criteria: brief.decision_criteria,
        selected_option_id: null,
        status: "ready",
      },
      { onConflict: "factory_case_id" },
    );

  if (error) throw new Error(error.message);
  return brief;
}

export async function generateInvestmentDiscoveryBrief(formData: FormData) {
  const factoryCaseId = z.string().uuid().safeParse(formData.get("factory_case_id"));
  if (!factoryCaseId.success) fail("/project-factory", "Caso de investimento inválido.");

  const path = `/project-factory/${factoryCaseId.data}`;
  const { supabase, user } = await requireUser();

  const { data: factoryCase, error } = await supabase
    .from("project_factory_cases")
    .select("id,title,description,problem,constraints,source")
    .eq("id", factoryCaseId.data)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !factoryCase) fail(path, error?.message ?? "Caso de investimento não encontrado.");
  if (factoryCase.source !== "adaptive_investment") {
    fail(path, "Este caso já não está na fase de descoberta de investimento.");
  }

  try {
    await buildInvestmentDiscoveryBrief(supabase, user.id, factoryCase);
  } catch (generationError) {
    fail(
      path,
      generationError instanceof Error
        ? generationError.message
        : "Não foi possível preparar as propostas para decisão.",
    );
  }

  const { error: stageError } = await supabase
    .from("project_factory_cases")
    .update({ stage: "investment_decision" })
    .eq("id", factoryCase.id)
    .eq("user_id", user.id);

  if (stageError) fail(path, stageError.message);

  revalidatePath(path);
  revalidatePath("/project-factory");
  redirect(`${path}?brief=1`);
}

export async function selectInvestmentDiscoveryOption(formData: FormData) {
  const parsed = investmentDiscoveryDecisionSchema.safeParse(values(formData));
  if (!parsed.success) fail("/project-factory", zodMessage(parsed.error));

  const path = `/project-factory/${parsed.data.factory_case_id}`;
  const { supabase, user, authUser } = await requireUser();

  const [{ data: factoryCase, error: caseError }, { data: brief, error: briefError }] = await Promise.all([
    supabase
      .from("project_factory_cases")
      .select("id,title,description,problem,constraints,source")
      .eq("id", parsed.data.factory_case_id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("investment_discovery_briefs")
      .select("id,executive_summary,opportunities,recommended_option_id,recommendation,decision_criteria,status")
      .eq("factory_case_id", parsed.data.factory_case_id)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (caseError || !factoryCase) fail(path, caseError?.message ?? "Caso de investimento não encontrado.");
  if (briefError || !brief) fail(path, briefError?.message ?? "Resumo para decisão não encontrado.");
  if (factoryCase.source !== "adaptive_investment") {
    fail(path, "A oportunidade de investimento já foi seleccionada.");
  }

  const opportunities = Array.isArray(brief.opportunities)
    ? brief.opportunities as unknown as InvestmentOpportunity[]
    : [];
  const selected = opportunities.find((option) => option.id === parsed.data.option_id);
  if (!selected) fail(path, "Seleccione uma oportunidade válida.");

  const rationale =
    parsed.data.decision_rationale?.trim() ||
    (selected.id === brief.recommended_option_id
      ? brief.recommendation
      : `Opção seleccionada para validação: ${selected.title}.`);

  const now = new Date().toISOString();
  const riskText = selected.key_risks?.length
    ? `Riscos iniciais a validar: ${selected.key_risks.join("; ")}`
    : "";
  const description = [
    selected.concept,
    selected.business_model ? `Modelo de negócio: ${selected.business_model}` : "",
    selected.why_fit ? `Adequação ao perfil: ${selected.why_fit}` : "",
    selected.entry_strategy ? `Estratégia de entrada: ${selected.entry_strategy}` : "",
    selected.validation_strategy ? `Estratégia de validação: ${selected.validation_strategy}` : "",
  ].filter(Boolean).join("\n\n");

  const { error: decisionError } = await supabase.from("decisions").insert({
    user_id: user.id,
    project_id: null,
    title: `Escolha de oportunidade de investimento — ${selected.title}`,
    context: brief.executive_summary,
    options_considered: opportunities.map((option) => option.title).join("\n"),
    decision: selected.title,
    rationale,
    outcome: "selected_for_validation",
    decided_at: now,
  });
  if (decisionError) fail(path, decisionError.message);

  const { error: briefUpdateError } = await supabase
    .from("investment_discovery_briefs")
    .update({
      selected_option_id: selected.id,
      status: "decided",
    })
    .eq("factory_case_id", factoryCase.id)
    .eq("user_id", user.id);
  if (briefUpdateError) fail(path, briefUpdateError.message);

  const { error: caseUpdateError } = await supabase
    .from("project_factory_cases")
    .update({
      title: selected.title,
      problem: selected.problem_or_need || selected.concept,
      description,
      target_user: selected.target_market || null,
      expected_value: selected.expected_value || null,
      constraints: [factoryCase.constraints, riskText].filter(Boolean).join("\n"),
      source: "investment_selected",
      stage: "competitive_intelligence",
      competitive_intelligence_required: true,
      governance_gate: "g2_viability",
      governance_gate_status: "in_progress",
      g1_completed_at: now,
      g2_completed_at: null,
    })
    .eq("id", factoryCase.id)
    .eq("user_id", user.id);
  if (caseUpdateError) fail(path, caseUpdateError.message);

  const { error: gateEventError } = await supabase.from("project_gate_events").insert([
    {
      user_id: user.id,
      factory_case_id: factoryCase.id,
      gate: "g1_triage",
      event_type: "approved",
      rationale: `Oportunidade seleccionada na decisão de investimento: ${selected.title}.`,
      created_by: authUser.id,
    },
    {
      user_id: user.id,
      factory_case_id: factoryCase.id,
      gate: "g2_viability",
      event_type: "entered",
      created_by: authUser.id,
    },
  ]);
  if (gateEventError) fail(path, gateEventError.message);

  revalidatePath(path);
  revalidatePath("/project-factory");
  revalidatePath("/decisions");
  redirect(`${path}?investment_decision=1`);
}

export async function createFactoryIntake(formData: FormData) {
  const path = "/project-factory";
  const parsed = factoryIntakeSchema.safeParse(values(formData));
  if (!parsed.success) fail(path, zodMessage(parsed.error));

  const { supabase, user, authUser } = await requireUser();
  const now = new Date().toISOString();
  const isInvestmentDiscovery = parsed.data.source === "adaptive_investment";

  const { data: factoryCase, error } = await supabase
    .from("project_factory_cases")
    .insert({
      ...parsed.data,
      user_id: user.id,
      stage: isInvestmentDiscovery ? "investment_discovery" : "viability",
      competitive_intelligence_required: isInvestmentDiscovery
        ? false
        : parsed.data.project_type === "commercial",
      governance_gate: isInvestmentDiscovery ? "g1_triage" : "g2_viability",
      governance_gate_status: "in_progress",
      g1_completed_at: isInvestmentDiscovery ? null : now,
    })
    .select("id,title,description,problem,constraints")
    .single();

  if (error || !factoryCase) fail(path, error?.message ?? "Não foi possível iniciar a avaliação.");

  if (isInvestmentDiscovery) {
    try {
      await buildInvestmentDiscoveryBrief(supabase, user.id, factoryCase);
    } catch (generationError) {
      revalidatePath(path);
      redirect(
        `/project-factory/${factoryCase.id}?error=${encodeURIComponent(
          generationError instanceof Error
            ? generationError.message
            : "Não foi possível preparar as propostas para decisão.",
        )}`,
      );
    }

    const { error: stageError } = await supabase
      .from("project_factory_cases")
      .update({ stage: "investment_decision" })
      .eq("id", factoryCase.id)
      .eq("user_id", user.id);

    if (stageError) fail(`/project-factory/${factoryCase.id}`, stageError.message);

    revalidatePath(path);
    redirect(`/project-factory/${factoryCase.id}?brief=1`);
  }

  const { error: gateEventError } = await supabase.from("project_gate_events").insert([
    {
      user_id: user.id,
      factory_case_id: factoryCase.id,
      gate: "g1_triage",
      event_type: "approved",
      rationale: "Triagem concluída automaticamente a partir do intake do projecto.",
      created_by: authUser.id,
    },
    {
      user_id: user.id,
      factory_case_id: factoryCase.id,
      gate: "g2_viability",
      event_type: "entered",
      created_by: authUser.id,
    },
  ]);

  if (gateEventError) fail(path, gateEventError.message);
  revalidatePath(path);
  revalidatePath("/projects");
  redirect(`/project-factory/${factoryCase.id}?created=1`);
}

export async function saveCompetitiveIntelligence(formData: FormData) {
  const parsed = competitiveIntelligenceSchema.safeParse(values(formData));
  const fallbackPath = "/project-factory";
  if (!parsed.success) fail(fallbackPath, zodMessage(parsed.error));

  const path = `/project-factory/${parsed.data.factory_case_id}`;
  const { supabase, user } = await requireUser();

  const { data: factoryCase, error: caseError } = await supabase
    .from("project_factory_cases")
    .select("id,project_type")
    .eq("id", parsed.data.factory_case_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (caseError || !factoryCase) fail(path, "Caso da Factory não encontrado.");
  if (factoryCase.project_type !== "commercial") {
    fail(path, "Competitive Intelligence aplica-se apenas a projectos comerciais.");
  }

  const { intent, ...report } = parsed.data;
  const { error } = await supabase
    .from("factory_competitive_intelligence")
    .upsert(
      {
        ...report,
        user_id: user.id,
        status: intent === "complete" ? "complete" : "draft",
        completed_at: intent === "complete" ? new Date().toISOString() : null,
      },
      { onConflict: "factory_case_id" },
    );

  if (error) fail(path, error.message);

  if (intent === "complete") {
    const { error: stageError } = await supabase
      .from("project_factory_cases")
      .update({ stage: "validation" })
      .eq("id", parsed.data.factory_case_id)
      .eq("user_id", user.id);

    if (stageError) fail(path, stageError.message);
  } else {
    const { error: stageError } = await supabase
      .from("project_factory_cases")
      .update({ stage: "competitive_intelligence" })
      .eq("id", parsed.data.factory_case_id)
      .eq("user_id", user.id);

    if (stageError) fail(path, stageError.message);
  }

  revalidatePath(path);
  revalidatePath("/project-factory");
  redirect(`${path}?${intent === "complete" ? "completed" : "saved"}=1`);
}

export async function createIdea(formData: FormData) {
  const path = "/ideas";
  const parsed = ideaSchema.safeParse(values(formData));
  if (!parsed.success) fail(path, zodMessage(parsed.error));

  const { supabase, user } = await requireUser();
  await ensureOwned(supabase, "projects", parsed.data.project_id, user.id, path);

  const { error } = await supabase.from("ideas").insert({
    ...parsed.data,
    user_id: user.id,
  });

  if (error) fail(path, error.message);
  revalidatePath(path);
  revalidatePath("/dashboard");
  redirect(`${path}?created=1`);
}

export async function createEvidence(formData: FormData) {
  const path = "/evidence";
  const parsed = evidenceSchema.safeParse(values(formData));
  if (!parsed.success) fail(path, zodMessage(parsed.error));

  const { supabase, user } = await requireUser();
  let projectId = parsed.data.project_id;
  let deliverableId = parsed.data.deliverable_id;

  await ensureOwned(supabase, "projects", projectId, user.id, path);
  await ensureOwned(supabase, "deliverables", deliverableId, user.id, path);
  await ensureOwned(supabase, "actions", parsed.data.action_id, user.id, path);

  if (parsed.data.action_id) {
    const { data: action, error: actionError } = await supabase
      .from("actions")
      .select("project_id,deliverable_id")
      .eq("id", parsed.data.action_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (actionError || !action) fail(path, "Acção inválida.");

    if (deliverableId && action.deliverable_id && deliverableId !== action.deliverable_id) {
      fail(path, "A acção seleccionada não pertence ao entregável seleccionado.");
    }
    if (projectId && action.project_id && projectId !== action.project_id) {
      fail(path, "A acção seleccionada não pertence ao projecto seleccionado.");
    }

    deliverableId = action.deliverable_id ?? deliverableId;
    projectId = action.project_id ?? projectId;
  }

  if (deliverableId) {
    const { data: deliverable, error: deliverableError } = await supabase
      .from("deliverables")
      .select("project_id")
      .eq("id", deliverableId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (deliverableError || !deliverable) fail(path, "Entregável inválido.");
    if (projectId && deliverable.project_id && projectId !== deliverable.project_id) {
      fail(path, "O entregável seleccionado não pertence ao projecto seleccionado.");
    }

    projectId = deliverable.project_id ?? projectId;
  }

  const { error } = await supabase.from("evidence").insert({
    ...parsed.data,
    project_id: projectId,
    deliverable_id: deliverableId,
    user_id: user.id,
  });

  if (error) fail(path, error.message);
  revalidatePath(path);
  if (projectId) revalidatePath(`/projects/${projectId}`);
  redirect(`${path}?created=1`);
}

export async function createMetric(formData: FormData) {
  const path = "/metrics";
  const parsed = metricSchema.safeParse(values(formData));
  if (!parsed.success) fail(path, zodMessage(parsed.error));

  const { supabase, user } = await requireUser();
  await ensureOwned(supabase, "objectives", parsed.data.objective_id, user.id, path);
  await ensureOwned(supabase, "projects", parsed.data.project_id, user.id, path);

  const { error } = await supabase.from("metrics").insert({
    ...parsed.data,
    user_id: user.id,
  });

  if (error) fail(path, error.message);
  revalidatePath(path);
  revalidatePath("/dashboard");
  redirect(`${path}?created=1`);
}


export async function createProjectMemory(formData: FormData) {
  const parsed = projectMemorySchema.safeParse(values(formData));
  const fallbackPath = "/projects";
  if (!parsed.success) fail(fallbackPath, zodMessage(parsed.error));

  const path = `/projects/${parsed.data.project_id}`;
  const { supabase, user } = await requireUser();
  await ensureOwned(supabase, "projects", parsed.data.project_id, user.id, path);

  const { error } = await supabase.from("project_memory").insert({
    ...parsed.data,
    user_id: user.id,
  });

  if (error) fail(path, error.message);
  revalidatePath(path);
  redirect(`${path}?memory=created`);
}

export async function createDecision(formData: FormData) {
  const path = "/decisions";
  const parsed = decisionSchema.safeParse(values(formData));
  if (!parsed.success) fail(path, zodMessage(parsed.error));

  const { supabase, user } = await requireUser();
  await ensureOwned(supabase, "projects", parsed.data.project_id, user.id, path);

  const { error } = await supabase.from("decisions").insert({
    ...parsed.data,
    user_id: user.id,
  });

  if (error) fail(path, error.message);
  revalidatePath(path);
  if (parsed.data.project_id) revalidatePath(`/projects/${parsed.data.project_id}`);
  redirect(`${path}?created=1`);
}


export async function saveCommitmentBaseline(formData: FormData) {
  const parsed = commitmentBaselineSchema.safeParse(values(formData));
  if (!parsed.success) fail("/projects", zodMessage(parsed.error));

  const path = `/projects/${parsed.data.project_id}`;
  const { supabase, user, authUser } = await requireUser();
  await ensureOwned(supabase, "projects", parsed.data.project_id, user.id, path);

  const { data: latest, error: latestError } = await supabase
    .from("project_commitment_baselines")
    .select("id,version,status")
    .eq("project_id", parsed.data.project_id)
    .eq("user_id", user.id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) fail(path, latestError.message);

  if (latest && ["draft", "internal_approved"].includes(latest.status)) {
    const { error } = await supabase
      .from("project_commitment_baselines")
      .update({ ...parsed.data, status: "draft", internal_approved_at: null })
      .eq("id", latest.id)
      .eq("user_id", user.id);
    if (error) fail(path, error.message);
  } else {
    const { error } = await supabase.from("project_commitment_baselines").insert({
      ...parsed.data,
      version: Number(latest?.version ?? 0) + 1,
      status: "draft",
      user_id: user.id,
      created_by: authUser.id,
    });
    if (error) fail(path, error.message);
  }

  await supabase
    .from("projects")
    .update({
      governance_gate: "g3_planning",
      governance_gate_status: "in_progress",
      information_classification: parsed.data.information_classification,
    })
    .eq("id", parsed.data.project_id)
    .eq("user_id", user.id);

  revalidatePath(path);
  revalidatePath("/projects");
  redirect(`${path}?commitment=saved`);
}

export async function approveCommitmentInternally(formData: FormData) {
  const baselineId = z.string().uuid().safeParse(formData.get("baseline_id"));
  const projectId = z.string().uuid().safeParse(formData.get("project_id"));
  if (!baselineId.success || !projectId.success) fail("/projects", "Baseline inválida.");

  const path = `/projects/${projectId.data}`;
  const { supabase, user, authUser } = await requireUser();

  const [{ data: baseline, error: baselineError }, { data: risks, error: risksError }, { data: dependencies, error: depsError }] =
    await Promise.all([
      supabase
        .from("project_commitment_baselines")
        .select("id,status,capacity_summary,cost_summary,security_conditions")
        .eq("id", baselineId.data)
        .eq("project_id", projectId.data)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("project_governance_risks")
        .select("severity,status,blocks_progress")
        .eq("project_id", projectId.data)
        .eq("gate", "g3_planning")
        .eq("user_id", user.id),
      supabase
        .from("project_governance_dependencies")
        .select("id,status,blocks_progress")
        .eq("project_id", projectId.data)
        .eq("gate", "g3_planning")
        .eq("user_id", user.id)
        .eq("blocks_progress", true)
        .in("status", ["pending", "resolving"]),
    ]);

  if (baselineError || !baseline) fail(path, baselineError?.message ?? "Baseline não encontrada.");
  if (risksError || depsError) fail(path, risksError?.message ?? depsError?.message ?? "Não foi possível validar G3.");
  if (baseline.status !== "draft") fail(path, "Apenas uma baseline em rascunho pode ser validada internamente.");
  if (!baseline.capacity_summary?.trim() || !baseline.cost_summary?.trim() || !baseline.security_conditions?.trim()) {
    fail(path, "Antes da validação interna, registe capacidade, custos e condições de segurança.");
  }
  if (hasBlockingGovernanceRisk(risks ?? []) || (dependencies ?? []).length) {
    fail(path, "Existem riscos ou dependências bloqueantes no G3. Resolva-os antes de assumir o compromisso.");
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("project_commitment_baselines")
    .update({ status: "internal_approved", internal_approved_at: now })
    .eq("id", baseline.id)
    .eq("user_id", user.id);
  if (error) fail(path, error.message);

  await supabase.from("project_gate_events").insert({
    user_id: user.id,
    project_id: projectId.data,
    gate: "g3_planning",
    event_type: "ready",
    rationale: "Capacidade, custos, segurança, riscos e dependências foram validados internamente antes da apresentação ao cliente.",
    created_by: authUser.id,
  });

  await supabase
    .from("projects")
    .update({ governance_gate_status: "ready" })
    .eq("id", projectId.data)
    .eq("user_id", user.id);

  revalidatePath(path);
  redirect(`${path}?commitment=internal-approved`);
}

export async function validateCommitmentByClient(formData: FormData) {
  const baselineId = z.string().uuid().safeParse(formData.get("baseline_id"));
  const projectId = z.string().uuid().safeParse(formData.get("project_id"));
  const reference = z.string().trim().min(2).max(2000).safeParse(formData.get("client_validation_reference"));
  if (!baselineId.success || !projectId.success || !reference.success) fail("/projects", "Validação do cliente inválida.");

  const path = `/projects/${projectId.data}`;
  const { supabase, user, authUser } = await requireUser();
  const { data: baseline, error: baselineError } = await supabase
    .from("project_commitment_baselines")
    .select("id,version,status")
    .eq("id", baselineId.data)
    .eq("project_id", projectId.data)
    .eq("user_id", user.id)
    .maybeSingle();

  if (baselineError || !baseline) fail(path, baselineError?.message ?? "Baseline não encontrada.");
  if (baseline.status !== "internal_approved") {
    fail(path, "O PCC precisa validar internamente a baseline antes da validação do cliente ou responsável interno.");
  }

  const { error } = await supabase
    .from("project_commitment_baselines")
    .update({
      status: "client_approved",
      client_validation_reference: reference.data,
      client_approved_at: new Date().toISOString(),
    })
    .eq("id", baseline.id)
    .eq("user_id", user.id);
  if (error) fail(path, error.message);

  await supabase
    .from("project_commitment_baselines")
    .update({ status: "superseded" })
    .eq("project_id", projectId.data)
    .eq("user_id", user.id)
    .eq("status", "client_approved")
    .lt("version", baseline.version);

  await supabase.from("project_gate_events").insert({
    user_id: user.id,
    project_id: projectId.data,
    gate: "g3_planning",
    event_type: "approved",
    decision: "go",
    rationale: `Cliente/responsável validou explicitamente a baseline v${baseline.version}: ${reference.data}`,
    created_by: authUser.id,
  });

  await supabase
    .from("projects")
    .update({
      governance_gate: "g4_execution",
      governance_gate_status: "in_progress",
      status: "active",
    })
    .eq("id", projectId.data)
    .eq("user_id", user.id);

  revalidatePath(path);
  revalidatePath("/projects");
  redirect(`${path}?commitment=client-approved`);
}

export async function createProjectChangeRequest(formData: FormData) {
  const parsed = changeRequestSchema.safeParse(values(formData));
  if (!parsed.success) fail("/projects", zodMessage(parsed.error));

  const path = `/projects/${parsed.data.project_id}`;
  const { supabase, user, authUser } = await requireUser();
  await ensureOwned(supabase, "projects", parsed.data.project_id, user.id, path);
  if (parsed.data.baseline_id) {
    await ensureOwned(supabase, "project_commitment_baselines", parsed.data.baseline_id, user.id, path);
  }

  const { error } = await supabase.from("project_change_requests").insert({
    ...parsed.data,
    user_id: user.id,
    created_by: authUser.id,
  });
  if (error) fail(path, error.message);

  revalidatePath(path);
  redirect(`${path}?change=created`);
}

export async function decideProjectChangeRequest(formData: FormData) {
  const requestId = z.string().uuid().safeParse(formData.get("request_id"));
  const projectId = z.string().uuid().safeParse(formData.get("project_id"));
  const decision = z.enum(["approved", "rejected", "deferred"]).safeParse(formData.get("decision"));
  const rationale = z.string().trim().min(2).max(6000).safeParse(formData.get("decision_rationale"));
  if (!requestId.success || !projectId.success || !decision.success || !rationale.success) {
    fail("/projects", "Decisão de alteração inválida.");
  }

  const path = `/projects/${projectId.data}`;
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("project_change_requests")
    .update({
      decision: decision.data,
      decision_rationale: rationale.data,
      decided_at: new Date().toISOString(),
    })
    .eq("id", requestId.data)
    .eq("project_id", projectId.data)
    .eq("user_id", user.id);
  if (error) fail(path, error.message);

  if (decision.data === "approved") {
    const { data: currentBaseline, error: baselineError } = await supabase
      .from("project_commitment_baselines")
      .select("version,expected_result,scope,exclusions,deliverables_summary,pcc_responsibilities,client_responsibilities,external_costs_terms,acceptance_terms,security_conditions,capacity_summary,cost_summary")
      .eq("project_id", projectId.data)
      .eq("user_id", user.id)
      .eq("status", "client_approved")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (baselineError) fail(path, baselineError.message);
    if (!currentBaseline) fail(path, "Não existe baseline aprovada para rever.");

    const { version, ...baselineContent } = currentBaseline;
    const { error: cloneError } = await supabase.from("project_commitment_baselines").insert({
      ...baselineContent,
      project_id: projectId.data,
      user_id: user.id,
      version: Number(version) + 1,
      status: "draft",
    });
    if (cloneError) fail(path, cloneError.message);

    await supabase
      .from("projects")
      .update({
        governance_gate: "g3_planning",
        governance_gate_status: "in_progress",
        status: "on_hold",
      })
      .eq("id", projectId.data)
      .eq("user_id", user.id);
  }

  revalidatePath(path);
  redirect(`${path}?change=decided`);
}

export async function recordDeliverableQA(formData: FormData) {
  const deliverableId = z.string().uuid().safeParse(formData.get("deliverable_id"));
  const projectId = z.string().uuid().safeParse(formData.get("project_id"));
  const qaStatus = z.enum(["passed", "failed", "not_required"]).safeParse(formData.get("qa_status"));
  const notes = z.string().trim().max(6000).safeParse(formData.get("qa_notes") ?? "");
  if (!deliverableId.success || !projectId.success || !qaStatus.success || !notes.success) {
    fail("/deliverables", "Registo de QA inválido.");
  }
  const path = `/deliverables?project_id=${projectId.data}`;
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("deliverables")
    .update({ qa_status: qaStatus.data, qa_notes: notes.data || null })
    .eq("id", deliverableId.data)
    .eq("project_id", projectId.data)
    .eq("user_id", user.id)
    .neq("status", "completed");
  if (error) fail(path, error.message);
  revalidatePath("/deliverables");
  redirect(`${path}&qa=updated`);
}

export async function recordDeliverableAcceptance(formData: FormData) {
  const deliverableId = z.string().uuid().safeParse(formData.get("deliverable_id"));
  const projectId = z.string().uuid().safeParse(formData.get("project_id"));
  const status = z.enum(["accepted", "accepted_with_reservations", "correction_required", "not_required"]).safeParse(formData.get("acceptance_status"));
  const notes = z.string().trim().max(6000).safeParse(formData.get("acceptance_notes") ?? "");
  const referenceRaw = String(formData.get("acceptance_reference") ?? "").trim();
  if (!deliverableId.success || !projectId.success || !status.success || !notes.success) {
    fail("/deliverables", "Aceitação inválida.");
  }
  if (status.data !== "not_required" && referenceRaw.length < 2) {
    fail("/deliverables", "Registe a referência da validação/aceitação do cliente.");
  }

  const path = `/deliverables?project_id=${projectId.data}`;
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("deliverables")
    .update({
      acceptance_status: status.data,
      acceptance_notes: notes.data || null,
      acceptance_reference: referenceRaw || null,
      accepted_at: ["accepted", "accepted_with_reservations"].includes(status.data) ? new Date().toISOString() : null,
    })
    .eq("id", deliverableId.data)
    .eq("project_id", projectId.data)
    .eq("user_id", user.id)
    .neq("status", "completed");
  if (error) fail(path, error.message);

  revalidatePath("/deliverables");
  redirect(`${path}&acceptance=updated`);
}

export async function updateProjectOutcomeStatus(formData: FormData) {
  const projectId = z.string().uuid().safeParse(formData.get("project_id"));
  const valueStatus = z.enum(["not_assessed", "proven", "observing", "not_proven"]).safeParse(formData.get("value_status"));
  const handoverStatus = z.enum(["not_required", "pending", "completed"]).safeParse(formData.get("handover_status"));
  const continuityStatus = z.enum(["not_required", "pending", "verified"]).safeParse(formData.get("continuity_status"));
  if (!projectId.success || !valueStatus.success || !handoverStatus.success || !continuityStatus.success) {
    fail("/deliverables", "Estado de valor, handover ou continuidade inválido.");
  }

  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("projects")
    .update({
      value_status: valueStatus.data,
      handover_status: handoverStatus.data,
      continuity_status: continuityStatus.data,
    })
    .eq("id", projectId.data)
    .eq("user_id", user.id);
  if (error) fail("/deliverables", error.message);

  revalidatePath("/deliverables");
  revalidatePath(`/projects/${projectId.data}`);
  redirect(`/deliverables?project_id=${projectId.data}&closure=updated`);
}

export async function finalizeProjectClosure(formData: FormData) {
  const path = "/closure";
  const projectId = z.string().uuid().safeParse(formData.get("project_id"));
  const decision = z.enum(["continue", "close"]).safeParse(formData.get("decision"));
  const closureReason = z
    .enum(["completed", "client_declined", "cancelled", "other"])
    .safeParse(formData.get("closure_reason") ?? "other");
  const rationale = z
    .string()
    .trim()
    .max(5000)
    .safeParse(formData.get("rationale") ?? "");

  if (!projectId.success || !decision.success || !closureReason.success || !rationale.success) {
    fail(path, "Decisão de fecho inválida.");
  }

  const { supabase, user } = await requireUser();
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id,title,status")
    .eq("id", projectId.data)
    .eq("user_id", user.id)
    .maybeSingle();

  if (projectError || !project) {
    fail(path, projectError?.message ?? "Projecto inválido.");
  }

  const isClose = decision.data === "close";
  const finalStatus =
    !isClose
      ? project.status
      : closureReason.data === "completed"
        ? "completed"
        : "cancelled";

  const reasonLabel: Record<string, string> = {
    completed: "Objectivo concluído",
    client_declined: "Cliente não pretende continuar",
    cancelled: "Projecto cancelado por decisão interna",
    other: "Outro motivo",
  };

  const { error: decisionError } = await supabase.from("decisions").insert({
    user_id: user.id,
    project_id: project.id,
    title: isClose ? "Fecho · " + project.title : "Continuidade · " + project.title,
    decision: isClose
      ? "Fechar projecto · " + reasonLabel[closureReason.data]
      : "Continuar projecto",
    rationale: rationale.data || null,
    outcome: isClose
      ? "Projecto encerrado por decisão administrativa independente do estado do entregável. Motivo: " +
        reasonLabel[closureReason.data] +
        "."
      : "Projecto continua em acompanhamento.",
  });

  if (decisionError) fail(path, decisionError.message);

  if (isClose) {
    const { error: closeError } = await supabase
      .from("projects")
      .update({
        status: finalStatus,
        progress: closureReason.data === "completed" ? 100 : 0,
        next_action: null,
      })
      .eq("id", project.id)
      .eq("user_id", user.id);

    if (closeError) fail(path, closeError.message);
  }

  revalidatePath(path);
  revalidatePath("/projects");
  revalidatePath("/deliverables");
  revalidatePath("/projects/" + project.id);
  revalidatePath("/dashboard");
  redirect(path + "?closed=1");
}

export async function upsertCommercialProfile(formData: FormData) {
  const path = "/monetization";
  const parsed = commercialProfileSchema.safeParse(values(formData));
  if (!parsed.success) fail(path, zodMessage(parsed.error));

  const { supabase, user } = await requireAdmin();
  await ensureOwned(supabase, "projects", parsed.data.project_id, user.id, path);

  const payload = { ...parsed.data, user_id: user.id };

  const { error } = await supabase
    .from("project_commercial_profiles")
    .upsert(payload, { onConflict: "project_id" });

  if (error) fail(path, error.message);
  try {
    await syncProjectStrategyExecutionPlan(supabase, user.id, parsed.data.project_id);
  } catch (syncError) {
    fail(path, syncError instanceof Error ? syncError.message : "Perfil guardado, mas o plano não foi actualizado.");
  }
  revalidatePath(path);
  revalidatePath(`/projects/${parsed.data.project_id}`);
  revalidatePath(`/projects/${parsed.data.project_id}/plan`);
  redirect(`${path}?saved=1`);
}

export async function createCommercialLead(formData: FormData) {
  const path = "/monetization";
  const parsed = commercialLeadSchema.safeParse(values(formData));
  if (!parsed.success) fail(path, zodMessage(parsed.error));

  const { supabase, user } = await requireAdmin();
  await ensureOwned(supabase, "projects", parsed.data.project_id, user.id, path);

  const { error } = await supabase.from("commercial_leads").insert({
    ...parsed.data,
    user_id: user.id,
  });

  if (error) fail(path, error.message);
  try {
    await syncProjectStrategyExecutionPlan(supabase, user.id, parsed.data.project_id);
  } catch (syncError) {
    fail(path, syncError instanceof Error ? syncError.message : "Lead criado, mas o plano não foi actualizado.");
  }
  revalidatePath(path);
  revalidatePath(`/projects/${parsed.data.project_id}/plan`);
  redirect(`${path}?lead=created`);
}

export async function createFinancialEntry(formData: FormData) {
  const path = "/monetization";
  const parsed = financialEntrySchema.safeParse(values(formData));
  if (!parsed.success) fail(path, zodMessage(parsed.error));

  const { supabase, user } = await requireAdmin();
  await ensureOwned(supabase, "projects", parsed.data.project_id, user.id, path);

  const { error } = await supabase.from("financial_entries").insert({
    ...parsed.data,
    occurred_on: parsed.data.occurred_on ?? new Date().toISOString().slice(0, 10),
    user_id: user.id,
  });

  if (error) fail(path, error.message);
  revalidatePath(path);
  redirect(`${path}?entry=created`);
}

export async function upsertSubscriptionFunnelMetric(formData: FormData) {
  const path = "/monetization/briefing-diario";
  const parsed = subscriptionFunnelMetricSchema.safeParse(values(formData));
  if (!parsed.success) fail(path, zodMessage(parsed.error));

  const { supabase, user } = await requireAdmin();
  await ensureOwned(supabase, "projects", parsed.data.project_id, user.id, path);

  const payload = {
    ...parsed.data,
    metric_date: parsed.data.metric_date ?? new Date().toISOString().slice(0, 10),
    user_id: user.id,
  };

  const { error } = await supabase
    .from("subscription_funnel_metrics")
    .upsert(payload, { onConflict: "project_id,metric_date" });

  if (error) fail(path, error.message);
  revalidatePath(path);
  redirect(`${path}?saved=1`);
}

export async function createAgentRun(formData: FormData) {
  const path = "/agents";
  const parsed = agentRunSchema.safeParse(values(formData));
  if (!parsed.success) fail(path, zodMessage(parsed.error));

  const { supabase, user } = await requireUser();
  await ensureOwned(supabase, "projects", parsed.data.project_id, user.id, path);

  const { error } = await supabase.from("agent_runs").insert({
    ...parsed.data,
    input_context: {},
    proposed_actions: [],
    status: "draft",
    user_id: user.id,
  });

  if (error) fail(path, error.message);
  revalidatePath(path);
  redirect(`${path}?created=1`);
}

export async function createIntelligenceSignal(formData: FormData) {
  const path = "/intelligence";
  const parsed = intelligenceSignalSchema.safeParse(values(formData));
  if (!parsed.success) fail(path, zodMessage(parsed.error));

  const { supabase, user } = await requireUser();
  await ensureOwned(supabase, "projects", parsed.data.project_id, user.id, path);

  const { error } = await supabase.from("intelligence_signals").insert({
    ...parsed.data,
    user_id: user.id,
  });

  if (error) fail(path, error.message);
  revalidatePath(path);
  revalidatePath("/dashboard");
  redirect(`${path}?created=1`);
}

export async function updateMetricCurrentValue(formData: FormData) {
  const path = "/metrics";
  const id = z.string().uuid().safeParse(formData.get("id"));
  const value = z.coerce.number().finite().safeParse(formData.get("current_value"));

  if (!id.success || !value.success) fail(path, "Valor de métrica inválido.");

  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("metrics")
    .update({
      current_value: value.data,
      measurement_date: new Date().toISOString().slice(0, 10),
    })
    .eq("id", id.data)
    .eq("user_id", user.id);

  if (error) fail(path, error.message);
  revalidatePath(path);
  revalidatePath("/dashboard");
}

export async function updateStatusProgress(formData: FormData) {
  const entityRaw = String(formData.get("entity") ?? "");
  if (!(entityRaw in STATUS_OPTIONS)) return;
  const entity = entityRaw as MutableEntity;
  const path = ENTITY_PATHS[entity];

  const idResult = z.string().uuid().safeParse(formData.get("id"));
  const status = String(formData.get("status") ?? "");
  if (!idResult.success || !(STATUS_OPTIONS[entity] as readonly string[]).includes(status)) {
    fail(path, "Actualização inválida.");
  }

  const payload: Record<string, unknown> = { status };

  if (["objectives", "projects", "deliverables"].includes(entity)) {
    const progress = z.coerce.number().min(0).max(100).safeParse(formData.get("progress"));
    if (!progress.success) fail(path, "Progresso inválido.");
    payload.progress = progress.data;
  }

  const { supabase, user } = await requireUser();

  if (entity === "projects" && status === "active") {
    const { data: approvedBaseline, error: baselineError } = await supabase
      .from("project_commitment_baselines")
      .select("id")
      .eq("project_id", idResult.data)
      .eq("user_id", user.id)
      .eq("status", "client_approved")
      .limit(1)
      .maybeSingle();

    if (baselineError) fail(path, baselineError.message);
    if (!approvedBaseline) {
      fail(path, "O projecto só pode entrar em execução depois do G3 e da validação explícita do cliente ou responsável interno.");
    }
  }

  if (entity === "deliverables") {
    const { data: deliverable, error: deliverableError } = await supabase
      .from("deliverables")
      .select("id,status,completion_criteria,artifact_type,artifact_url,artifact_reference,qa_status,acceptance_status")
      .eq("id", idResult.data)
      .eq("user_id", user.id)
      .maybeSingle();

    if (deliverableError || !deliverable) fail(path, deliverableError?.message ?? "Entregável não encontrado.");

    if (deliverable.status === "completed" && status !== "completed") {
      fail(path, "Entregável entregue está bloqueado. Registe uma nova versão no PCC em vez de alterar o registo final.");
    }

    if (status === "completed") {
      if (Number(payload.progress ?? 0) !== 100) {
        fail(path, "Defina o progresso em 100% antes de marcar o entregável como entregue.");
      }
      if (!deliverable.completion_criteria?.trim()) {
        fail(path, "Defina critérios de aceitação antes de concluir o entregável.");
      }
      if (!["passed", "not_required"].includes(deliverable.qa_status)) {
        fail(path, "O entregável precisa de passar por QA antes de ser concluído.");
      }
      if (!["accepted", "accepted_with_reservations", "not_required"].includes(deliverable.acceptance_status)) {
        fail(path, "Registe a aceitação do entregável antes de o concluir.");
      }

      if (["website", "application", "dashboard", "api"].includes(deliverable.artifact_type)) {
        if (!deliverable.artifact_url?.trim()) {
          fail(path, "Registe o URL oficial do resultado digital antes de concluir o entregável.");
        }
        if (!deliverable.artifact_reference?.trim()) {
          fail(path, "Registe uma referência imutável da versão oficial (deploy, commit ou release) antes de concluir o entregável.");
        }
      }

      const { count, error: evidenceError } = await supabase
        .from("evidence")
        .select("id", { count: "exact", head: true })
        .eq("deliverable_id", deliverable.id)
        .eq("user_id", user.id);

      if (evidenceError) fail(path, evidenceError.message);
      if (!count) {
        fail(path, "Anexe pelo menos uma evidência, ficheiro ou link do resultado utilizável antes de concluir o entregável.");
      }
    }
  }

  if (entity === "actions") {
    payload.completed_at = status === "completed" ? new Date().toISOString() : null;
  }

  if (entity === "blockers") {
    payload.resolved_at = status === "resolved" ? new Date().toISOString() : null;
  }

  const { error } = await supabase
    .from(entity)
    .update(payload)
    .eq("id", idResult.data)
    .eq("user_id", user.id);

  if (error) fail(path, error.message);
  revalidatePath(path);
  revalidatePath("/dashboard");
  revalidatePath("/actions");
  revalidatePath("/deliverables");
}

const deletable = new Set([
  "objectives",
  "projects",
  "deliverables",
  "actions",
  "blockers",
  "ideas",
  "evidence",
  "metrics",
]);

export async function deleteRecord(formData: FormData) {
  const table = String(formData.get("table") ?? "");
  const path = table === "evidence" ? "/evidence" : table === "metrics" ? "/metrics" : `/${table}`;

  if (!deletable.has(table)) fail("/dashboard", "Entidade inválida.");

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) fail(path, "Identificador inválido.");

  const { supabase, user } = await requireUser();

  if (table === "deliverables") {
    const { data: deliverable, error: deliverableError } = await supabase
      .from("deliverables")
      .select("status")
      .eq("id", id.data)
      .eq("user_id", user.id)
      .maybeSingle();

    if (deliverableError) fail(path, deliverableError.message);
    if (deliverable?.status === "completed") {
      fail(path, "Entregáveis finais entregues são arquivos bloqueados e não podem ser eliminados.");
    }
  }

  if (table === "evidence") {
    const { data: proof, error: proofError } = await supabase
      .from("evidence")
      .select("deliverable_id")
      .eq("id", id.data)
      .eq("user_id", user.id)
      .maybeSingle();

    if (proofError) fail(path, proofError.message);
    if (proof?.deliverable_id) {
      const { data: deliverable, error: deliverableError } = await supabase
        .from("deliverables")
        .select("status")
        .eq("id", proof.deliverable_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (deliverableError) fail(path, deliverableError.message);
      if (deliverable?.status === "completed") {
        fail(path, "A evidência de um entregável final está bloqueada e deve permanecer no histórico.");
      }
    }
  }

  const { error } = await supabase
    .from(table)
    .delete()
    .eq("id", id.data)
    .eq("user_id", user.id);

  if (error) fail(path, error.message);
  revalidatePath(path);
  revalidatePath("/dashboard");
  revalidatePath("/actions");
  revalidatePath("/deliverables");
}

export async function startTimeSession(formData: FormData) {
  const path = "/focus";
  const actionId = z.string().uuid().safeParse(formData.get("action_id"));
  if (!actionId.success) fail(path, "Acção inválida.");

  const { supabase, user } = await requireUser();
  await ensureOwned(supabase, "actions", actionId.data, user.id, path);

  const { error } = await supabase.from("time_sessions").insert({
    user_id: user.id,
    action_id: actionId.data,
    started_at: new Date().toISOString(),
  });

  if (error) {
    const message = error.message.includes("unique")
      ? "Já existe uma sessão de trabalho activa. Termine-a antes de iniciar outra."
      : error.message;
    fail(path, message);
  }

  revalidatePath(path);
  revalidatePath("/dashboard");
  redirect(`${path}?started=1`);
}

export async function stopTimeSession(formData: FormData) {
  const path = "/focus";
  const sessionId = z.string().uuid().safeParse(formData.get("session_id"));
  if (!sessionId.success) fail(path, "Sessão inválida.");

  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("time_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", sessionId.data)
    .eq("user_id", user.id)
    .is("ended_at", null);

  if (error) fail(path, error.message);

  revalidatePath(path);
  revalidatePath("/dashboard");
  redirect(`${path}?stopped=1`);
}

export async function setNextAction(formData: FormData) {
  const path = "/actions";
  const actionId = z.string().uuid().safeParse(formData.get("id"));
  if (!actionId.success) fail(path, "Acção inválida.");

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("set_next_action", {
    p_action_id: actionId.data,
  });

  if (error) fail(path, error.message);
  revalidatePath(path);
  revalidatePath("/dashboard");
  revalidatePath("/focus");
}

export async function prepareProjectOperationalStructure(formData: FormData) {
  const projectId = z.string().uuid().safeParse(formData.get("project_id"));
  if (!projectId.success) fail("/projects", "Projecto inválido.");

  const path = `/projects/${projectId.data}`;
  const { supabase, user } = await requireUser();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id,title,description,expected_result,priority,progress,start_date,due_date,notes,next_action,objective_id")
    .eq("id", projectId.data)
    .eq("user_id", user.id)
    .maybeSingle();

  if (projectError || !project) fail(path, projectError?.message ?? "Projecto não encontrado.");

  try {
    await ensureProjectOperationalStructure(supabase, user.id, project);
  } catch (structureError) {
    fail(path, structureError instanceof Error ? structureError.message : "Não foi possível preparar a estrutura operacional.");
  }

  revalidatePath(path);
  revalidatePath("/projects");
  revalidatePath("/objectives");
  revalidatePath("/deliverables");
  revalidatePath("/actions");
  revalidatePath("/metrics");
  revalidatePath("/dashboard");
  redirect(`${path}?prepared=1`);
}

export async function updateProjectNextAction(formData: FormData) {
  const projectId = z.string().uuid().safeParse(formData.get("project_id"));
  const nextAction = z.string().trim().max(500).safeParse(formData.get("next_action") ?? "");

  if (!projectId.success) fail("/projects", "Projecto inválido.");
  const path = `/projects/${projectId.data}`;
  if (!nextAction.success) fail(path, "Próximo passo inválido.");

  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("projects")
    .update({ next_action: nextAction.data || null })
    .eq("id", projectId.data)
    .eq("user_id", user.id);

  if (error) fail(path, error.message);

  revalidatePath(path);
  revalidatePath("/projects");
  revalidatePath("/actions");
  revalidatePath("/dashboard");
  redirect(`${path}?updated=1`);
}
