export function arenaOutcomeScore(input: {
  qualityScore: number;
  factualityScore: number;
  taskSuccessScore: number;
}) {
  return Math.round(
    (input.qualityScore + input.factualityScore + input.taskSuccessScore) / 3,
  );
}


const ARENA_AGENT_TYPES = ["command", "research", "business", "marketing", "product", "qa", "analytics"] as const;

type ArenaAgentType = (typeof ARENA_AGENT_TYPES)[number];

export function executionArenaDefaults(route?: {
  objective?: string | null;
  selectedAgent?: string | null;
  strategy?: string | null;
}) {
  const selectedAgent = route?.selectedAgent;
  const agentType: ArenaAgentType =
    selectedAgent && ARENA_AGENT_TYPES.includes(selectedAgent as ArenaAgentType)
      ? (selectedAgent as ArenaAgentType)
      : "qa";

  return {
    candidateLabel: (route?.objective?.trim() || "Teste principal").slice(0, 180),
    agentType,
    strategy: (route?.strategy?.trim() || "validar e medir").slice(0, 180),
  };
}
