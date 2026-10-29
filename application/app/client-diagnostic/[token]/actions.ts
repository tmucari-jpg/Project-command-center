"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { hashClientDiagnosticToken } from "@/lib/client-diagnostic-token";
import { createPublicClient } from "@/lib/supabase/public";

const responseSchema = z.object({
  reviewed: z.literal("yes"),
  token: z.string().trim().regex(/^[A-Za-z0-9_-]{43,200}$/),
  respondent_type: z.string().trim().min(2).max(80),
  respondent_name: z.string().trim().min(2).max(200),
  respondent_role: z.string().trim().max(200).optional().default(""),
  respondent_email: z.string().trim().max(320).optional().default(""),
  organization: z.string().trim().max(300).optional().default(""),
  request_nature: z.string().trim().min(2).max(100),
  context: z.string().trim().min(3).max(6000),
  focus: z.string().trim().max(6000).optional().default(""),
  desired_result: z.string().trim().max(6000).optional().default(""),
  conditions: z.string().trim().max(6000).optional().default(""),
  deadline_urgency: z.string().trim().max(2000).optional().default(""),
  success_criteria: z.string().trim().max(6000).optional().default(""),
});

function joined(formData: FormData, name: string) {
  return formData
    .getAll(name)
    .map((value) => String(value).trim())
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
    .join("; ");
}

function singleWithDetails(formData: FormData, name: string) {
  const selected = String(formData.get(name) ?? "").trim();
  const details = String(formData.get(`${name}_details`) ?? "").trim();
  return [selected, details].filter(Boolean).join("; ");
}

export async function submitClientDiagnostic(formData: FormData) {
  const token = String(formData.get("token") ?? "").trim();
  const back = `/client-diagnostic/${encodeURIComponent(token)}`;

  const parsed = responseSchema.safeParse({
    token,
    reviewed: String(formData.get("reviewed") ?? ""),
    respondent_type: String(formData.get("respondent_type") ?? "").trim(),
    respondent_name: String(formData.get("respondent_name") ?? "").trim(),
    respondent_role: String(formData.get("respondent_role") ?? "").trim(),
    respondent_email: String(formData.get("respondent_email") ?? "").trim(),
    organization: String(formData.get("organization") ?? "").trim(),
    request_nature: String(formData.get("request_nature") ?? "").trim(),
    context: joined(formData, "context"),
    focus: joined(formData, "focus"),
    desired_result: joined(formData, "desired_result"),
    conditions: joined(formData, "conditions"),
    deadline_urgency: singleWithDetails(formData, "deadline_urgency"),
    success_criteria: joined(formData, "success_criteria"),
  });

  if (!parsed.success) {
    redirect(`${back}?error=${encodeURIComponent("Preencha os campos essenciais antes de enviar.")}`);
  }

  const { reviewed: _reviewed, token: rawToken, respondent_name, respondent_role, respondent_email, ...answers } = parsed.data;
  const supabase = createPublicClient();
  const tokenHash = hashClientDiagnosticToken(rawToken);

  const { data, error } = await supabase.rpc("client_diagnostic_submit", {
    p_token_hash: tokenHash,
    p_respondent_name: respondent_name,
    p_respondent_role: respondent_role,
    p_respondent_email: respondent_email,
    p_answers: answers,
  });

  if (error || data !== true) {
    redirect(`${back}?error=${encodeURIComponent("Este questionário já foi respondido, expirou ou deixou de estar disponível.")}`);
  }

  redirect(`${back}?submitted=1`);
}
