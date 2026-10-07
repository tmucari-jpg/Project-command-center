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
import { requireUser } from "@/lib/auth";
import { selectExecutionRoute } from "@/lib/orchestrator";
import { createN8nCallback, dispatchToN8n } from "@/lib/n8n";

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
  const parsed = automationWorkflowSchema.safeParse(values(formData));
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
  const parsed = executionArenaTrialSchema.safeParse(values(formData));
  if (!parsed.success) fail(path, zodMessage(parsed.error));

  const { supabase, user } = await requireUser();
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

  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("objectives").insert({
    ...parsed.data,
    user_id: user.id,
  });

  if (error) fail(path, error.message);
  revalidatePath(path);
  revalidatePath("/dashboard");
  redirect(`${path}?created=1`);
}

export async function createProject(formData: FormData) {
  const path = "/projects";
  const parsed = projectSchema.safeParse(values(formData));
  if (!parsed.success) fail(path, zodMessage(parsed.error));

  const { supabase, user } = await requireUser();
  await ensureOwned(supabase, "objectives", parsed.data.objective_id, user.id, path);

  const { error } = await supabase.from("projects").insert({
    ...parsed.data,
    user_id: user.id,
  });

  if (error) fail(path, error.message);
  revalidatePath(path);
  revalidatePath("/dashboard");
  redirect(`${path}?created=1`);
}

export async function createDeliverable(formData: FormData) {
  const path = "/deliverables";
  const parsed = deliverableSchema.safeParse(values(formData));
  if (!parsed.success) fail(path, zodMessage(parsed.error));

  const { supabase, user } = await requireUser();
  await ensureOwned(supabase, "projects", parsed.data.project_id, user.id, path);

  const { error } = await supabase.from("deliverables").insert({
    ...parsed.data,
    user_id: user.id,
  });

  if (error) fail(path, error.message);
  revalidatePath(path);
  revalidatePath("/dashboard");
  redirect(`${path}?created=1`);
}

