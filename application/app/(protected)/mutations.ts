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
  projectCommitmentSchema,
  projectCommitmentDecisionSchema,
  projectChangeRequestSchema,
  projectChangeDecisionSchema,
  deliverableQaSchema,
  deliverableAcceptanceSchema,
  projectClosureAssessmentSchema,
  projectGovernanceRiskSchema,
  projectGovernanceRiskUpdateSchema,
  projectGovernanceDependencySchema,
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

function values(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
  throw new Error("Unreachable after redirect");
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
    .select("id,provider,mode,endpoint_hint,model_hint")
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
      last_health_at: new Date().toISOString(),
    })
    .eq("id", provider.id)
    .eq("user_id", user.id);

  if (updateError) fail(path, updateError.message);

  revalidatePath(path);
  redirect(`${path}?health=${result.status}&health_message=${encodeURIComponent(result.message)}`);
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

export async function createProjectGovernanceRisk(formData: FormData) {
  const parsed = projectGovernanceRiskSchema.safeParse(values(formData));
  if (!parsed.success) fail("/projects", zodMessage(parsed.error));
  const path = `/projects/${parsed.data.project_id}`;
  const { supabase, user, authUser } = await requireUser();
  await ensureOwned(supabase, "projects", parsed.data.project_id, user.id, path);
  const { error } = await supabase.from("project_governance_risks").insert({
    ...parsed.data,
    user_id: user.id,
    status: "open",
    owner_id: authUser.id,
  });
  if (error) fail(path, error.message);
  revalidatePath(path);
  revalidatePath(`/projects/${parsed.data.project_id}/commitment`);
  redirect(`${path}?governance_risk=created`);
}

