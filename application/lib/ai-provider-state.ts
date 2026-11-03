import type { AIProviderHealthResult } from "@/lib/ai-provider-health";

export type AIConfigurationStatus = "unverified" | "valid" | "invalid";
export type AIAvailabilityReason =
  | "healthy" | "quota" | "rate_limit" | "auth" | "model"
  | "endpoint" | "network" | "provider" | "unknown";

export function classifyAIProviderHealth(result: AIProviderHealthResult): {
  configuration_status: AIConfigurationStatus;
  availability_reason: AIAvailabilityReason;
} {
  const message = result.message.toLowerCase();
  if (result.status === "healthy") return { configuration_status: "valid", availability_reason: "healthy" };
  if (/(insufficient_quota|quota[_ ]?(exceeded|exhausted)|free quota exhausted|no credits remaining|add credits|add funds|billing)/.test(message)) {
    return { configuration_status: "valid", availability_reason: "quota" };
  }
  if (/(http 429|rate_limit|resource_exhausted)/.test(message)) return { configuration_status: "valid", availability_reason: "rate_limit" };
  if (/(api_key não está configurada|api_key_not_configured|api key|http 401|unauthorized|api_key_invalid|permission_denied|http 403)/.test(message)) {
    return { configuration_status: "invalid", availability_reason: "auth" };
  }
  if (/(gemini_free_tier_not_confirmed|gemini_data_processing_not_accepted|gemini_free_only_policy|gemini_requires_cloud_mode)/.test(message)) {
    return { configuration_status: "invalid", availability_reason: "auth" };
  }
  if (/(modelo ainda não definido|model_not_configured|model_not_found|model.*not found)/.test(message)) {
    return { configuration_status: "invalid", availability_reason: "model" };
  }
  if (/(endpoint inválido|endpoint.*configur|workspace.*endpoint|invalid.*endpoint|http 404)/.test(message)) {
    return { configuration_status: "invalid", availability_reason: "endpoint" };
  }
  if (/(timeout|fetch failed|ligação|alcançar)/.test(message)) {
    return { configuration_status: "valid", availability_reason: "network" };
  }
  return {
    configuration_status: result.status === "unknown" ? "unverified" : "valid",
    availability_reason: "provider",
  };
}
