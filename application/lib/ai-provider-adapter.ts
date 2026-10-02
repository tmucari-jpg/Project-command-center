export type ProviderProfile = {
  provider: string;
  label: string;
  mode: "cloud" | "local";
  enabled: boolean;
  priority: number;
  cost_class: "free" | "low" | "medium" | "high" | "unknown";
  last_health_status: "unknown" | "healthy" | "degraded" | "offline";
  capabilities?: string[] | null;
};

const COST_RANK: Record<ProviderProfile["cost_class"], number> = {
  free: 0,
  low: 1,
  medium: 2,
  high: 3,
  unknown: 4,
};

export function chooseProvider(
  providers: ProviderProfile[],
  options: { preferLocal?: boolean; capability?: string; costSensitive?: boolean } = {},
) {
  const candidates = providers.filter((provider) => {
    if (!provider.enabled) return false;
    if (provider.last_health_status === "offline") return false;
    if (options.capability && !(provider.capabilities ?? []).includes(options.capability)) return false;
    return true;
  });

  return candidates.sort((a, b) => {
    if (options.preferLocal && a.mode !== b.mode) return a.mode === "local" ? -1 : 1;
    if (options.costSensitive && COST_RANK[a.cost_class] !== COST_RANK[b.cost_class]) {
      return COST_RANK[a.cost_class] - COST_RANK[b.cost_class];
    }
    return a.priority - b.priority;
  })[0] ?? null;
}

export function providerNeedsSecret(provider: ProviderProfile) {
  return provider.mode === "cloud";
}
