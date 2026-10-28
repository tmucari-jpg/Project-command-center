/** Local inference first; cloud free tier is explicit, never a paid fallback. */
export type RuntimeProfile = {
  provider: string; mode: "cloud" | "local"; enabled?: boolean; cost_class?: string;
  endpoint_hint?: string | null; model_hint?: string | null;
};
export function isFreeAIProfile(p: RuntimeProfile) {
  if (p.provider === "gemini") {
    return p.mode === "cloud" && p.cost_class === "free"
      && process.env.PCC_GEMINI_FREE_TIER === "true"
      && process.env.PCC_GEMINI_DATA_PROCESSING_ACCEPTED === "true";
  }
  return p.mode === "local" || (p.provider === "groq" && p.cost_class === "free" && process.env.PCC_GROQ_FREE_TIER === "true");
}
/** Actionable administrative explanation; never includes credentials. */
export function freeAIConfigurationIssue(p: RuntimeProfile): string | null {
  if (p.provider === "gemini") {
    if (p.mode !== "cloud") return "Gemini requer o modo Nuvem.";
    if (p.cost_class !== "free") return "Seleccione a classe Gratuito após verificar a elegibilidade do projecto Gemini.";
    if (process.env.PCC_GEMINI_FREE_TIER !== "true") return "Confirme o plano gratuito do projecto Gemini na configuração protegida do servidor antes de validar.";
    if (process.env.PCC_GEMINI_DATA_PROCESSING_ACCEPTED !== "true") return "Reveja e aprove os termos de tratamento de dados do Gemini na configuração protegida do servidor antes de enviar contexto.";
  }
  if (p.mode === "local") return null;
  if (p.provider === "groq") {
    if (p.cost_class !== "free") return "Seleccione a classe Gratuito após verificar o plano da conta Groq.";
    if (process.env.PCC_GROQ_FREE_TIER !== "true") return "Confirme o plano gratuito Groq na configuração protegida do servidor antes de validar.";
  }
  return isFreeAIProfile(p) ? null : "Este serviço não é elegível na política gratuita. Configure um serviço local ou um fornecedor gratuito autorizado.";
}
export function isFreeAIEligible(p: RuntimeProfile) { return Boolean(p.enabled) && isFreeAIProfile(p); }
export function chatCompletionsUrl(endpoint: string) {
  const u = new URL(endpoint.trim());
  if (!["http:", "https:"].includes(u.protocol) || u.username || u.password || u.search || u.hash) throw new Error("AI_INVALID_ENDPOINT");
  const root = u.toString().replace(/\/+$/, "");
  if (root.endsWith("/chat/completions")) return root;
  return root.endsWith("/v1") || root.endsWith("/v1beta/openai") ? `${root}/chat/completions` : `${root}/v1/chat/completions`;
}
export function aiRuntime(p: RuntimeProfile) {
  // A free-tier declaration is an operator assertion, not a guarantee from Google.
  // Gemini remains off until both the account and data-processing policy are approved.
  if (p.provider === "gemini") {
    if (p.mode !== "cloud") throw new Error("GEMINI_REQUIRES_CLOUD_MODE");
    if (process.env.PCC_GEMINI_FREE_TIER !== "true") throw new Error("GEMINI_FREE_TIER_NOT_CONFIRMED");
    if (process.env.PCC_GEMINI_DATA_PROCESSING_ACCEPTED !== "true") throw new Error("GEMINI_DATA_PROCESSING_NOT_ACCEPTED");
    if (p.cost_class && p.cost_class !== "free") throw new Error("GEMINI_FREE_ONLY_POLICY");
  }
  if (p.mode === "local") {
    if (!p.endpoint_hint?.trim()) throw new Error("LOCAL_AI_ENDPOINT_NOT_CONFIGURED");
    if (!p.model_hint?.trim()) throw new Error("LOCAL_AI_MODEL_NOT_CONFIGURED");
    return { url: chatCompletionsUrl(p.endpoint_hint), model: p.model_hint.trim(), apiKey: undefined };
  }
  const configs: Record<string, { secret: string; model: string; base?: string }> = {
    openai: { secret: "OPENAI_API_KEY", model: "OPENAI_MODEL", base: "https://api.openai.com/v1" },
    qwen_cloud: { secret: "QWEN_API_KEY", model: "QWEN_MODEL" },
    moonshot: { secret: "MOONSHOT_API_KEY", model: "MOONSHOT_MODEL", base: "https://api.moonshot.ai/v1" },
    gemini: { secret: "GEMINI_API_KEY", model: "GEMINI_MODEL", base: "https://generativelanguage.googleapis.com/v1beta/openai" },
    groq: { secret: "GROQ_API_KEY", model: "GROQ_MODEL", base: "https://api.groq.com/openai/v1" },
  };
  const c = configs[p.provider];
  if (!c) throw new Error("AI_PROVIDER_NOT_SUPPORTED");
  const key = process.env[c.secret]?.trim();
  if (!key) throw new Error(`${c.secret}_NOT_CONFIGURED`);
  const model = process.env[c.model]?.trim() || p.model_hint?.trim();
  if (!model) throw new Error("AI_MODEL_NOT_CONFIGURED");
  const endpoint = p.endpoint_hint?.trim() || c.base;
  if (!endpoint) throw new Error("QWEN_WORKSPACE_ENDPOINT_NOT_CONFIGURED");
  const url = chatCompletionsUrl(endpoint), host = new URL(url).hostname;
  const allowed = p.provider === "gemini"
    ? url === "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
    : p.provider === "groq" ? host === "api.groq.com"
    : p.provider === "openai" ? host === "api.openai.com"
    : p.provider === "moonshot" ? ["api.moonshot.ai", "api.moonshot.cn"].includes(host)
    : /(^|\.)(aliyuncs\.com|dashscope\.com)$/.test(host);
  if (!allowed || !url.startsWith("https:")) throw new Error("AI_INVALID_CLOUD_ENDPOINT");
  return { url, model, apiKey: key };
}
export class AIRequestError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export async function requestAIText(p: RuntimeProfile, input: string, instructions?: string, timeoutMs = 12_000, maxTokens = 1800) {
  const r = aiRuntime(p);
  const response = await fetch(r.url, {
    method: "POST", headers: { "Content-Type": "application/json", ...(p.provider === "gemini" ? { "x-goog-api-client": "pcc/0.1.0" } : {}), ...(r.apiKey ? { Authorization: `Bearer ${r.apiKey}` } : {}) },
    body: JSON.stringify({ model: r.model,
      messages: [...(instructions ? [{ role: "system", content: instructions }] : []), { role: "user", content: input }],
      ...(p.provider === "openai" ? { reasoning_effort: "none", max_completion_tokens: maxTokens } : { max_tokens: maxTokens }),
    }), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(timeoutMs),
  });
  const payload = await response.json().catch(() => null) as {
    choices?: Array<{ message?: { content?: string | null } }>;
    error?: { code?: string | number; status?: string; message?: string }; code?: string; message?: string;
  } | null;
  if (!response.ok) {
    const code = String(payload?.error?.status || payload?.error?.code || payload?.code || "provider_error");
    const message = String(payload?.error?.message || payload?.message || "Pedido recusado pelo provider.");
    throw new AIRequestError(response.status, code, `HTTP ${response.status} ${code}: ${message.slice(0, 240)}`);
  }
  const content = payload?.choices?.[0]?.message?.content;
  const text = typeof content === "string" ? content.trim() : "";
  if (!text) throw new AIRequestError(502, "empty_response", "AI_EMPTY_RESPONSE");
  return text;
}
