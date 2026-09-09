export const PRIORITIES = ["low", "medium", "high", "critical"] as const;

export const STATUS_OPTIONS = {
  objectives: ["draft", "active", "on_track", "at_risk", "delayed", "completed", "cancelled"],
  projects: ["idea", "planning", "active", "on_hold", "at_risk", "completed", "cancelled"],
  deliverables: ["pending", "active", "blocked", "completed", "cancelled"],
  actions: ["pending", "in_progress", "blocked", "completed", "cancelled"],
  blockers: ["open", "investigating", "waiting", "resolved", "ignored"],
  ideas: ["captured", "evaluating", "approved", "rejected", "converted_to_project", "archived"],
} as const;

export type MutableEntity = keyof typeof STATUS_OPTIONS;

export const ENTITY_PATHS: Record<MutableEntity, string> = {
  objectives: "/objectives",
  projects: "/projects",
  deliverables: "/deliverables",
  actions: "/actions",
  blockers: "/blockers",
  ideas: "/ideas",
};

export const METRIC_TYPES = [
  "execution_ratio",
  "outcome_ratio",
  "on_time_completion",
  "focus_ratio",
  "time_efficiency",
  "project_health",
  "custom",
] as const;

export const EVIDENCE_TYPES = [
  "file",
  "link",
  "document",
  "screenshot",
  "comment",
  "number",
  "result",
  "external_reference",
] as const;
