import type { SupabaseClient } from "@supabase/supabase-js";
import { isFreeAIEligible, requestAIText, type RuntimeProfile } from "@/lib/ai-runtime";
import { classifyAIProviderHealth } from "@/lib/ai-provider-state";
export type AssistProviderProfile = RuntimeProfile & { id: string; label: string };
export async function generateAssistWithFallback(supabase: SupabaseClient, userId: string, input: string, instructions?: string) {
  const { data: rows, error } = await supabase.from("ai_provider_profiles")
    .select("id,provider,label,mode,enabled,cost_class,priority,endpoint_hint,model_hint,last_health_status")
    .eq("user_id", userId).eq("enabled", true).order("priority", { ascending: true });
  if (error) throw new Error("ASSIST_REGISTRY_UNAVAILABLE");
  const profiles = ((rows ?? []) as AssistProviderProfile[]).filter(isFreeAIEligible)
    .sort((a, b) => Number(a.mode !== "local") - Number(b.mode !== "local"));
  const attempts: Array<{ provider: string; label: string; status: "passed" | "failed"; error?: string }> = [];
  const deadline = Date.now() + 18_000;
  for (const profile of profiles) {
    const remaining = deadline - Date.now();
    if (remaining < 500) break;
    try {
      const text = await requestAIText(profile, input, instructions, Math.min(8000, remaining));
      attempts.push({ provider: profile.provider, label: profile.label, status: "passed" });
      await supabase.from("ai_provider_profiles").update({ last_health_status: "healthy", configuration_status: "valid", availability_reason: "healthy",
        last_health_message: "Geração real concluída.", last_health_at: new Date().toISOString(),
      }).eq("id", profile.id).eq("user_id", userId);
      return { text, provider: profile, attempts };
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : "AI_REQUEST_FAILED";
      attempts.push({ provider: profile.provider, label: profile.label, status: "failed", error: message.slice(0, 300) });
      await supabase.from("ai_provider_profiles").update({ last_health_status: "degraded", ...classifyAIProviderHealth({ status: "degraded", message }),
        last_health_message: message.slice(0, 500), last_health_at: new Date().toISOString(),
      }).eq("id", profile.id).eq("user_id", userId);
    }
  }
  throw new Error(profiles.length ? "ASSIST_FREE_PROVIDERS_UNAVAILABLE" : "ASSIST_NO_FREE_PROVIDER");
}
