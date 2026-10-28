/** Local inference first; cloud free tier is explicit, never a paid fallback. */
export type RuntimeProfile = {
  provider: string; mode: "cloud" | "local"; enabled?: boolean; cost_class?: string;
  endpoint_hint?: string | null; model_hint?: string | null;
};
export function isFreeAIProfile(p: RuntimeProfile) {
  return p.mode === "local" || (p.provider === "groq" && p.cost_class === "free" && process.env.PCC_GROQ_FREE_TIER === "true");
}
export function isFreeAIEligible(p: RuntimeProfile) { return Boolean(p.enabled) && isFreeAIProfile(p); }
export function chatCompletionsUrl(endpoint: string) {
  const u = new URL(endpoint.trim());
  if (!["http:", "https:"].includes(u.protocol) || u.username || u.password || u.search || u.hash) throw new Error("AI_INVALID_ENDPOINT");
  const root = u.toString().replace(/\/+$/, "");
  if (root.endsWith("/chat/completions")) return root;
  return root.endsWith("/v1") ? `${root}/chat/completions` : `${root}/v1/chat/completions`;
}
export function aiRuntime(p: RuntimeProfile) {
  if (p.mode === "local") {
    if (!p.endpoint_hint?.trim()) throw new Error("LOCAL_AI_ENDPOINT_NOT_CONFIGURED");
    if (!p.model_hint?.trim()) throw new Error("LOCAL_AI_MODEL_NOT_CONFIGURED");
    return { url: chatCompletionsUrl(p.endpoint_hint), model: p.model_hint.trim(), apiKey: undefined };
  }
  const configs: Record<string, { secret: string; model: string; base?: string }> = {
    openai: { secret: "OPENAI_API_KEY", model: "OPENAI_MODEL", base: "https://api.openai.com/v1" },
    qwen_cloud: { secret: "QWEN_API_KEY", model: "QWEN_MODEL" },
    moonshot: { secret: "MOONSHOT_API_KEY", model: "MOONSHOT_MODEL", base: "https://api.moonshot.ai/v1" },
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
  const allowed = p.provider === "groq" ? host === "api.groq.com"
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
    method: "POST", headers: { "Content-Type": "application/json", ...(r.apiKey ? { Authorization: `Bearer ${r.apiKey}` } : {}) },
    body: JSON.stringify({ model: r.model,
      messages: [...(instructions ? [{ role: "system", content: instructions }] : []), { role: "user", content: input }],
      ...(p.provider === "openai" ? { reasoning_effort: "none", max_completion_tokens: maxTokens } : { max_tokens: maxTokens }),
    }), cache: "no-store", signal: AbortSignal.timeout(timeoutMs),
  });
  const payload = await response.json().catch(() => null) as {
    choices?: Array<{ message?: { content?: string | null } }>;
    error?: { code?: string; message?: string }; code?: string; message?: string;
  } | null;
  if (!response.ok) {
    const code = String(payload?.error?.code || payload?.code || "provider_error");
    const message = String(payload?.error?.message || payload?.message || "Pedido recusado pelo provider.");
    throw new AIRequestError(response.status, code, `HTTP ${response.status} ${code}: ${message.slice(0, 240)}`);
  }
  const text = payload?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new AIRequestError(502, "empty_response", "AI_EMPTY_RESPONSE");
  return text;
}
