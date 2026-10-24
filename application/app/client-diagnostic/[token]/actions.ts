"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { hashClientDiagnosticToken } from "@/lib/client-diagnostic-token";
import { createClient } from "@/lib/supabase/server";

const responseSchema = z.object({
  token: z.string().trim().min(20).max(200),
  respondent_name: z.string().trim().min(2).max(200),
  respondent_role: z.string().trim().max(200).optional().default(""),
  respondent_email: z.string().trim().max(320).optional().default(""),
  organization: z.string().trim().max(300).optional().default(""),
  problem_need: z.string().trim().min(3).max(5000),
  current_situation: z.string().trim().min(3).max(5000),
  impact: z.string().trim().min(3).max(5000),
  desired_result: z.string().trim().min(3).max(5000),
  affected_people: z.string().trim().max(3000).optional().default(""),
  previous_attempts: z.string().trim().max(5000).optional().default(""),
  deadline_urgency: z.string().trim().max(2000).optional().default(""),
  budget_range: z.string().trim().max(2000).optional().default(""),
  decision_process: z.string().trim().max(3000).optional().default(""),
  available_inputs: z.string().trim().max(5000).optional().default(""),
  constraints: z.string().trim().max(5000).optional().default(""),
  success_criteria: z.string().trim().min(3).max(5000),
  additional_comments: z.string().trim().max(5000).optional().default(""),
});

function formValues(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export async function submitClientDiagnostic(formData: FormData) {
  const parsed = responseSchema.safeParse(formValues(formData));
  const token = String(formData.get("token") ?? "").trim();
  const back = `/client-diagnostic/${encodeURIComponent(token)}`;

  if (!parsed.success) {
    redirect(`${back}?error=${encodeURIComponent("Preencha os campos obrigatórios antes de enviar.")}`);
  }

  const { token: rawToken, respondent_name, respondent_role, respondent_email, ...answers } = parsed.data;
  const supabase = await createClient();
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
