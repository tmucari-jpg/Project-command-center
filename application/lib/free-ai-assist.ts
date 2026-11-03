"use client";
import { generateBrowserLocalText } from "@/lib/browser-local-ai";
export function validateAssistanceText(text: string, instructions: string) {
  if (!text?.trim()) throw new Error("A IA não devolveu conteúdo.");
  if (!/JSON/i.test(instructions)) return text.trim();
  const clean = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let parsed: unknown;
  try { parsed = JSON.parse(clean); } catch { throw new Error("A IA devolveu JSON inválido. Nenhum campo foi alterado."); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("A resposta estruturada não contém um objecto válido.");
  return clean;
}
export async function generateFreeAssistance(input: string, instructions: string) {
  let localReason = "";
  try { return { text: validateAssistanceText(await generateBrowserLocalText(input, instructions), instructions), source: "local" as const }; }
  catch (e) { localReason = e instanceof Error ? e.message : "IA local indisponível"; }
  const response = await fetch("/api/ai/assist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input, instructions }), signal: AbortSignal.timeout(22_000) });
  const data = await response.json().catch(() => null) as { text?: string } | null;
  if (!response.ok || !data?.text?.trim()) throw new Error(`${localReason}. Serviço gratuito complementar indisponível; continue manualmente ou tente novamente.`);
  return { text: validateAssistanceText(data.text, instructions), source: "free_provider" as const };
}
