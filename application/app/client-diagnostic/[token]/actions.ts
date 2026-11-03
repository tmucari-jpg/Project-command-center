"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { hashClientDiagnosticToken } from "@/lib/client-diagnostic-token";
import { createPublicClient } from "@/lib/supabase/public";

const responseSchema = z.object({
  token: z.string().trim().regex(/^[A-Za-z0-9_-]{43,200}$/),
  consent: z.literal("confirmed"),
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
    consent: String(formData.get("consent") ?? ""),
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

  const { token: rawToken, consent, respondent_name, respondent_role, respondent_email, ...answers } = parsed.data;
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

const gie360Schema = z.object({
  token: z.string().trim().regex(/^[A-Za-z0-9_-]{43,200}$/),
  consent: z.literal("confirmed"),
  respondent_name: z.string().trim().min(2).max(200),
  empresa: z.string().trim().min(2).max(300),
  email: z.string().trim().email().max(320),
  sector: z.enum(["Comércio", "Serviços", "Indústria", "Outro"]),
  necessidades: z.array(z.enum([
    "Vendas e clientes", "Cobranças e tesouraria", "Custos e operações", "Gestão e indicadores",
  ])).min(1),
  crm: z.string().trim().max(100),
  cobrancas: z.string().trim().max(100),
  custos: z.string().trim().max(100),
  indicadores: z.string().trim().max(100),
  dados: z.array(z.string().trim().max(100)).max(10),
  objectivo: z.string().trim().max(6000),
  prazo: z.string().trim().max(100),
});

export async function submitGie360Diagnostic(formData: FormData) {
  const token = String(formData.get("token") ?? "").trim();
  const back = `/client-diagnostic/${encodeURIComponent(token)}`;
  const values = gie360Schema.safeParse({
    token,
    consent: String(formData.get("consent") ?? ""),
    respondent_name: String(formData.get("respondent_name") ?? ""),
    empresa: String(formData.get("empresa") ?? ""),
    email: String(formData.get("email") ?? ""),
    sector: String(formData.get("sector") ?? ""),
    necessidades: formData.getAll("necessidades").map(String),
    crm: String(formData.get("crm") ?? ""),
    cobrancas: String(formData.get("cobrancas") ?? ""),
    custos: String(formData.get("custos") ?? ""),
    indicadores: String(formData.get("indicadores") ?? ""),
    dados: formData.getAll("dados").map(String),
    objectivo: String(formData.get("objectivo") ?? ""),
    prazo: String(formData.get("prazo") ?? "Por definir"),
  });
  if (!values.success) {
    redirect(`${back}?error=${encodeURIComponent("Revise a identificação, seleccione pelo menos uma necessidade e confirme o envio.")}`);
  }
  const { token: rawToken, consent, respondent_name, email, ...details } = values.data;
  const supabase = createPublicClient();
  const tokenHash = hashClientDiagnosticToken(rawToken);
  const { data: requestRows, error: lookupError } = await supabase.rpc("client_diagnostic_lookup", {
    p_token_hash: tokenHash,
  });
  const request = Array.isArray(requestRows) ? requestRows[0] : null;
  if (lookupError || !request || !["executive-v3", "executive-v3-gie360"].includes(request.questionnaire_version)) {
    redirect(`${back}?error=${encodeURIComponent("Este link não corresponde ao diagnóstico empresarial integrado.")}`);
  }
  const answers = {
    respondent_type: "organization",
    organization: details.empresa,
    request_nature: "organization_solution",
    context: details.necessidades.join("; "),
    focus: [details.crm, details.cobrancas, details.custos, details.indicadores].filter(Boolean).join("; "),
    desired_result: details.objectivo,
    conditions: details.dados.join("; "),
    deadline_urgency: details.prazo,
    success_criteria: details.objectivo,
    sector: details.sector,
    necessidades: details.necessidades,
    crm: details.crm,
    cobrancas: details.cobrancas,
    custos: details.custos,
    indicadores: details.indicadores,
    dados: details.dados,
    objectivo: details.objectivo,
    prazo: details.prazo,
    questionnaire_mode: "gie360",
  };
  const { data, error } = await supabase.rpc("client_diagnostic_submit", {
    p_token_hash: tokenHash,
    p_respondent_name: respondent_name,
    p_respondent_role: "",
    p_respondent_email: email,
    p_answers: answers,
  });
  if (error || data !== true) {
    redirect(`${back}?error=${encodeURIComponent("Não foi possível enviar. O link pode ter expirado ou já ter sido respondido.")}`);
  }
  redirect(`${back}?submitted=1`);
}