export async function updateProjectGovernanceRisk(formData: FormData) {
  const parsed = projectGovernanceRiskUpdateSchema.safeParse(values(formData));
  if (!parsed.success) fail("/projects", zodMessage(parsed.error));
  const path = `/projects/${parsed.data.project_id}`;
  const { supabase, user } = await requireUser();
  const { data: risk, error: riskError } = await supabase
    .from("project_governance_risks")
    .select("id,severity,blocks_progress")
    .eq("id", parsed.data.risk_id)
    .eq("project_id", parsed.data.project_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (riskError || !risk) fail(path, riskError?.message ?? "Risco de governação inválido.");
  const closesRisk = ["mitigated", "accepted", "resolved"].includes(parsed.data.status);
  const { error } = await supabase
    .from("project_governance_risks")
    .update({
      status: parsed.data.status,
      blocks_progress: closesRisk ? false : risk.blocks_progress,
      mitigation_plan: parsed.data.mitigation_plan ?? null,
      evidence: parsed.data.evidence ?? null,
    })
    .eq("id", risk.id)
    .eq("user_id", user.id);
  if (error) fail(path, error.message);
  revalidatePath(path);
  revalidatePath(`/projects/${parsed.data.project_id}/commitment`);
  redirect(`${path}?governance_risk=${parsed.data.status}`);
}

export async function createProjectGovernanceDependency(formData: FormData) {
  const parsed = projectGovernanceDependencySchema.safeParse(values(formData));
  if (!parsed.success) fail("/projects", zodMessage(parsed.error));
  const path = `/projects/${parsed.data.project_id}`;
  const { supabase, user } = await requireUser();
  await ensureOwned(supabase, "projects", parsed.data.project_id, user.id, path);
  const { error } = await supabase.from("project_governance_dependencies").insert({
    ...parsed.data,
    user_id: user.id,
    status: "pending",
  });
  if (error) fail(path, error.message);
  revalidatePath(path);
  revalidatePath(`/projects/${parsed.data.project_id}/commitment`);
  redirect(`${path}?governance_dependency=created`);
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

  const commercialWorkstreams = new Set(["commercial", "sales", "marketing", "monetization"]);
  const session = commercialWorkstreams.has(parsed.data.workstream) ? await requireAdmin() : await requireUser();
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

export async function createFactoryIntake(formData: FormData) {
  const path = "/project-factory";
  const parsed = factoryIntakeSchema.safeParse(values(formData));
  if (!parsed.success) fail(path, zodMessage(parsed.error));

  const { supabase, user, authUser } = await requireUser();
  const now = new Date().toISOString();
  const { data: factoryCase, error } = await supabase
    .from("project_factory_cases")
    .insert({
      ...parsed.data,
      user_id: user.id,
      stage: "viability",
      competitive_intelligence_required: parsed.data.project_type === "commercial",
      governance_gate: "g2_viability",
      governance_gate_status: "in_progress",
      g1_completed_at: now,
    })
    .select("id")
    .single();

  if (error || !factoryCase) fail(path, error?.message ?? "Não foi possível iniciar a avaliação.");

  const { error: gateEventError } = await supabase.from("project_gate_events").insert([
    {
      user_id: user.id,
      factory_case_id: factoryCase.id,
      gate: "g1_triage",
      event_type: "approved",
      rationale: parsed.data.source === "investment_discovery"
        ? "Oportunidade seleccionada pelo utilizador a partir de um brief de investimento. Segue para validação formal sem assumir viabilidade."
        : "Triagem concluída automaticamente a partir das cinco respostas obrigatórias do One-Pager.",
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

export async function saveProjectCommitment(formData: FormData) {
  const parsed = projectCommitmentSchema.safeParse(values(formData));
  if (!parsed.success) fail("/projects", zodMessage(parsed.error));

  const path = `/projects/${parsed.data.project_id}/commitment`;
  const { supabase, user, authUser } = await requireUser();
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id,governance_gate,governance_gate_status")
    .eq("id", parsed.data.project_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (projectError || !project) fail(path, projectError?.message ?? "Projecto inválido.");

  const [{ data: latest, error: baselineError }, { data: openChanges, error: changesError }] = await Promise.all([
    supabase
      .from("project_commitment_baselines")
      .select("*")
      .eq("project_id", project.id)
      .eq("user_id", user.id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("project_change_requests")
      .select("id,status")
      .eq("project_id", project.id)
      .eq("user_id", user.id)
      .in("status", ["requested", "approved"]),
  ]);
  const existingError = baselineError ?? changesError;
  if (existingError) fail(path, existingError.message);

  if (project.governance_gate === "g4_execution" && latest?.status === "approved" && !(openChanges ?? []).length) {
    fail(path, "Durante a execução, registe primeiro um Pedido de Alteração antes de criar uma nova baseline.");
  }

  if (parsed.data.intent === "submit_client") {
    const [{ data: risks, error: riskError }, { data: dependencies, error: dependencyError }] = await Promise.all([
      supabase
        .from("project_governance_risks")
        .select("id")
        .eq("project_id", project.id)
        .eq("user_id", user.id)
        .eq("gate", "g3_planning")
        .eq("blocks_progress", true)
        .in("status", ["open", "mitigating"]),
      supabase
        .from("project_governance_dependencies")
        .select("id")
        .eq("project_id", project.id)
        .eq("user_id", user.id)
        .eq("gate", "g3_planning")
        .eq("blocks_progress", true)
        .in("status", ["pending", "resolving"]),
    ]);
    const gateError = riskError ?? dependencyError;
    if (gateError) fail(path, gateError.message);
    if ((risks ?? []).length || (dependencies ?? []).length) {
      fail(path, "G3 bloqueado: resolva riscos e dependências críticas antes de apresentar o compromisso ao cliente.");
    }
  }

  const payload = {
    expected_result: parsed.data.expected_result,
    scope_included: parsed.data.scope_included,
    exclusions: parsed.data.exclusions,
    deliverables_summary: parsed.data.deliverables_summary,
    acceptance_summary: parsed.data.acceptance_summary,
    pcc_responsibilities: parsed.data.pcc_responsibilities,
    client_responsibilities: parsed.data.client_responsibilities,
    assumptions_dependencies: parsed.data.assumptions_dependencies,
    capacity_validation: parsed.data.capacity_validation,
    financial_validation: parsed.data.financial_validation,
    security_validation: parsed.data.security_validation,
    external_costs_note: parsed.data.external_costs_note,
    validation_milestones: parsed.data.validation_milestones ?? null,
    payment_terms: parsed.data.payment_terms ?? null,
    asset_ownership_terms: parsed.data.asset_ownership_terms ?? null,
    intellectual_property_terms: parsed.data.intellectual_property_terms ?? null,
    post_delivery_terms: parsed.data.post_delivery_terms ?? null,
    capacity_required_hours: parsed.data.capacity_required_hours ?? null,
    capacity_available_hours: parsed.data.capacity_available_hours ?? null,
    capacity_period: parsed.data.capacity_period ?? null,
    estimated_pcc_cost: parsed.data.estimated_pcc_cost ?? null,
    minimum_margin_pct: parsed.data.minimum_margin_pct,
    margin_exception_approved: parsed.data.margin_exception_approved,
    margin_exception_rationale: parsed.data.margin_exception_rationale ?? null,
    price: parsed.data.price ?? null,
    currency: parsed.data.currency ?? null,
    due_date: parsed.data.due_date ?? null,
    status: parsed.data.intent === "submit_client" ? "awaiting_client" : "draft",
    pcc_validated_at: parsed.data.intent === "submit_client" ? new Date().toISOString() : null,
  };

  if (latest && ["draft", "awaiting_client"].includes(latest.status)) {
    const { error } = await supabase
      .from("project_commitment_baselines")
      .update(payload)
      .eq("id", latest.id)
      .eq("user_id", user.id);
    if (error) fail(path, error.message);
  } else {
    const { error } = await supabase.from("project_commitment_baselines").insert({
      ...payload,
      project_id: project.id,
      user_id: user.id,
      version: Number(latest?.version ?? 0) + 1,
      created_by: authUser.id,
    });
    if (error) fail(path, error.message);
  }

  if (parsed.data.intent === "submit_client") {
    const { error: projectUpdateError } = await supabase
      .from("projects")
      .update({ governance_gate: "g3_planning", governance_gate_status: "ready" })
      .eq("id", project.id)
      .eq("user_id", user.id);
    if (projectUpdateError) fail(path, projectUpdateError.message);
  }
  revalidatePath(path);
  revalidatePath(`/projects/${project.id}`);
  redirect(`${path}?${parsed.data.intent === "submit_client" ? "submitted" : "saved"}=1`);
}

export async function recordProjectCommitmentDecision(formData: FormData) {
  const parsed = projectCommitmentDecisionSchema.safeParse(values(formData));
  if (!parsed.success) fail("/projects", zodMessage(parsed.error));
  const path = `/projects/${parsed.data.project_id}/commitment`;
  const { supabase, user, authUser } = await requireUser();
  const { data: baseline, error: baselineError } = await supabase
    .from("project_commitment_baselines")
    .select("id,project_id,status,version")
    .eq("id", parsed.data.baseline_id)
    .eq("project_id", parsed.data.project_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (baselineError || !baseline) fail(path, baselineError?.message ?? "Baseline inválida.");
  if (baseline.status !== "awaiting_client") fail(path, "Apenas uma baseline apresentada ao cliente pode ser validada.");

  if (parsed.data.decision === "approved") {
    const { error: supersedeError } = await supabase
      .from("project_commitment_baselines")
      .update({ status: "superseded" })
      .eq("project_id", baseline.project_id)
      .eq("user_id", user.id)
      .eq("status", "approved")
      .neq("id", baseline.id);
    if (supersedeError) fail(path, supersedeError.message);
  }

  const { error: updateError } = await supabase
    .from("project_commitment_baselines")
    .update({
      status: parsed.data.decision,
      client_validator: parsed.data.client_validator,
      approval_reference: parsed.data.approval_reference ?? null,
      client_notes: parsed.data.notes ?? null,
      client_validated_at: new Date().toISOString(),
    })
    .eq("id", baseline.id)
    .eq("user_id", user.id);
  if (updateError) fail(path, updateError.message);

  const gateStatus = parsed.data.decision === "approved" ? "approved" : "blocked";
  const { error: projectUpdateError } = await supabase
    .from("projects")
    .update({ governance_gate: "g3_planning", governance_gate_status: gateStatus })
    .eq("id", baseline.project_id)
    .eq("user_id", user.id);
  if (projectUpdateError) fail(path, projectUpdateError.message);

  const { error: eventError } = await supabase.from("project_gate_events").insert({
    user_id: user.id,
    project_id: baseline.project_id,
    gate: "g3_planning",
    event_type: parsed.data.decision === "approved" ? "approved" : "blocked",
    decision: parsed.data.decision === "approved" ? "go" : "modify",
    rationale: parsed.data.notes || `Cliente ${parsed.data.decision === "approved" ? "aprovou" : "rejeitou"} a baseline v${baseline.version}.`,
    created_by: authUser.id,
  });
  if (eventError) fail(path, eventError.message);
  revalidatePath(path);
  revalidatePath(`/projects/${baseline.project_id}`);
  redirect(`${path}?client_decision=${parsed.data.decision}`);
}

export async function createProjectChangeRequest(formData: FormData) {
  const parsed = projectChangeRequestSchema.safeParse(values(formData));
  if (!parsed.success) fail("/projects", zodMessage(parsed.error));
  const path = `/projects/${parsed.data.project_id}/commitment`;
  const { supabase, user } = await requireUser();
  await ensureOwned(supabase, "projects", parsed.data.project_id, user.id, path);
  const { data: baseline, error: baselineError } = await supabase
    .from("project_commitment_baselines")
    .select("id,version")
    .eq("project_id", parsed.data.project_id)
    .eq("user_id", user.id)
    .eq("status", "approved")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (baselineError || !baseline) fail(path, baselineError?.message ?? "Não existe baseline aprovada para alterar.");
  const { error } = await supabase.from("project_change_requests").insert({
    ...parsed.data,
    user_id: user.id,
    baseline_id: baseline.id,
    baseline_version: baseline.version,
    status: "requested",
  });
  if (error) fail(path, error.message);
  revalidatePath(path);
  redirect(`${path}?change=created`);
}

export async function decideProjectChangeRequest(formData: FormData) {
  const parsed = projectChangeDecisionSchema.safeParse(values(formData));
  if (!parsed.success) fail("/projects", zodMessage(parsed.error));
  const path = `/projects/${parsed.data.project_id}/commitment`;
  const { supabase, user } = await requireUser();
  const { data: request, error: requestError } = await supabase
    .from("project_change_requests")
    .select("id,status,baseline_version")
    .eq("id", parsed.data.change_request_id)
    .eq("project_id", parsed.data.project_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (requestError || !request) fail(path, requestError?.message ?? "Pedido de alteração inválido.");
  if (parsed.data.decision === "implemented") {
    if (request.status !== "approved") fail(path, "Apenas alterações aprovadas podem ser marcadas como implementadas.");
    const { data: revisedBaseline, error: revisedError } = await supabase
      .from("project_commitment_baselines")
      .select("id")
      .eq("project_id", parsed.data.project_id)
      .eq("user_id", user.id)
      .eq("status", "approved")
      .gt("version", request.baseline_version)
      .limit(1)
      .maybeSingle();
    if (revisedError) fail(path, revisedError.message);
    if (!revisedBaseline) fail(path, "Antes de implementar a alteração, obtenha aprovação do cliente para uma nova baseline.");
  }
  const { error } = await supabase
    .from("project_change_requests")
    .update({
      status: parsed.data.decision,
      decision_rationale: parsed.data.decision_rationale,
      decided_at: new Date().toISOString(),
    })
    .eq("id", request.id)
    .eq("user_id", user.id);
  if (error) fail(path, error.message);
  revalidatePath(path);
  redirect(`${path}?change=${parsed.data.decision}`);
}

export async function recordDeliverableQa(formData: FormData) {
  const parsed = deliverableQaSchema.safeParse(values(formData));
  if (!parsed.success) fail("/deliverables", zodMessage(parsed.error));
  const path = `/deliverables?project_id=${parsed.data.project_id}`;
  const { supabase, user } = await requireUser();
  const { data: deliverable, error: deliverableError } = await supabase
    .from("deliverables")
    .select("id,status")
    .eq("id", parsed.data.deliverable_id)
    .eq("project_id", parsed.data.project_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (deliverableError || !deliverable) fail(path, deliverableError?.message ?? "Entregável inválido.");
  if (deliverable.status === "completed") fail(path, "O QA de um entregável final já bloqueado não pode ser alterado.");
  const { error } = await supabase
    .from("deliverables")
    .update({ qa_status: parsed.data.qa_status, qa_notes: parsed.data.qa_notes ?? null, qa_checked_at: new Date().toISOString() })
    .eq("id", deliverable.id)
    .eq("user_id", user.id);
  if (error) fail(path, error.message);
  revalidatePath("/deliverables");
  redirect(`${path}&qa=${parsed.data.qa_status}`);
}

export async function recordDeliverableAcceptance(formData: FormData) {
  const parsed = deliverableAcceptanceSchema.safeParse(values(formData));
  if (!parsed.success) fail("/deliverables", zodMessage(parsed.error));
  const path = `/deliverables?project_id=${parsed.data.project_id}`;
  const { supabase, user } = await requireUser();
  const { data: deliverable, error: deliverableError } = await supabase
    .from("deliverables")
    .select("id,status,artifact_version")
    .eq("id", parsed.data.deliverable_id)
    .eq("project_id", parsed.data.project_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (deliverableError || !deliverable) fail(path, deliverableError?.message ?? "Entregável inválido.");
  if (deliverable.status !== "completed") fail(path, "A aceitação só pode ser registada depois da entrega oficial.");
  const { error } = await supabase.from("deliverable_acceptance_events").insert({
    user_id: user.id,
    project_id: parsed.data.project_id,
    deliverable_id: deliverable.id,
    deliverable_version: deliverable.artifact_version ?? 1,
    status: parsed.data.status,
    actor_type: "client",
    actor_name: parsed.data.actor_name,
    notes: parsed.data.notes ?? null,
    evidence_reference: parsed.data.evidence_reference ?? null,
  });
  if (error) fail(path, error.message);
  revalidatePath("/deliverables");
  redirect(`${path}&acceptance=${parsed.data.status}`);
}

export async function upsertProjectClosureAssessment(formData: FormData) {
  const parsed = projectClosureAssessmentSchema.safeParse(values(formData));
  if (!parsed.success) fail("/deliverables", zodMessage(parsed.error));
  const path = `/projects/${parsed.data.project_id}/commitment`;
  const { supabase, user } = await requireUser();
  await ensureOwned(supabase, "projects", parsed.data.project_id, user.id, path);
  const { error } = await supabase.from("project_closure_assessments").upsert(
    { ...parsed.data, user_id: user.id, updated_at: new Date().toISOString() },
    { onConflict: "project_id" },
  );
  if (error) fail(path, error.message);
  revalidatePath(path);
  revalidatePath("/deliverables");
  redirect(`${path}?closure=saved`);
}

export async function finalizeProjectClosure(formData: FormData) {
  const path = "/deliverables";
  const projectId = z.string().uuid().safeParse(formData.get("project_id"));
  const decision = z.enum(["continue", "close"]).safeParse(formData.get("decision"));
  const rationale = z.string().trim().max(5000).safeParse(formData.get("rationale") ?? "");
  if (!projectId.success || !decision.success || !rationale.success) fail(path, "Decisão final inválida.");

  const { supabase, user, authUser } = await requireUser();
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id,title,status")
    .eq("id", projectId.data)
    .eq("user_id", user.id)
    .maybeSingle();
  if (projectError || !project) fail(path, projectError?.message ?? "Projecto inválido.");

  if (decision.data === "close") {
    const [
      { data: deliverables, error: deliverablesError },
      { data: blockers, error: blockersError },
      { data: evidence, error: evidenceError },
      { data: acceptanceEvents, error: acceptanceError },
      { data: blockingRisks, error: risksError },
      { data: blockingDependencies, error: dependenciesError },
      { data: openChanges, error: changesError },
      { data: baseline, error: baselineError },
      { data: closure, error: closureError },
    ] = await Promise.all([
      supabase.from("deliverables").select("id,status,completion_criteria,locked_at").eq("project_id", project.id).eq("user_id", user.id),
      supabase.from("blockers").select("id").eq("project_id", project.id).eq("user_id", user.id).in("status", ["open", "investigating", "waiting"]),
      supabase.from("evidence").select("deliverable_id").eq("project_id", project.id).eq("user_id", user.id).not("deliverable_id", "is", null),
      supabase.from("deliverable_acceptance_events").select("deliverable_id,status,created_at").eq("project_id", project.id).eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("project_governance_risks").select("id").eq("project_id", project.id).eq("user_id", user.id).eq("blocks_progress", true).in("status", ["open", "mitigating"]),
      supabase.from("project_governance_dependencies").select("id").eq("project_id", project.id).eq("user_id", user.id).eq("blocks_progress", true).in("status", ["pending", "resolving"]),
      supabase.from("project_change_requests").select("id").eq("project_id", project.id).eq("user_id", user.id).in("status", ["requested", "approved"]),
      supabase.from("project_commitment_baselines").select("id").eq("project_id", project.id).eq("user_id", user.id).eq("status", "approved").order("version", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("project_closure_assessments").select("*").eq("project_id", project.id).eq("user_id", user.id).maybeSingle(),
    ]);
    const gateError = deliverablesError ?? blockersError ?? evidenceError ?? acceptanceError ?? risksError ?? dependenciesError ?? changesError ?? baselineError ?? closureError;
    if (gateError) fail(path, gateError.message);
    if (!baseline) fail(path, "G5 bloqueado: não existe uma baseline de compromisso aprovada.");
    if (!(deliverables ?? []).length) fail(path, "O projecto não pode fechar sem entregáveis definidos.");
    if ((deliverables ?? []).some((item) => item.status !== "completed")) fail(path, "Existem entregáveis ainda não entregues/validados.");
    if ((deliverables ?? []).some((item) => !item.locked_at)) fail(path, "Existem entregáveis finais ainda não arquivados de forma imutável.");
    const evidenceIds = new Set((evidence ?? []).map((item) => item.deliverable_id).filter(Boolean));
    if ((deliverables ?? []).some((item) => !evidenceIds.has(item.id))) fail(path, "Todos os entregáveis precisam de evidência antes do fecho.");
    const latestAcceptance = new Map<string, string>();
    for (const event of acceptanceEvents ?? []) if (!latestAcceptance.has(event.deliverable_id)) latestAcceptance.set(event.deliverable_id, event.status);
    if ((deliverables ?? []).some((item) => !["accepted", "accepted_with_reservations"].includes(latestAcceptance.get(item.id) ?? ""))) {
      fail(path, "Todos os entregáveis precisam de aceitação do cliente antes do fecho.");
    }
    if ((blockers ?? []).length) fail(path, "Resolva os bloqueios activos antes de fechar o projecto.");
    if ((blockingRisks ?? []).length) fail(path, "G5 bloqueado: existem riscos bloqueantes por resolver.");
    if ((blockingDependencies ?? []).length) fail(path, "G5 bloqueado: existem dependências críticas por resolver.");
    if ((openChanges ?? []).length) fail(path, "G5 bloqueado: existem alterações de âmbito ainda abertas.");
    if (!closure) fail(path, "Preencha a avaliação de valor, handover e segurança antes do fecho.");
    if (!closure.client_acceptance_complete) fail(path, "Confirme a aceitação global do cliente.");
    if (!closure.changes_closed) fail(path, "Confirme que todas as alterações de âmbito estão encerradas.");
    if (!closure.financials_updated) fail(path, "Actualize o financeiro antes do fecho.");
    if (!closure.data_retention_reviewed) fail(path, "Reveja arquivo e retenção de dados antes do fecho.");
    if (!closure.value_status || closure.value_status === "not_assessed") fail(path, "Registe o estado do valor alcançado antes do fecho.");
    if (closure.handover_required && (!closure.handover_complete || !closure.access_transfer_complete || !closure.temporary_access_revoked)) {
      fail(path, "Conclua handover, transferência de acessos e revogação de acessos temporários.");
    }
  }

  const { error: decisionError } = await supabase.from("decisions").insert({
    user_id: user.id,
    project_id: project.id,
    title: decision.data === "close" ? `Fecho · ${project.title}` : `Continuidade · ${project.title}`,
    decision: decision.data === "close" ? "Encerrar projecto" : "Continuar projecto",
    rationale: rationale.data || null,
    outcome: decision.data === "close" ? "Projecto fechado após entrega, evidência, aceitação, valor e transferência segura." : "Projecto continua em acompanhamento.",
  });
  if (decisionError) fail(path, decisionError.message);

  if (decision.data === "close") {
    const { error: closeError } = await supabase
      .from("projects")
      .update({ status: "completed", progress: 100, next_action: null, governance_gate: "g5_closure", governance_gate_status: "completed" })
      .eq("id", project.id)
      .eq("user_id", user.id);
    if (closeError) fail(path, closeError.message);
    const { error: eventError } = await supabase.from("project_gate_events").insert({
      user_id: user.id,
      project_id: project.id,
      gate: "g5_closure",
      event_type: "completed",
      decision: "go",
      rationale: rationale.data || "Fecho aprovado após validação dos critérios G5.",
      created_by: authUser.id,
    });
    if (eventError) fail(path, eventError.message);
  }
  revalidatePath(path);
  revalidatePath("/projects");
  revalidatePath(`/projects/${project.id}`);
  revalidatePath(`/projects/${project.id}/commitment`);
  revalidatePath("/dashboard");
  redirect(`${path}?project_id=${project.id}&${decision.data === "close" ? "closed=1" : "created=1"}`);
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
  await ensureOwned(supabase, "deliverables", parsed.data.related_deliverable_id, user.id, path);

  if (
    parsed.data.entry_type === "cost" &&
    parsed.data.status === "actual" &&
    ["client_direct", "reimbursable_external", "additional_scope"].includes(parsed.data.cost_classification ?? "") &&
    !parsed.data.client_approved
  ) {
    fail(path, "Antes de realizar o custo externo/adicional, registe a aprovação do cliente.");
  }

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

  const { supabase, user, authUser } = await requireUser();
  let enteringExecution = false;

  if (entity === "projects") {
    const { data: currentProject, error: projectError } = await supabase
      .from("projects")
      .select("id,status,governance_gate,governance_gate_status")
      .eq("id", idResult.data)
      .eq("user_id", user.id)
      .maybeSingle();

    if (projectError || !currentProject) fail(path, projectError?.message ?? "Projecto não encontrado.");
    if (status === "completed") {
      fail(path, "O projecto só pode ser encerrado pelo Gate G5 em Entregáveis & Fecho.");
    }

    if (status === "active" && currentProject.governance_gate === "g3_planning") {
      const [
        { data: baseline, error: baselineError },
        { data: blockingRisks, error: risksError },
        { data: blockingDependencies, error: dependenciesError },
      ] = await Promise.all([
        supabase
          .from("project_commitment_baselines")
          .select("id,status")
          .eq("project_id", currentProject.id)
          .eq("user_id", user.id)
          .eq("status", "approved")
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("project_governance_risks")
          .select("id")
          .eq("project_id", currentProject.id)
          .eq("user_id", user.id)
          .eq("gate", "g3_planning")
          .eq("blocks_progress", true)
          .in("status", ["open", "mitigating"]),
        supabase
          .from("project_governance_dependencies")
          .select("id")
          .eq("project_id", currentProject.id)
          .eq("user_id", user.id)
          .eq("gate", "g3_planning")
          .eq("blocks_progress", true)
          .in("status", ["pending", "resolving"]),
      ]);
      const gateError = baselineError ?? risksError ?? dependenciesError;
      if (gateError) fail(path, gateError.message);
      if (!baseline) fail(path, "G3 bloqueado: o cliente ainda não aprovou o compromisso de entrega.");
      if ((blockingRisks ?? []).length || (blockingDependencies ?? []).length) {
        fail(path, "G3 bloqueado: existem riscos ou dependências críticas por resolver.");
      }
      payload.governance_gate = "g4_execution";
      payload.governance_gate_status = "in_progress";
      enteringExecution = true;
    }
  }

  if (entity === "deliverables") {
    const { data: deliverable, error: deliverableError } = await supabase
      .from("deliverables")
      .select("id,status,completion_criteria,artifact_type,artifact_url,artifact_reference,qa_status")
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
      if (deliverable.qa_status !== "passed") {
        fail(path, "O QA do entregável precisa estar aprovado antes da entrega.");
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

  if (entity === "projects" && enteringExecution) {
    const { error: gateEventError } = await supabase.from("project_gate_events").insert({
      user_id: user.id,
      project_id: idResult.data,
      gate: "g4_execution",
      event_type: "entered",
      rationale: "Execução iniciada após validação interna PCC e aprovação explícita do compromisso pelo cliente.",
      created_by: authUser.id,
    });
    if (gateEventError) fail(path, gateEventError.message);
  }

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
