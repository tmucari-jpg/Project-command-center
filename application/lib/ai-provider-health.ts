import { requestAIText, AIRequestError } from "@/lib/ai-runtime";
export type AIProviderHealthProfile = { provider: string; mode: "cloud" | "local"; endpoint_hint?: string | null; model_hint?: string | null };
export type AIProviderHealthResult = { status: "healthy" | "degraded" | "offline" | "unknown"; message: string; latency_ms?: number };
export async function validateAIProviderHealth(profile: AIProviderHealthProfile): Promise<AIProviderHealthResult> {
  if (profile.provider === "qwen_cloud" && !profile.endpoint_hint?.trim()) return { status: "unknown", message: "Qwen Cloud requer o endpoint do Workspace/Região." };
  if (profile.mode === "local" && !profile.endpoint_hint?.trim()) return { status: "unknown", message: "Endpoint local ainda não configurado." };
  if (profile.endpoint_hint) {
    try { if (!["http:", "https:"].includes(new URL(profile.endpoint_hint).protocol)) return { status: "offline", message: "O endpoint deve usar http ou https." }; }
    catch { return { status: "offline", message: "Endpoint inválido." }; }
  }
  const started = Date.now();
  try {
    await requestAIText(profile, "Responda apenas OK.", undefined, profile.provider === "gemini" ? 25_000 : 10_000, profile.provider === "gemini" ? 64 : profile.provider === "openai" ? 64 : 16);
    return { status: "healthy", message: "Provider e modelo responderam com geração real não vazia.", latency_ms: Date.now() - started };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha de ligação ao provider.";
    const status = e instanceof AIRequestError && (e.status === 429 || e.status >= 500) ? "degraded" : message.includes("MODEL_NOT_CONFIGURED") ? "unknown" : "offline";
    return { status, message, latency_ms: Date.now() - started };
  }
}