export async function createAction(formData: FormData) {
  const path = "/actions";
  const parsed = actionSchema.safeParse(values(formData));
  if (!parsed.success) fail(path, zodMessage(parsed.error));

  const { supabase, user } = await requireUser();
  await ensureOwned(supabase, "projects", parsed.data.project_id, user.id, path);
  await ensureOwned(supabase, "deliverables", parsed.data.deliverable_id, user.id, path);

  if (parsed.data.deliverable_id) {
    const { data: deliverable } = await supabase
      .from("deliverables")
      .select("project_id")
      .eq("id", parsed.data.deliverable_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (
      deliverable?.project_id &&
      parsed.data.project_id &&
      deliverable.project_id !== parsed.data.project_id
    ) {
      fail(path, "O entregável seleccionado não pertence ao projecto seleccionado.");
    }
  }

  const wantsNextAction = parsed.data.is_next_action;
  const { data: createdAction, error } = await supabase
    .from("actions")
    .insert({
      ...parsed.data,
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
  await ensureOwned(supabase, "projects", parsed.data.project_id, user.id, path);
  await ensureOwned(supabase, "deliverables", parsed.data.deliverable_id, user.id, path);
  await ensureOwned(supabase, "actions", parsed.data.action_id, user.id, path);

  const { error } = await supabase.from("blockers").insert({
    ...parsed.data,
    user_id: user.id,
  });

  if (error) fail(path, error.message);
  revalidatePath(path);
  revalidatePath("/dashboard");
  redirect(`${path}?created=1`);
}

export async function saveFactoryReport(formData: FormData) {
  const parsed = factoryReportSchema.safeParse(values(formData));
  const fallbackPath = "/project-factory";
  if (!parsed.success) fail(fallbackPath, zodMessage(parsed.error));

  const path = `/project-factory/${parsed.data.factory_case_id}`;
  const { supabase, user } = await requireUser();
  await ensureOwned(supabase, "project_factory_cases", parsed.data.factory_case_id, user.id, path);

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
  const { supabase, user } = await requireUser();

  const { data: factoryCase, error: caseError } = await supabase
    .from("project_factory_cases")
    .select("*")
    .eq("id", parsed.data.factory_case_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (caseError || !factoryCase) fail(path, "Caso da Factory não encontrado.");

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
        })
        .select("id")
        .single();

      if (projectError || !project) {
        fail(path, projectError?.message ?? "Não foi possível criar o projecto.");
      }
      projectId = project.id;
    }

    const { error: stageError } = await supabase
      .from("project_factory_cases")
      .update({ stage: "converted_to_project", project_id: projectId })
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

    const { error: stageError } = await supabase
      .from("project_factory_cases")
      .update({ stage: nextStage })
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
  const parsed = factoryValidationSchema.safeParse(values(formData));
  const fallbackPath = "/project-factory";
  if (!parsed.success) fail(fallbackPath, zodMessage(parsed.error));

  const path = `/project-factory/${parsed.data.factory_case_id}`;
  const { supabase, user } = await requireUser();
  await ensureOwned(supabase, "project_factory_cases", parsed.data.factory_case_id, user.id, path);

  const { arena_required, ...validation } = parsed.data;
  const { error } = await supabase
    .from("factory_validations")
    .upsert(
      {
        ...validation,
        arena_required,
        user_id: user.id,
        status: "complete",
        completed_at: new Date().toISOString(),
      },
      { onConflict: "factory_case_id" },
    );

  if (error) fail(path, error.message);

  const nextStage =
    parsed.data.recommendation === "modify"
      ? "validation"
      : parsed.data.recommendation === "hold"
        ? "on_hold"
        : arena_required
          ? "execution_arena"
          : "factory_report";

  const { error: stageError } = await supabase
    .from("project_factory_cases")
    .update({ stage: nextStage })
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

  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("project_factory_cases").insert({
    ...parsed.data,
    user_id: user.id,
    stage: "viability",
    competitive_intelligence_required: parsed.data.project_type === "commercial",
  });

  if (error) fail(path, error.message);
  revalidatePath(path);
  redirect(`${path}?created=1`);
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
  await ensureOwned(supabase, "projects", parsed.data.project_id, user.id, path);
  await ensureOwned(supabase, "deliverables", parsed.data.deliverable_id, user.id, path);
  await ensureOwned(supabase, "actions", parsed.data.action_id, user.id, path);

  const { error } = await supabase.from("evidence").insert({
    ...parsed.data,
    user_id: user.id,
  });

  if (error) fail(path, error.message);
  revalidatePath(path);
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

export async function upsertCommercialProfile(formData: FormData) {
  const path = "/monetization";
  const parsed = commercialProfileSchema.safeParse(values(formData));
  if (!parsed.success) fail(path, zodMessage(parsed.error));

  const { supabase, user } = await requireUser();
  await ensureOwned(supabase, "projects", parsed.data.project_id, user.id, path);

  const payload = { ...parsed.data, user_id: user.id };

  const { error } = await supabase
    .from("project_commercial_profiles")
    .upsert(payload, { onConflict: "project_id" });

  if (error) fail(path, error.message);
  revalidatePath(path);
  revalidatePath(`/projects/${parsed.data.project_id}`);
  redirect(`${path}?saved=1`);
}

export async function createCommercialLead(formData: FormData) {
  const path = "/monetization";
  const parsed = commercialLeadSchema.safeParse(values(formData));
  if (!parsed.success) fail(path, zodMessage(parsed.error));

  const { supabase, user } = await requireUser();
  await ensureOwned(supabase, "projects", parsed.data.project_id, user.id, path);

  const { error } = await supabase.from("commercial_leads").insert({
    ...parsed.data,
    user_id: user.id,
  });

  if (error) fail(path, error.message);
  revalidatePath(path);
  redirect(`${path}?lead=created`);
}

export async function createFinancialEntry(formData: FormData) {
  const path = "/monetization";
  const parsed = financialEntrySchema.safeParse(values(formData));
  if (!parsed.success) fail(path, zodMessage(parsed.error));

  const { supabase, user } = await requireUser();
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

  const { supabase, user } = await requireUser();
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

  if (entity === "actions") {
    payload.completed_at = status === "completed" ? new Date().toISOString() : null;
  }

  if (entity === "blockers") {
    payload.resolved_at = status === "resolved" ? new Date().toISOString() : null;
  }

  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from(entity)
    .update(payload)
    .eq("id", idResult.data)
    .eq("user_id", user.id);

  if (error) fail(path, error.message);
  revalidatePath(path);
  revalidatePath("/dashboard");
  revalidatePath("/focus");
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
  const { error } = await supabase
    .from(table)
    .delete()
    .eq("id", id.data)
    .eq("user_id", user.id);

  if (error) fail(path, error.message);
  revalidatePath(path);
  revalidatePath("/dashboard");
  revalidatePath("/focus");
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
