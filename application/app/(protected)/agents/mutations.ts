"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { analyseWorkforce, type ActionSnapshot, type BlockerSnapshot, type ProjectSnapshot } from "@/lib/agent-workforce";

const path = "/agents";
const uuid = z.string().uuid();
const proposalSchema = z.object({
  kind: z.enum(["set_next_action", "create_action"]),
  target_id: uuid,
  title: z.string().min(2).max(180),
  reason: z.string().max(1000),
  agent: z.enum(["planeamento", "prioridades"]),
});

function fail(message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function runWorkforce() {
  const { supabase, user } = await requireUser();
  const [projectsResult, actionsResult, blockersResult, pendingResult] = await Promise.all([
    supabase.from("projects").select("id,title,status,priority,due_date,next_action,updated_at").eq("user_id", user.id).limit(201),
    supabase.from("actions").select("id,project_id,title,status,priority,due_at,is_next_action,updated_at").eq("user_id", user.id).limit(201),
    supabase.from("blockers").select("id,project_id,action_id,title,status").eq("user_id", user.id).limit(201),
    supabase.from("ai_commands").select("id,parameters").eq("user_id", user.id).eq("intent", "agent_proposal").eq("status", "pending").limit(201),
  ]);

  if (projectsResult.error || actionsResult.error || blockersResult.error || pendingResult.error) {
    fail("Não foi possível ler os dados da equipa agêntica.");
  }
  if ([projectsResult.data, actionsResult.data, blockersResult.data, pendingResult.data].some((items) => !items || items.length > 200)) {
    fail("Há mais de 200 registos numa categoria. Reduza o volume antes de executar a análise completa.");
  }

  const analysis = analyseWorkforce(
    projectsResult.data as ProjectSnapshot[],
    actionsResult.data as ActionSnapshot[],
    blockersResult.data as BlockerSnapshot[],
    new Date().toISOString().slice(0, 10),
  );

  const existing = new Set((pendingResult.data ?? []).map((item) => {
    const params = proposalSchema.safeParse(item.parameters);
    return params.success ? `${params.data.kind}:${params.data.target_id}` : "";
  }));
  const fresh = analysis.proposals.filter((proposal) => !existing.has(`${proposal.kind}:${proposal.target_id}`));

  const { error: reportError } = await supabase.from("ai_interactions").insert({
    user_id: user.id,
    command: "Executar força agêntica",
    intent: "workforce_report",
    response: JSON.stringify({ findings: analysis.findings, generated_at: new Date().toISOString() }),
    model: "regras-v1",
  });
  if (reportError) fail("Não foi possível guardar o relatório da análise.");

  if (fresh.length) {
    const { error } = await supabase.from("ai_commands").insert(fresh.map((proposal) => ({
      user_id: user.id,
      command: proposal.title,
      intent: "agent_proposal",
      parameters: proposal,
      status: "pending",
    })));
    if (error) fail("O relatório foi guardado, mas não foi possível guardar as propostas.");
  }
  revalidatePath(path);
  redirect(`${path}?updated=1`);
}

export async function decideProposal(formData: FormData) {
  const id = uuid.safeParse(formData.get("id"));
  const decision = z.enum(["approve", "reject"]).safeParse(formData.get("decision"));
  if (!id.success || !decision.success) fail("Decisão inválida.");
  const { supabase, user } = await requireUser();
  const { data: proposal, error: readError } = await supabase.from("ai_commands")
    .select("id,parameters,status,intent")
    .eq("id", id.data).eq("user_id", user.id).maybeSingle();
  if (readError || !proposal || proposal.status !== "pending" || proposal.intent !== "agent_proposal") {
    fail("Esta proposta já foi decidida ou não está disponível.");
  }
  const parsed = proposalSchema.safeParse(proposal.parameters);
  if (!parsed.success) fail("A proposta guardada é inválida.");

  // Claim the pending row once, so a double click cannot execute it twice.
  const nextStatus = decision.data === "reject" ? "cancelled" : "processing";
  const { data: claimed, error: claimError } = await supabase.from("ai_commands")
    .update({ status: nextStatus, completed_at: decision.data === "reject" ? new Date().toISOString() : null })
    .eq("id", id.data).eq("user_id", user.id).eq("status", "pending")
    .select("id").maybeSingle();
  if (claimError || !claimed) fail("A proposta foi alterada entretanto. Actualize a página.");

  if (decision.data === "reject") {
    revalidatePath(path);
    redirect(`${path}?rejected=1`);
  }

  const item = parsed.data;
  let operationError: string | null = null;
  if (item.kind === "set_next_action") {
    const { data: action, error } = await supabase.from("actions")
      .select("id,title,status,project_id").eq("id", item.target_id).eq("user_id", user.id).maybeSingle();
    const { data: blockers, error: blockerError } = await supabase.from("blockers")
      .select("id").eq("user_id", user.id).eq("action_id", item.target_id)
      .in("status", ["open", "investigating", "waiting"]).limit(1);
    const projectResult = action?.project_id ? await supabase.from("projects")
      .select("status").eq("id", action.project_id).eq("user_id", user.id).maybeSingle() : null;
    if (error || blockerError || projectResult?.error || !action || !["pending", "in_progress"].includes(action.status) ||
        (projectResult && !["planning", "active", "at_risk"].includes(projectResult.data?.status ?? "")) ||
        action.title !== item.title || (blockers?.length ?? 0) > 0) {
      operationError = "A acção mudou desde a análise. Execute uma nova análise.";
    } else {
      const { error: setError } = await supabase.rpc("set_next_action", { p_action_id: action.id });
      operationError = setError?.message ?? null;
    }
  } else {
    const { data: project, error } = await supabase.from("projects")
      .select("id,status,priority,next_action").eq("id", item.target_id).eq("user_id", user.id).maybeSingle();
    const { data: open, error: openError } = await supabase.from("actions")
      .select("id").eq("user_id", user.id).eq("project_id", item.target_id)
      .in("status", ["pending", "in_progress"]).limit(1);
    if (error || openError || !project || !["planning", "active", "at_risk"].includes(project.status) ||
        project.next_action?.trim().slice(0, 180) !== item.title || (open?.length ?? 0) > 0) {
      operationError = "O projecto mudou desde a análise. Execute uma nova análise.";
    } else {
      const { error: insertError } = await supabase.from("actions").insert({
        user_id: user.id, project_id: project.id, title: item.title,
        priority: project.priority, status: "pending", is_next_action: false,
      });
      operationError = insertError?.message ?? null;
    }
  }

  const { error: finalError } = await supabase.from("ai_commands").update({
    status: operationError ? "failed" : "completed",
    error_message: operationError,
    result: operationError ? null : { kind: item.kind, target_id: item.target_id },
    completed_at: new Date().toISOString(),
  }).eq("id", id.data).eq("user_id", user.id).eq("status", "processing");
  if (finalError) fail("A operação foi executada, mas o registo do resultado falhou. Verifique as Acções.");
  if (operationError) fail(operationError);
  revalidatePath(path);
  revalidatePath("/dashboard");
  revalidatePath("/actions");
  revalidatePath("/focus");
  redirect(`${path}?approved=1`);
}
