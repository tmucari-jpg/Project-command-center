"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import {
  botIAOperationLabel,
  botIAPlanSchema,
  validateBotIAOperation,
  type BotIAOperation,
} from "@/lib/bot-ia";
import { generateBotIAPlan, type BotIAProviderProfile } from "@/lib/bot-ia-provider";
import { validateAIProviderHealth } from "@/lib/ai-provider-health";

const prepareSchema = z.object({
  projectId: z.string().uuid(),
  blockerId: z.string().uuid().optional(),
  objective: z.string().trim().min(3).max(4000),
});

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Falha desconhecida.";
}

function sanitizeOperations(
  operations: BotIAOperation[],
  validBlockerIds: Set<string>,
  selectedBlockerId?: string,
) {
  return operations.filter((operation) => {
    if (!validateBotIAOperation(operation)) return false;

    if (operation.kind === "update_blocker" || operation.kind === "resolve_blocker") {
      if (!operation.target_id || !validBlockerIds.has(operation.target_id)) return false;
      if (selectedBlockerId && operation.target_id !== selectedBlockerId) return false;
    }

    if (operation.kind === "update_blocker" && operation.status === "resolved") return false;

    return true;
  });
}

async function resolveBotIAProvider(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  userId: string,
) {
  const { data: providers, error } = await supabase
    .from("ai_provider_profiles")
    .select("id,provider,label,mode,enabled,priority,cost_class,endpoint_hint,model_hint,last_health_status")
    .eq("user_id", userId)
    .order("priority", { ascending: true });

  if (error) throw new Error(error.message);
  if (!providers?.length) {
    throw new Error("Nenhum provider de IA está registado na Administração.");
  }

  const alreadyHealthy = providers.find(
    (provider) => provider.enabled && provider.last_health_status === "healthy",
  );
  if (alreadyHealthy) return alreadyHealthy;

  for (const provider of providers) {
    const health = await validateAIProviderHealth(provider);
    const enabled = health.status === "healthy";

    const { error: updateError } = await supabase
      .from("ai_provider_profiles")
      .update({
        enabled,
        last_health_status: health.status,
        last_health_at: new Date().toISOString(),
      })
      .eq("id", provider.id)
      .eq("user_id", userId);

    if (updateError) throw new Error(updateError.message);

    if (enabled) {
      return {
        ...provider,
        enabled: true,
        last_health_status: "healthy" as const,
      };
    }
  }

  throw new Error("Nenhum provider de IA respondeu como saudável. Valide a configuração na Administração.");
}

