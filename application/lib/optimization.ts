export type OptimizationSignal = {
  key: string;
  label: string;
  current: number;
  target?: number | null;
  direction: "higher_better" | "lower_better";
};

export function optimizationStatus(signal: OptimizationSignal) {
  if (signal.target === null || signal.target === undefined) return "untracked";
  if (signal.direction === "higher_better") return signal.current >= signal.target ? "on_target" : "below_target";
  return signal.current <= signal.target ? "on_target" : "above_target";
}

export function calculateToolGovernanceScore(input: {
  localFirst: boolean;
  workOnlyWhenJustified: boolean;
  secretsProtected: boolean;
  destructiveActionsGated: boolean;
}) {
  return Object.values(input).filter(Boolean).length * 25;
}
