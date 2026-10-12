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

function supportsCapability(provider: ProviderProfile, capability?: string) {
  return !capability || (provider.capabilities ?? []).includes(capability);
}

function isUsable(provider: ProviderProfile, capability?: string) {
  if (!provider.enabled) return false;
  if (provider.last_health_status === "offline") return false;
  return supportsCapability(provider, capability);
}

export function chooseProvider(
  providers: ProviderProfile[],
  options: { preferLocal?: boolean; capability?: string; costSensitive?: boolean } = {},
) {
  const candidates = providers.filter((provider) => isUsable(provider, options.capability));

  return candidates.sort((a, b) => {
    if (options.preferLocal && a.mode !== b.mode) return a.mode === "local" ? -1 : 1;
    if (options.costSensitive && COST_RANK[a.cost_class] !== COST_RANK[b.cost_class]) {
      return COST_RANK[a.cost_class] - COST_RANK[b.cost_class];
    }
    return a.priority - b.priority;
  })[0] ?? null;
}

export function chooseHybridProvider(
  providers: ProviderProfile[],
  options: { capability?: string; preferCloud?: boolean } = {},
) {
  const candidates = providers.filter((provider) => isUsable(provider, options.capability));
  const preferCloud = options.preferCloud ?? true;

  const primaryMode = preferCloud ? "cloud" : "local";
  const fallbackMode = preferCloud ? "local" : "cloud";

  const byPriority = (items: ProviderProfile[]) =>
    [...items].sort((a, b) => {
      const aHealth = a.last_health_status === "healthy" ? 0 : a.last_health_status === "degraded" ? 1 : 2;
      const bHealth = b.last_health_status === "healthy" ? 0 : b.last_health_status === "degraded" ? 1 : 2;
      if (aHealth !== bHealth) return aHealth - bHealth;
      return a.priority - b.priority;
    });

  const primary = byPriority(candidates.filter((provider) => provider.mode === primaryMode))[0] ?? null;
  const fallback = byPriority(candidates.filter((provider) => provider.mode === fallbackMode))[0] ?? null;

  return {
    primary,
    fallback,
    active: primary ?? fallback,
    strategy: preferCloud ? "cloud-primary-local-fallback" : "local-primary-cloud-fallback",
  } as const;
}

export function providerNeedsSecret(provider: ProviderProfile) {
  return provider.mode === "cloud";
}