export async function prepareBotIARun(input: {
  projectId: string;
  blockerId?: string;
  objective: string;
}) {
  const parsed = prepareSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Pedido inválido." };
  }

  try {
    const { supabase, user } = await requireAdmin();

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id,title,description,expected_result,priority,status,progress,next_action,notes,owner_id,next_review_date,governance_gate,governance_gate_status")
      .eq("id", parsed.data.projectId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (projectError) throw new Error(projectError.message);
    if (!project) throw new Error("Projecto não encontrado.");

    const [
      { data: actions, error: actionsError },
      { data: deliverables, error: deliverablesError },
      { data: blockers, error: blockersError },
      { data: evidence, error: evidenceError },
      { data: decisions, error: decisionsError },
    ] = await Promise.all([
      supabase
        .from("actions")
        .select("id,title,description,priority,status,completion_criteria,is_next_action,due_at")
        .eq("user_id", user.id)
        .eq("project_id", project.id)
        .in("status", ["pending", "in_progress", "blocked"])
        .order("created_at", { ascending: false })
        .limit(15),
      supabase
        .from("deliverables")
        .select("id,title,status,progress,due_date")
        .eq("user_id", user.id)
        .eq("project_id", project.id)
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("blockers")
        .select("id,title,description,impact,responsible,status,solution,resolution_due_at")
        .eq("user_id", user.id)
        .eq("project_id", project.id)
        .order("created_at", { ascending: false })
        .limit(15),
      supabase
        .from("evidence")
        .select("id,evidence_type,title,description,url,numeric_value,created_at")
        .eq("user_id", user.id)
        .eq("project_id", project.id)
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("decisions")
        .select("id,title,decision,rationale,decided_at")
        .eq("user_id", user.id)
        .eq("project_id", project.id)
        .order("decided_at", { ascending: false })
        .limit(8),
    ]);

    const queryError =
      actionsError ?? deliverablesError ?? blockersError ?? evidenceError ?? decisionsError;
    if (queryError) throw new Error(queryError.message);

    const selectedBlocker = parsed.data.blockerId
      ? (blockers ?? []).find((item) => item.id === parsed.data.blockerId)
      : undefined;

    if (parsed.data.blockerId && !selectedBlocker) {
      throw new Error("O bloqueio seleccionado não pertence ao projecto.");
    }

    const provider = await resolveBotIAProvider(supabase, user.id);

    const factualContext = {
      user_objective: parsed.data.objective,
      project: {
        id: project.id,
        title: project.title,
        description: project.description,
        expected_result: project.expected_result,
        priority: project.priority,
        status: project.status,
        progress: project.progress,
        next_action: project.next_action,
        notes: project.notes,
        next_review_date: project.next_review_date,
        governance_gate: project.governance_gate,
        governance_gate_status: project.governance_gate_status,
      },
      selected_blocker: selectedBlocker ?? null,
      open_actions: actions ?? [],
      deliverables: deliverables ?? [],
      blockers: blockers ?? [],
      recent_evidence: evidence ?? [],
      recent_decisions: decisions ?? [],
    };

    const rawPlan = await generateBotIAPlan(
      {
        provider: provider.provider,
        label: provider.label,
        mode: provider.mode,
        endpoint_hint: provider.endpoint_hint,
        model_hint: provider.model_hint,
      } satisfies BotIAProviderProfile,
      factualContext,
    );

    const validBlockerIds = new Set((blockers ?? []).map((item) => item.id));
    const operations = sanitizeOperations(
      rawPlan.operations,
      validBlockerIds,
      parsed.data.blockerId,
    );

    const plan = botIAPlanSchema.parse({
      ...rawPlan,
      operations,
    });

    const now = new Date().toISOString();
    const status = plan.operations.length ? "ready" : "passed";
    const qaStatus = plan.operations.length ? "not_checked" : "pass";
    const qaEvidence = plan.operations.length
      ? []
      : [{ type: "analysis_only", message: "Nenhuma alteração segura foi proposta." }];

    const { data: run, error: runError } = await supabase
      .from("agent_runs")
      .insert({
        user_id: user.id,
        project_id: project.id,
        agent_type: "command",
        prompt_code: "BOTIA",
        objective: parsed.data.objective,
        input_context: {
          provider: {
            provider: provider.provider,
            label: provider.label,
            mode: provider.mode,
            model: provider.model_hint,
          },
          selected_blocker_id: parsed.data.blockerId ?? null,
          summary: plan.summary,
          diagnosis: plan.diagnosis,
        },
        proposed_actions: plan.operations,
        status,
        qa_status: qaStatus,
        qa_evidence: qaEvidence,
        started_at: now,
        completed_at: plan.operations.length ? null : now,
      })
      .select("id")
      .single();

    if (runError || !run) throw new Error(runError?.message ?? "Falha ao registar execução BotIA.");

    if (plan.operations.length) {
      const { error: stepError } = await supabase.from("execution_steps").insert(
        plan.operations.map((operation, index) => ({
          user_id: user.id,
          project_id: project.id,
          agent_run_id: run.id,
          sequence_no: index + 1,
          title: botIAOperationLabel(operation),
          step_type: "write",
          requires_approval: false,
          status: "pending",
        })),
      );

      if (stepError) {
        await supabase
          .from("agent_runs")
          .update({ status: "failed", error_message: stepError.message })
          .eq("id", run.id)
          .eq("user_id", user.id);
        throw new Error(stepError.message);
      }
    }

    revalidatePath("/bot-ia");
    revalidatePath("/ai-providers");

    return {
      ok: true as const,
      runId: run.id,
      provider: provider.label,
      summary: plan.summary,
      diagnosis: plan.diagnosis,
      operations: plan.operations,
    };
  } catch (error) {
    return { ok: false as const, error: errorMessage(error) };
  }
}

