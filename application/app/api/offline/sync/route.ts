import { NextResponse } from "next/server";
import { z } from "zod";
import { actionSchema, blockerSchema, evidenceSchema, ideaSchema } from "@/lib/validation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const itemSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(["create_action", "create_idea", "create_evidence", "create_blocker", "update_action_status"]),
  payload: z.record(z.string(), z.unknown()),
  createdAt: z.string().optional(),
  status: z.string().optional(),
});

const requestSchema = z.object({ items: z.array(itemSchema).max(100) });
const actionStatuses = new Set(["pending", "in_progress", "blocked", "completed", "cancelled"]);

async function owned(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: "projects" | "deliverables" | "actions",
  id: string | undefined,
  userId: string,
) {
  if (!id) return true;
  const { data } = await supabase.from(table).select("id").eq("id", id).eq("user_id", userId).maybeSingle();
  return Boolean(data);
}

async function duplicateBelongsToUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: "actions" | "ideas" | "evidence" | "blockers",
  id: string,
  userId: string,
) {
  const { data } = await supabase.from(table).select("id").eq("id", id).eq("user_id", userId).maybeSingle();
  return Boolean(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Sessão necessária." }, { status: 401 });
  }

  const body = requestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Fila offline inválida." }, { status: 400 });

  const results: Array<{ id: string; ok: boolean; error?: string }> = [];

  for (const item of body.data.items) {
    try {
      const { data: receipt } = await supabase
        .from("sync_queue")
        .select("id,status")
        .eq("id", item.id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (receipt?.status === "synced") {
        results.push({ id: item.id, ok: true });
        continue;
      }

      let entityType = "";
      let entityId: string | null = null;
      let projectId: string | null = null;
      let operation: "create" | "update" = "create";

      if (item.type === "create_idea") {
        const parsed = ideaSchema.safeParse({
          ...item.payload,
          priority: item.payload.priority ?? "medium",
          status: "captured",
          project_id: item.payload.project_id ?? "",
          source: item.payload.source ?? "Modo offline",
          potential: item.payload.potential ?? "",
          next_decision: item.payload.next_decision ?? "",
        });
        if (!parsed.success) throw new Error("Ideia offline inválida.");
        if (!(await owned(supabase, "projects", parsed.data.project_id, user.id))) throw new Error("Projecto inválido.");

        const { error } = await supabase.from("ideas").insert({ id: item.id, ...parsed.data, user_id: user.id });
        if (error && !(error.code === "23505" && await duplicateBelongsToUser(supabase, "ideas", item.id, user.id))) throw error;
        entityType = "idea";
        entityId = item.id;
        projectId = parsed.data.project_id ?? null;
      }

      if (item.type === "create_action") {
        const parsed = actionSchema.safeParse({
          ...item.payload,
          project_id: item.payload.project_id ?? "",
          deliverable_id: item.payload.deliverable_id ?? "",
          priority: item.payload.priority ?? "medium",
          status: "pending",
          due_at: item.payload.due_at ?? "",
          estimated_minutes: item.payload.estimated_minutes ?? "",
          completion_criteria: item.payload.completion_criteria ?? "",
          is_next_action: false,
        });
        if (!parsed.success) throw new Error("Acção offline inválida.");

        let resolvedProjectId = parsed.data.project_id;
        if (!(await owned(supabase, "projects", resolvedProjectId, user.id))) throw new Error("Projecto inválido.");
        if (!(await owned(supabase, "deliverables", parsed.data.deliverable_id, user.id))) throw new Error("Entregável inválido.");

        if (parsed.data.deliverable_id) {
          const { data: deliverable } = await supabase.from("deliverables").select("project_id").eq("id", parsed.data.deliverable_id).eq("user_id", user.id).maybeSingle();
          if (!deliverable) throw new Error("Entregável inválido.");
          if (resolvedProjectId && deliverable.project_id && resolvedProjectId !== deliverable.project_id) throw new Error("Relação projecto/entregável inválida.");
          resolvedProjectId = deliverable.project_id ?? resolvedProjectId;
        }

        const { error } = await supabase.from("actions").insert({
          id: item.id,
          ...parsed.data,
          project_id: resolvedProjectId,
          is_next_action: false,
          user_id: user.id,
        });
        if (error && !(error.code === "23505" && await duplicateBelongsToUser(supabase, "actions", item.id, user.id))) throw error;
        entityType = "action";
        entityId = item.id;
        projectId = resolvedProjectId ?? null;
      }

      if (item.type === "create_evidence") {
        const parsed = evidenceSchema.safeParse({
          ...item.payload,
          action_id: item.payload.action_id ?? "",
          deliverable_id: item.payload.deliverable_id ?? "",
          project_id: item.payload.project_id ?? "",
          evidence_type: item.payload.evidence_type ?? "comment",
          url: item.payload.url ?? "",
          storage_path: "",
          numeric_value: "",
        });
        if (!parsed.success) throw new Error("Evidência offline inválida.");

        let resolvedProjectId = parsed.data.project_id;
        let resolvedDeliverableId = parsed.data.deliverable_id;

        if (!(await owned(supabase, "actions", parsed.data.action_id, user.id))) throw new Error("Acção inválida.");
        if (parsed.data.action_id) {
          const { data: action } = await supabase.from("actions").select("project_id,deliverable_id").eq("id", parsed.data.action_id).eq("user_id", user.id).maybeSingle();
          if (!action) throw new Error("Acção inválida.");
          resolvedProjectId = action.project_id ?? resolvedProjectId;
          resolvedDeliverableId = action.deliverable_id ?? resolvedDeliverableId;
        }

        const { error } = await supabase.from("evidence").insert({
          id: item.id,
          ...parsed.data,
          project_id: resolvedProjectId,
          deliverable_id: resolvedDeliverableId,
          user_id: user.id,
        });
        if (error && !(error.code === "23505" && await duplicateBelongsToUser(supabase, "evidence", item.id, user.id))) throw error;
        entityType = "evidence";
        entityId = item.id;
        projectId = resolvedProjectId ?? null;
      }

      if (item.type === "create_blocker") {
        const parsed = blockerSchema.safeParse({
          ...item.payload,
          action_id: item.payload.action_id ?? "",
          deliverable_id: item.payload.deliverable_id ?? "",
          project_id: item.payload.project_id ?? "",
          status: "open",
          impact: item.payload.impact ?? "",
          responsible: item.payload.responsible ?? "",
          resolution_due_at: item.payload.resolution_due_at ?? "",
          solution: "",
        });
        if (!parsed.success) throw new Error("Bloqueio offline inválido.");

        let resolvedProjectId = parsed.data.project_id;
        let resolvedDeliverableId = parsed.data.deliverable_id;
        if (!(await owned(supabase, "actions", parsed.data.action_id, user.id))) throw new Error("Acção inválida.");

        if (parsed.data.action_id) {
          const { data: action } = await supabase.from("actions").select("project_id,deliverable_id").eq("id", parsed.data.action_id).eq("user_id", user.id).maybeSingle();
          if (!action) throw new Error("Acção inválida.");
          resolvedProjectId = action.project_id ?? resolvedProjectId;
          resolvedDeliverableId = action.deliverable_id ?? resolvedDeliverableId;
        }

        const { error } = await supabase.from("blockers").insert({
          id: item.id,
          ...parsed.data,
          project_id: resolvedProjectId,
          deliverable_id: resolvedDeliverableId,
          user_id: user.id,
        });
        if (error && !(error.code === "23505" && await duplicateBelongsToUser(supabase, "blockers", item.id, user.id))) throw error;
        entityType = "blocker";
        entityId = item.id;
        projectId = resolvedProjectId ?? null;
      }

      if (item.type === "update_action_status") {
        const actionId = z.string().uuid().parse(item.payload.action_id);
        const status = z.string().parse(item.payload.status);
        if (!actionStatuses.has(status)) throw new Error("Estado inválido.");
        if (!(await owned(supabase, "actions", actionId, user.id))) throw new Error("Acção inválida.");

        const { data: action, error } = await supabase
          .from("actions")
          .update({ status })
          .eq("id", actionId)
          .eq("user_id", user.id)
          .select("project_id")
          .single();
        if (error) throw error;
        entityType = "action";
        entityId = actionId;
        projectId = action.project_id ?? null;
        operation = "update";
      }

      const { error: queueError } = await supabase.from("sync_queue").upsert({
        id: item.id,
        user_id: user.id,
        project_id: projectId,
        entity_type: entityType,
        entity_id: entityId,
        operation,
        payload: item.payload,
        status: "synced",
        attempts: 1,
        synced_at: new Date().toISOString(),
      });

      if (queueError) throw queueError;
      results.push({ id: item.id, ok: true });
    } catch (error) {
      results.push({ id: item.id, ok: false, error: error instanceof Error ? error.message : "Falha de sincronização." });
    }
  }

  return NextResponse.json({ results });
}
