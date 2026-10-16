export type AIProviderHealthProfile = {
  provider: string;
  mode: "cloud" | "local";
  endpoint_hint?: string | null;
  model_hint?: string | null;
};

export type AIProviderHealthResult = {
  status: "healthy" | "degraded" | "offline" | "unknown";
  message: string;
  latency_ms?: number;
};

async function timedFetch(url: string, init?: RequestInit) {
  const started = Date.now();
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  return { response, latency_ms: Date.now() - started };
}

async function validateOpenAI(profile: AIProviderHealthProfile): Promise<AIProviderHealthResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { status: "offline", message: "OPENAI_API_KEY não está configurada neste runtime." };
  }

  const base = (profile.endpoint_hint?.trim() || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = profile.model_hint?.trim();
  const url = model ? `${base}/models/${encodeURIComponent(model)}` : `${base}/models`;

  try {
    const { response, latency_ms } = await timedFetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (response.ok) {
      return {
        status: "healthy",
        message: model ? `Provider e modelo ${model} responderam correctamente.` : "Provider respondeu correctamente.",
        latency_ms,
      };
    }

    return {
      status: response.status >= 500 ? "degraded" : "offline",
      message: `OpenAI respondeu HTTP ${response.status}.`,
      latency_ms,
    };
  } catch (error) {
    return {
      status: "offline",
      message: error instanceof Error ? error.message : "Falha de ligação ao provider.",
    };
  }
}

async function validateOpenAICompatibleLocal(profile: AIProviderHealthProfile): Promise<AIProviderHealthResult> {
  const endpoint = profile.endpoint_hint?.trim();
  if (!endpoint) {
    return { status: "unknown", message: "Endpoint local ainda não configurado." };
  }

  let base: URL;
  try {
    base = new URL(endpoint);
  } catch {
    return { status: "offline", message: "Endpoint inválido." };
  }

  if (!["http:", "https:"].includes(base.protocol)) {
    return { status: "offline", message: "O endpoint deve usar http ou https." };
  }

  const root = endpoint.replace(/\/$/, "");
  const candidates =
    profile.provider === "koboldcpp_local"
      ? [`${root}/api/v1/model`, `${root}/v1/models`, root]
      : [`${root}/v1/models`, `${root}/api/tags`, root];

  let lastStatus: number | null = null;
  let lastLatency: number | undefined;

  for (const url of candidates) {
    try {
      const { response, latency_ms } = await timedFetch(url);
      lastStatus = response.status;
      lastLatency = latency_ms;
      if (response.ok) {
        return {
          status: "healthy",
          message: `Endpoint respondeu correctamente em ${url}.`,
          latency_ms,
        };
      }
    } catch {
      // Tenta a próxima rota conhecida antes de declarar offline.
    }
  }

  if (lastStatus !== null) {
    return {
      status: "degraded",
      message: `Endpoint alcançável, mas respondeu HTTP ${lastStatus}.`,
      latency_ms: lastLatency,
    };
  }

  return {
    status: "offline",
    message: "Não foi possível alcançar o endpoint a partir deste runtime.",
  };
}

export async function validateAIProviderHealth(
  profile: AIProviderHealthProfile,
): Promise<AIProviderHealthResult> {
  if (profile.provider === "openai") return validateOpenAI(profile);

  if (profile.provider === "qwen_local" || profile.provider === "koboldcpp_local") {
    return validateOpenAICompatibleLocal(profile);
  }

  if (profile.endpoint_hint?.trim()) {
    return validateOpenAICompatibleLocal(profile);
  }

  return {
    status: "unknown",
    message: "Este provider ainda não tem adaptador ou endpoint suficiente para validação real.",
  };
}
