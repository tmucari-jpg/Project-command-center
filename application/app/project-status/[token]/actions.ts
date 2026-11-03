"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { hashProjectClientStatusToken } from "@/lib/project-client-status";
import { createPublicClient } from "@/lib/supabase/public";

export async function submitProjectClientStatusDecision(formData: FormData) {
  const token = z.string().regex(/^[A-Za-z0-9_-]{43,200}$/).safeParse(formData.get("token"));
  const decision = z.enum(["approve", "change", "clarification"]).safeParse(formData.get("decision"));
  const respondentName = z.string().trim().min(2).max(200).safeParse(formData.get("respondent_name"));
  const comment = z.string().trim().max(3500).safeParse(formData.get("comment") ?? "");
  const deliverableId = z.string().uuid().optional().safeParse(formData.get("deliverable_id") || undefined);

  if (!token.success || !decision.success || !respondentName.success || !comment.success || !deliverableId.success) {
    redirect("/project-status/invalid?error=Revise%20a%20resposta.");
  }

  const supabase = createPublicClient();
  let validatedComment = comment.data;
  if (deliverableId.data) {
    const lookup = await supabase.rpc("project_client_status_lookup", { p_token_hash: hashProjectClientStatusToken(token.data) });
    const snapshot = Array.isArray(lookup.data) ? lookup.data[0] : null;
    const item = Array.isArray(snapshot?.deliverables) ? snapshot.deliverables.find((row: { id?: string; title?: string }) => row.id === deliverableId.data) : null;
    if (lookup.error || !item) redirect(`/project-status/${encodeURIComponent(token.data)}?error=${encodeURIComponent("Entregável indisponível neste link.")}`);
    validatedComment = `[Entregável: ${item.title} | ID: ${deliverableId.data}] ${comment.data}`;
  }
  const { data, error } = await supabase.rpc("project_client_status_submit", {
    p_token_hash: hashProjectClientStatusToken(token.data),
    p_decision: decision.data,
    p_respondent_name: respondentName.data,
    p_comment: validatedComment,
  });

  if (error || data !== true) {
    redirect(`/project-status/${encodeURIComponent(token.data)}?error=${encodeURIComponent("Não foi possível registar a resposta. Verifique o link e tente novamente.")}`);
  }

  redirect(`/project-status/${encodeURIComponent(token.data)}?submitted=1`);
}
