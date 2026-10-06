export function arenaOutcomeScore(input: {
  qualityScore: number;
  factualityScore: number;
  taskSuccessScore: number;
}) {
  return Math.round(
    (input.qualityScore + input.factualityScore + input.taskSuccessScore) / 3,
  );
}
