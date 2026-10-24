import type { SupabaseClient } from "@supabase/supabase-js";
import { validateAIProviderHealth } from "@/lib/ai-provider-health";

export type AssistProviderProfile = {
  id: string;
  provider: string;
  label: string;
  mode: "cloud" | "local";
  endpoint_hint?: string | null;
  model_hint?: string | null;
};

type AssistAttempt = {
  provider: string;
  label: string;
  status: "passed" | "failed";
  error?: string;
};

function runtimeForProvider(profile: AssistProviderProfile) {
  if (profile.provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY_NOT_CONFIGURED");
    return {
      baseUrl: profile.endpoint_hint?.trim() || "https://api.openai.com/v1",
      apiKey,
      model: process.env.OPENAI_MODEL?.trim() || profile.model_hint?.trim() || "gpt-6-luna",
    };
  }

  if (profile.provider === "qwen_cloud") {
    const apiKey = process.env.QWEN_API_KEY;
    if (!apiKey) throw new Error("QWEN_API_KEY_NOT_CONFIGURED");
    const endpoint = profile.endpoint_hint?.trim();
    if (!endpoint) throw new Error("QWEN_WORKSPACE_ENDPOINT_NOT_CONFIGURED");
    return {
      baseUrl: endpoint,
      apiKey,
      model: process.env.QWEN_MODEL?.trim() || profile.model_hint?.trim() || "qwen-plus",
    };
  }

  if (profile.provider === "moonshot") {
    const apiKey = process.env.MOONSHOT_API_KEY;
    if (!apiKey) throw new Error("MOONSHOT_API_KEY_NOT_CONFIGURED");
    return {
      baseUrl: profile.endpoint_hint?.trim() || "https://api.moonshot.ai/v1",
      apiKey,
      model: process.env.MOONSHOT_MODEL?.trim() || profile.model_hint?.trim() || "",
    };
  }

  throw new Error("ASSIST_PROVIDER_NOT_SUPPORTED");
}

function chatCompletionsUrl(baseUrl: string) {
  const root = baseUrl.replace(/\/$/, "");
  if (root.endsWith("/chat/completions")) return root;
  if (root.endsWith("/v1")) return `${root}/chat/completions`;
  return `${root}/v1/chat/completions`;
}

async function generateText(
  profile: AssistProviderProfile,
  input: string,
  instructions?: string,
) {
  const runtime = runtimeForProvider(profile);
  if (!runtime.model) throw new Error("ASSIST_MODEL_NOT_CONFIGURED");

  const response = await fetch(chatCompletionsUrl(runtime.baseUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${runtime.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: runtime.model,
      messages: [
        ...(instructions ? [{ role: "system", content: instructions }] : []),
        { role: "user", content: input },
      ],
      max_tokens: 1800,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`ASSIST_PROVIDER_ERROR_${response.status}: ${body.slice(0, 280)}`);
  }

  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const text = body.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) throw new Error("ASSIST_EMPTY_RESPONSE");
  return text;
}

function safeError(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).slice(0, 300);
}

export async function generateAssistWithFallback(
  supabase: SupabaseClient,
  userId: string,
  input: string,
  instructions?: string,
) {
  const { data: rows, error } = await supabase
    .from("ai_provider_profiles")
    .select("id,provider,label,mode,enabled,priority,endpoint_hint,model_hint,last_health_status")
    .eq("user_id", userId)
    .eq("mode", "cloud")
    .order("priority", { ascending: true });

  if (error) throw new Error(error.message);
  const profiles = (rows ?? []) as AssistProviderProfile[];
  if (!profiles.length) throw new Error("ASSIST_NO_CLOUD_PROVIDER");

  const attempts: AssistAttempt[] = [];

  for (const profile of profiles) {
    const health = await validateAIProviderHealth(profile);
    const healthy = health.status === "healthy";

    await supabase
      .from("ai_provider_profiles")
      .update({
        enabled: healthy,
        last_health_status: health.status,
        last_health_at: new Date().toISOString(),
      })
      .eq("id", profile.id)
      .eq("user_id", userId);

    if (!healthy) {
      attempts.push({
        provider: profile.provider,
        label: profile.label,
        status: "failed",
        error: health.message.slice(0, 300),
      });
      continue;
    }

    try {
      const text = await generateText(profile, input, instructions);
      attempts.push({ provider: profile.provider, label: profile.label, status: "passed" });
      return { text, provider: profile, attempts };
    } catch (providerError) {
      attempts.push({
        provider: profile.provider,
        label: profile.label,
        status: "failed",
        error: safeError(providerError),
      });
      await supabase
        .from("ai_provider_profiles")
        .update({
          enabled: false,
          last_health_status: "degraded",
          last_health_at: new Date().toISOString(),
        })
        .eq("id", profile.id)
        .eq("user_id", userId);
    }
  }

  const summary = attempts.map((item) => `${item.label}: ${item.error ?? "falhou"}`).join(" | ");
  throw new Error(`ASSIST_ALL_PROVIDERS_FAILED: ${summary}`);
}
