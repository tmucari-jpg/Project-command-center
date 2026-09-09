"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  actionSchema,
  blockerSchema,
  deliverableSchema,
  evidenceSchema,
  ideaSchema,
  metricSchema,
  objectiveSchema,
  projectSchema,
  zodMessage,
} from "@/lib/validation";
import { ENTITY_PATHS, STATUS_OPTIONS, type MutableEntity } from "@/lib/constants";
import { requireUser } from "@/lib/auth";

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
