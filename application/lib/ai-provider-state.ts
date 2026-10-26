import type { AIProviderHealthResult } from "@/lib/ai-provider-health";

export type AIConfigurationStatus = "unverified" | "valid" | "invalid";
export type AIAvailabilityReason = "healthy" | "quota" | "rate_limit" | "auth" | "model" | "endpoint" | "network" | "provider" | "unknown";

export function classifyAIProviderHealth(result: AIProviderHealthResult): {
  configuration_status: AIConfigurationStatus;
  availability_reason: AIAvailabilityReason;
} {
  const message = result.message.toLowerCase();
  if (result.status === "healthy") return { configuration_status: "valid", availability_reason: "healthy" };
  if (/(insufficient_quota|free quota exhausted|no credits remaining|add credits|add funds|billing)/.test(message)) {
    return { configuration_status: "valid", availability_reason: "quota" };
  }
  if (message.includes("http 429")) return { configuration_status: "valid", availability_reason: "rate_limit" };
  if (/(api_key n√£o est√° configurada|api key|http 401|unauthorized)/.test(message)) {
    return { configuration_status: "invalid", availability_reason: "auth" };
  }
  if (/(modelo ainda n√£o definido|model_not_configured|model.*not found|http 404)/.test(message)) {
    return { configuration_status: "invalid", availability_reason: "model" };
  }
  if (/(endpoint inv√°lido|endpoint.*configur|workspace.*endpoint)/.test(message)) {
    return { configuration_status: "invalid", availability_reason: "endpoint" };
  }
  if (/(timeout|fetch failed|liga√ß√£o|alcan√ßar)/.t∂ªßq´^