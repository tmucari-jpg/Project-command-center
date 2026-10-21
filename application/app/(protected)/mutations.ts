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
import { prepareDeliverableDraft, prepareMetricDraft, prepareObjectiveDraft, type ProjectAutonomyContext } from "@/lib/project-autonomy";

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
  if (!parsed.success) fail(path, zodMessage(parsed.error));

  const projectId = z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().uuid().optional(),
  ).safeParse(formData.get("project_id"));

  if (!projectId.success) fail(path, "Projecto inválido.");

  const { supabase, user } = await requireUser();
  if (projectId.data) {
    await ensureOwned(supabase, "projects", projectId.data, user.id, path);
  }

  const { data: objective, error } = await supabase
    .from("objectives")
    .insert({
      ...parsed.data,
      status: projectId.data ? "active" : parsed.data.status,
      user_id: user.id,
    })
    .select("id")
    .single();

  if (error || !objective) fail(path, error?.message ?? "Não foi possível criar o Objectivo Central.");

  if (projectId.data) {
    const { error: projectError } = await supabase
      .from("projects")
      .update({ objective_id: objective.id })
      .eq("id", projectId.data)
      .eq("user_id", user.id);

    if (projectError) fail(path, projectError.message);
    revalidatePath(`/projects/${projectId.data}`);
  }

  revalidatePath(path);
  revalidatePath("/projects");
  revalidatePath("/metrics");
  revalidatePath("/dashboard");
  redirect(`${path}?created=1${projectId.data ? `&project_id=${projectId.data}` : ""}`);
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
  priority: ProjectAutonomyContext["priority"];
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
  let objectiveContext: {
    id: string;
    title: string | null;
    expected_result: string | null;
    metric_name: string | null;
    baseline_value: number | null;
    target_value: number | null;
    current_value: number | null;
  } | null = null;

  if (!objectiveId) {
    const objectiveDraft = prepareObjectiveDraft(project);
    if (!objectiveDraft) throw new Error("Não foi possível preparar o Objectivo Central.");

    const { data: objective, error } = await supabase
      .from("objectives")
      .insert({
        user_id: userId,
        ...objectiveDraft,
        status: "active",
        progress: 0,
      })
      .select("id,title,expected_result,metric_name,baseline_value,target_value,current_value")
      .single();

    if (error || !objective) throw new Error(error?.message ?? "Não foi possível preparar o Objectivo Central.");
    objectiveId = objective.id;
    objectiveContext = objective;

    const { error: linkError } = await supabase
      .from("projects")
      .update({ objective_id: objectiveId })
      .eq("id", project.id)
      .eq("user_id", userId);

    if (linkError) throw new Error(linkError.message);
  } else {
    const { data: objective, error: objectiveError } = await supabase
      .from("objectives")
      .select("id,title,expected_result,metric_name,baseline_value,target_value,current_value")
      .eq("id", objectiveId)
      .eq("user_id", userId)
      .maybeSingle();

    if (objectiveError) throw new Error(objectiveError.message);
    objectiveContext = objective;
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

  if (!deliverableId) {
    const deliverableDraft = prepareDeliverableDraft(project);
    if (deliverableDraft) {
      const { data: deliverable, error } = await supabase
        .from("deliverables")
        .insert({
          user_id: userId,
          ...deliverableDraft,
          status: "pending",
          progress: 0,
        })
        .select("id")
        .single();

      if (error || !deliverable) throw new Error(error?.message ?? "Não foi possível preparar o entregável.");
      deliverableId = deliverable.id;
    }
  }

  const { count: actionCount, error: actionCountError } = await supabase
    .from("actions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("project_id", project.id);

  if (actionCountError) throw new Error(actionCountError.message);

  if ((actionCount ?? 0) === 0 && project.next_action?.trim()) {
    const { error } = await supabase.from("actions").insert({
      user_id: userId,
      project_id: project.id,
      deliverable_id: deliverableId,
      title: project.next_action.trim(),
      description: project.description,
      priority: project.priority,
      status: "pending",
      due_at: project.due_date ? `${project.due_date}T17:00:00` : null,
      completion_criteria: project.expected_result,
      is_next_action: true,
    });
    if (error) throw new Error(error.message);
  }

  const { count: metricCount, error: metricCountError } = await supabase
    .from("metrics")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("project_id", project.id);

  if (metricCountError) throw new Error(metricCountError.message);

  if ((metricCount ?? 0) === 0 && objectiveContext?.metric_name?.trim()) {
    const metricDraft = prepareMetricDraft(project, objectiveContext);
    if (metricDraft) {
      const { error } = await supabase.from("metrics").insert({
        user_id: userId,
        ...metricDraft,
        objective_id: objectiveId,
      });
      if (error) throw new Error(error.message);
    }
  }

  await syncProjectStrategyExecutionPlan(supabase, userId, project.id);
  return { objectiveId, deliverableId };
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
