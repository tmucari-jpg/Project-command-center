import { NextResponse } from "next/server";
import { z } from "zod";
import { actionSchema, blockerSchema, evidenceSchema, factoryIntakeSchema, ideaSchema } from "@/lib/validation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const itemSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(["create_action", "create_idea", "create_evidence", "create_blocker", "create_factory_intake", "update_action_status", "update_project_next_action"]),
  payload: z.record(z.string(), z.unknown()),
});
const requestSchema = z.object({ items: z.array(itemSchema).max(100) });

function validatedPayload(item: z.infer<typeof itemSchema>) {
  const p = item.payload;
  const relation = { project_id: p.project_id ?? "", deliverable_id: p.deliverable_id ?? "", action_id: p.action_id ?? "" };
  switch (item.type) {
    case "create_action": return actionSchema.parse({ ...p, ...relation, priority: p.priority ?? "medium", status: "pending", due_at: p.due_at ?? "", estimated_minutes: p.estimated_minutes ?? "", completion_criteria: p.completion_criteria ?? "", is_next_action: false });
    case "create_idea": return ideaSchema.parse({ ...p, ...relation, priority: p.priority ?? "medium", status: "captured", source: p.source ?? "Modo offline", potential: p.potential ?? "", next_decision: p.next_decision ?? "" });
    case "create_evidence": return evidenceSchema.parse({ ...p, ...relation, evidence_type: p.evidence_type ?? "comment", url: p.url ?? "", storage_path: "", numeric_value: "" });
    case "create_blocker": return blockerSchema.parse({ ...p, ...relation, status: "open", impact: p.impact ?? "", responsible: p.responsible ?? "", resolution_due_at: p.resolution_due_at ?? "", solution: "" });
    case "create_factory_intake": return factoryIntakeSchema.parse({ ...p, project_type: p.project_type ?? "commercial", description: p.description ?? "", target_user: p.target_user ?? "", expected_value: p.expected_value ?? "", constraints: p.constraints ?? "", source: p.source ?? "offline_intake" });
    case "update_action_status": return z.object({ action_id: z.string().uuid(), status: z.enum(["pending", "in_progress", "blocked", "completed", "cancelled"]) }).parse(p);
    case "update_project_next_action": return z.object({ project_id: z.string().uuid(), next_action: z.string().trim().min(1).max(2000) }).parse(p);
  }
}
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  const db = await createClient();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Sessão necessária." }, { status: 401 });
  const body = requestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Fila offline inválida." }, { status: 400 });
  const results: Array<{ id: string; ok: boolean; error?: string }> = [];
  for (const item of body.data.items) {
    try {
      const payload = validatedPayload(item);
      const { error } = await db.rpc("apply_offline_item_atomic", { p_id: item.id, p_type: item.type, p_payload: payload });
      if (error) {
        results.push({ id: item.id, ok: false, error: "Não foi possível confirmar esta operação. O registo permanece na fila para nova tentativa." });
      } else results.push({ id: item.id, ok: true });
    } catch {
      results.push({ id: item.id, ok: false, error: "Dados offline inválidos. Reveja o registo antes de sincronizar." });
    }
  }
  return NextResponse.json({ results }, { headers: { "Cache-Control": "private, no-store" } });
}
