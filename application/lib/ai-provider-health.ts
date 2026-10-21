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
  const model = process.env.OPENAI_MODEL?.trim() || profile.model_hint?.trim();

  try {
    if (!model) {
      const { response, latency_ms } = await timedFetch(`${base}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      return response.ok
        ? { status: "healthy", message: "Credencial OpenAI validada; modelo ainda não definido.", latency_ms }
        : {
            status: response.status >= 500 || response.status === 429 ? "degraded" : "offline",
            message: `OpenAI respondeu HTTP ${response.status}.`,
            latency_ms,
          };
    }

    const { response, latency_ms } = await timedFetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Responda apenas OK." }],
        temperature: 0.1,
        max_tokens: 64,
      }),
    });

    if (response.ok) {
      return {
        status: "healthy",
        message: `Provider e modelo configurado responderam no mesmo endpoint usado pelo BotIA.`,
        latency_ms,
      };
    }

    let providerMessage = "";
    try {
      const body = (await response.json()) as {
        error?: { message?: string };
        message?: string;
      };
      providerMessage = body.error?.message?.trim() || body.message?.trim() || "";
    } catch {
      // Mantém diagnóstico apenas pelo código HTTP quando a resposta não é JSON.
    }

    const detail = providerMessage ? ` — ${providerMessage.slice(0, 220)}` : "";

    return {
      status: response.status >= 500 || response.status === 429 ? "degraded" : "offline",
      message: `OpenAI respondeu HTTP ${response.status} no endpoint real do BotIA${detail}`,
      latency_ms,
    };
  } catch (error) {
    return {
      status: "offline",
      message: error instanceof Error ? error.message : "Falha de ligação ao provider.",
    };
  }
}

async function validateOpenAICompatibleCloud(
  profile: AIProviderHealthProfile,
): Promise<AIProviderHealthResult> {
  const config =
    profile.provider === "moonshot"
      ? {
          apiKey: process.env.MOONSHOT_API_KEY,
          base: profile.endpoint_hint?.trim() || "https://api.moonshot.ai/v1",
          model: process.env.MOONSHOT_MODEL?.trim() || profile.model_hint?.trim(),
          label: "Kimi / Moonshot",
        }
      : profile.provider === "qwen_cloud"
        ? {
            apiKey: process.env.QWEN_API_KEY,
            base: profile.endpoint_hint?.trim() || "",
            model: process.env.QWEN_MODEL?.trim() || profile.model_hint?.trim(),
            label: "Qwen cloud",
          }
        : null;

  if (!config) {
    return { status: "unknown", message: "Provider cloud sem adaptador dedicado." };
  }

  if (profile.provider === "qwen_cloud" && !config.base) {
    return {
      status: "unknown",
      message: "Qwen Cloud requer o endpoint do Workspace/Região do Alibaba Model Studio.",
    };
  }

  if (!config.apiKey) {
    return {
      status: "offline",
      message: `${profile.provider === "moonshot" ? "MOONSHOT_API_KEY" : "QWEN_API_KEY"} não está configurada neste runtime.`,
    };
  }

  const base = config.base.replace(/\/$/, "");

  try {
    if (!config.model) {
      const { response, latency_ms } = await timedFetch(`${base}/models`, {
        headers: { Authorization: `Bearer ${config.apiKey}` },
      });

      return response.ok
        ? {
            status: "healthy",
            message: `${config.label} validado; modelo ainda não definido.`,
            latency_ms,
          }
        : {
            status: response.status >= 500 || response.status === 429 ? "degraded" : "offline",
            message: `${config.label} respondeu HTTP ${response.status}.`,
            latency_ms,
          };
    }

    const { response, latency_ms } = await timedFetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: "user", content: "Responda apenas OK." }],
        max_tokens: 8,
      }),
    });

    if (response.ok) {
      return {
        status: "healthy",
        message: `${config.label} e modelo configurado responderam a uma chamada real.`,
        latency_ms,
      };
    }

    let providerMessage = "";
    try {
      const body = (await response.json()) as {
        code?: string;
        message?: string;
        error?: { code?: string; message?: string };
      };
      const code = body.error?.code?.trim() || body.code?.trim() || "";
      const message = body.error?.message?.trim() || body.message?.trim() || "";
      providerMessage = [code, message].filter(Boolean).join(": ");
    } catch {
      // Mantém diagnóstico apenas pelo código HTTP quando a resposta não é JSON.
    }

    const detail = providerMessage ? ` — ${providerMessage.slice(0, 260)}` : "";

    return {
      status: response.status >= 500 || response.status === 429 ? "degraded" : "offline",
      message: `${config.label} respondeu HTTP ${response.status} ao teste real do modelo${detail}`,
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

  if (profile.provider === "moonshot" || profile.provider === "qwen_cloud") {
    return validateOpenAICompatibleCloud(profile);
  }

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