export async function applyBotIARun(runId: string) {
  const parsedRunId = z.string().uuid().safeParse(runId);
  if (!parsedRunId.success) {
    return { ok: false as const, error: "Execução BotIA inválida." };
  }

  try {
    const { supabase, user } = await requireAdmin();

    const { data: run, error: runError } = await supabase
      .from("agent_runs")
      .select("id,project_id,objective,proposed_actions,status,qa_status")
      .eq("id", parsedRunId.data)
      .eq("user_id", user.id)
      .eq("prompt_code", "BOTIA")
      .maybeSingle();

    if (runError) throw new Error(runError.message);
    if (!run || !run.project_id) throw new Error("Execução BotIA não encontrada.");

    if (run.status === "passed") {
      return { ok: true as const, runId: run.id, applied: [], alreadyApplied: true };
    }

    if (!["ready", "failed"].includes(run.status)) {
      throw new Error("A execução BotIA ainda não está pronta para aplicação.");
    }

    const operationsResult = z.array(botIAPlanSchema.shape.operations.element).safeParse(
      run.proposed_actions,
    );
    if (!operationsResult.success) throw new Error("Plano BotIA armazenado é inválido.");

    const { data: steps, error: stepsError } = await supabase
      .from("execution_steps")
      .select("id,sequence_no,status")
      .eq("agent_run_id", run.id)
      .eq("user_id", user.id)
      .order("sequence_no", { ascending: true });

    if (stepsError) throw new Error(stepsError.message);

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id,notes")
      .eq("id", run.project_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (projectError || !project) {
      throw new Error(projectError?.message ?? "Projecto da execução não encontrado.");
    }

    const { data: projectBlockers, error: blockersError } = await supabase
      .from("blockers")
      .select("id")
      .eq("project_id", run.project_id)
      .eq("user_id", user.id);

    if (blockersError) throw new Error(blockersError.message);
    const validBlockerIds = new Set((projectBlockers ?? []).map((item) => item.id));

    let currentNotes = project.notes ?? "";
    const applied: Array<{ operation: string; entity?: string; id?: string }> = [];

    await supabase
      .from("agent_runs")
      .update({ status: "running", error_message: null, started_at: new Date().toISOString() })
      .eq("id", run.id)
      .eq("user_id", user.id);

    for (let index = 0; index < operationsResult.data.length; index += 1) {
      const operation = operationsResult.data[index];
      const step = (steps ?? []).find((item) => item.sequence_no === index + 1);

      if (step?.status === "completed") continue;

      if (step) {
        await supabase
          .from("execution_steps")
          .update({ status: "running" })
          .eq("id", step.id)
          .eq("user_id", user.id);
      }

      try {
        let result: { entity?: string; id?: string; operation: string } = {
          operation: operation.kind,
        };

        if (operation.kind === "create_action") {
          if (!operation.title) throw new Error("Acção BotIA sem título.");

          const { data: existing } = await supabase
            .from("actions")
            .select("id")
            .eq("user_id", user.id)
            .eq("project_id", run.project_id)
            .eq("title", operation.title)
            .in("status", ["pending", "in_progress", "blocked"])
            .limit(1)
            .maybeSingle();

          if (existing) {
            result = { operation: operation.kind, entity: "actions", id: existing.id };
          } else {
            const { data: created, error } = await supabase
              .from("actions")
              .insert({
                user_id: user.id,
                project_id: run.project_id,
                title: operation.title,
                description: operation.description,
                priority: operation.priority ?? "medium",
                status: "pending",
                due_at: null,
                completion_criteria: operation.completion_criteria,
                is_next_action: false,
              })
              .select("id")
              .single();

            if (error || !created) throw new Error(error?.message ?? "Falha ao criar acção.");
            result = { operation: operation.kind, entity: "actions", id: created.id };
          }
        }

        if (operation.kind === "set_project_next_action") {
          if (!operation.value) throw new Error("Próxima acção vazia.");
          const { error } = await supabase
            .from("projects")
            .update({ next_action: operation.value })
            .eq("id", run.project_id)
            .eq("user_id", user.id);
          if (error) throw new Error(error.message);
          result = { operation: operation.kind, entity: "projects", id: run.project_id };
        }

        if (operation.kind === "append_project_note") {
          if (!operation.value) throw new Error("Nota BotIA vazia.");
          if (!currentNotes.includes(operation.value)) {
            currentNotes = `${currentNotes ? `${currentNotes}\n\n` : ""}[BotIA] ${operation.value}`;
            const { error } = await supabase
              .from("projects")
              .update({ notes: currentNotes })
              .eq("id", run.project_id)
              .eq("user_id", user.id);
            if (error) throw new Error(error.message);
          }
          result = { operation: operation.kind, entity: "projects", id: run.project_id };
        }

        if (operation.kind === "create_blocker") {
          if (!operation.title) throw new Error("Bloqueio BotIA sem título.");

          const { data: existing } = await supabase
            .from("blockers")
            .select("id")
            .eq("user_id", user.id)
            .eq("project_id", run.project_id)
            .eq("title", operation.title)
            .in("status", ["open", "investigating", "waiting"])
            .limit(1)
            .maybeSingle();

          if (existing) {
            result = { operation: operation.kind, entity: "blockers", id: existing.id };
          } else {
            const { data: created, error } = await supabase
              .from("blockers")
              .insert({
                user_id: user.id,
                project_id: run.project_id,
                title: operation.title,
                description: operation.description,
                impact: operation.impact,
                solution: operation.solution,
                status: "open",
              })
              .select("id")
              .single();

            if (error || !created) throw new Error(error?.message ?? "Falha ao criar bloqueio.");
            result = { operation: operation.kind, entity: "blockers", id: created.id };
          }
        }

        if (operation.kind === "update_blocker") {
          if (!operation.target_id || !validBlockerIds.has(operation.target_id)) {
            throw new Error("Bloqueio BotIA inválido.");
          }

          const update: Record<string, unknown> = {};
          if (operation.solution) update.solution = operation.solution;
          if (operation.status && operation.status !== "resolved") update.status = operation.status;
          if (!Object.keys(update).length) throw new Error("Actualização de bloqueio vazia.");

          const { error } = await supabase
            .from("blockers")
            .update(update)
            .eq("id", operation.target_id)
            .eq("project_id", run.project_id)
            .eq("user_id", user.id);

          if (error) throw new Error(error.message);
          result = { operation: operation.kind, entity: "blockers", id: operation.target_id };
        }

        if (operation.kind === "resolve_blocker") {
          if (!operation.target_id || !validBlockerIds.has(operation.target_id) || !operation.solution) {
            throw new Error("Resolução de bloqueio BotIA inválida.");
          }

          const { error } = await supabase
            .from("blockers")
            .update({
              solution: operation.solution,
              status: "resolved",
              resolved_at: new Date().toISOString(),
            })
            .eq("id", operation.target_id)
            .eq("project_id", run.project_id)
            .eq("user_id", user.id);

          if (error) throw new Error(error.message);
          result = { operation: operation.kind, entity: "blockers", id: operation.target_id };
        }

        applied.push(result);

        if (step) {
          await supabase
            .from("execution_steps")
            .update({
              status: "completed",
              result,
              evidence: { persisted: true, entity: result.entity, id: result.id },
              completed_at: new Date().toISOString(),
            })
            .eq("id", step.id)
            .eq("user_id", user.id);
        }
      } catch (error) {
        const message = errorMessage(error);

        if (step) {
          await supabase
            .from("execution_steps")
            .update({ status: "failed", result: { error: message } })
            .eq("id", step.id)
            .eq("user_id", user.id);
        }

        await supabase
          .from("agent_runs")
          .update({ status: "failed", qa_status: "fail", error_message: message })
          .eq("id", run.id)
          .eq("user_id", user.id);

        throw error;
      }
    }

    const completedAt = new Date().toISOString();
    const { error: finalError } = await supabase
      .from("agent_runs")
      .update({
        status: "passed",
        qa_status: "pass",
        qa_evidence: applied.map((item) => ({ ...item, persisted: true })),
        error_message: null,
        completed_at: completedAt,
      })
      .eq("id", run.id)
      .eq("user_id", user.id);

    if (finalError) throw new Error(finalError.message);

    revalidatePath("/bot-ia");
    revalidatePath("/agents");
    revalidatePath(`/projects/${run.project_id}`);
    revalidatePath("/actions");
    revalidatePath("/blockers");
    revalidatePath("/dashboard");
    revalidatePath("/focus");

    return { ok: true as const, runId: run.id, applied, alreadyApplied: false };
  } catch (error) {
    return { ok: false as const, error: errorMessage(error) };
  }
}
