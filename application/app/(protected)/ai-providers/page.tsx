import { HardDrive, RefreshCw, ShieldCheck } from "lucide-react";
import { registerAIProviderProfile, validateAIProviderProfile, validateAllAIProviderProfiles } from "@/app/(protected)/mutations";
import { Field, Select } from "@/components/form-fields";
import { primaryButtonClass } from "@/components/ui";
import { PageHeader } from "@/components/page-header";
import { Card, EmptyState } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { displayLabel } from "@/lib/display-label";
import { resolveAIExecutionState } from "@/lib/ai-provider-adapter";

export default async function AIFornecedoresPage({
  searchParams,
}: {
  searchParams: Promise<{ health?: string; health_message?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireAdmin();

  const [{ data: providers, error: providerError }, { data: queue, error: queueError }] = await Promise.all([
    supabase.from("ai_provider_profiles").select("*").eq("user_id", user.id).order("priority", { ascending: true }),
    supabase.from("sync_queue").select("id,entity_type,operation,status,attempts,last_error,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
  ]);

  const error = providerError?.message ?? queueError?.message;
  const enabledProviders = (providers ?? []).filter((provider) => provider.enabled);
  const operationalProviders = enabledProviders.filter((provider) => pro¶»§q«^