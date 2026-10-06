import { z } from "zod";
import { EVIDENCE_TYPES, METRIC_TYPES, PRIORITIES, STATUS_OPTIONS } from "@/lib/constants";

const optionalText = (max = 4000) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max).optional(),
  );

const httpUrl = z
  .string()
  .url()
  .max(2000)
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  }, "A URL deve usar http ou https.");

const optionalDate = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
);

const optionalDateTime = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})?$/,
      "Data/hora inválida.",
    )
    .transform((value) => {
      // HTML datetime-local has no offset. The product default timezone is Africa/Maputo (+02:00).
      // Values already carrying an offset/Z are preserved.
      const hasOffset = /(?:Z|[+-]\d{2}:\d{2})$/.test(value);
      const normalized = hasOffset
        ? value
        : `${value.length === 16 ? `${value}:00` : value}+02:00`;
      return new Date(normalized).toISOString();
    })
    .optional(),
);

const optionalUuid = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().uuid().optional(),
);

const optionalNumber = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.coerce.number().finite().optional(),
);

const progress = z.coerce.number().min(0).max(100);

export const objectiveSchema = z
  .object({
    title: z.string().trim().min(2).max(180),
    description: optionalText(),
    expected_result: optionalText(),
    priority: z.enum(PRIORITIES),
    status: z.enum(STATUS_OPTIONS.objectives),
    start_date: optionalDate,
    due_date: optionalDate,
    progress,
    metric_name: optionalText(160),
    baseline_value: optionalNumber,
    target_value: optionalNumber,
    current_value: optionalNumber,
    notes: optionalText(),
  })
  .refine(
    (data) => !data.start_date || !data.due_date || data.due_date >= data.start_date,
    { message: "O prazo não pode ser anterior à data inicial." },
  );

export const projectSchema = z
  .object({
    objective_id: optionalUuid,
    title: z.string().trim().min(2).max(180),
    description: optionalText(),
    expected_result: optionalText(),
    priority: z.enum(PRIORITIES),
    status: z.enum(STATUS_OPTIONS.projects),
    start_date: optionalDate,
    due_date: optionalDate,
    progress,
    budget: optionalNumber,
    currency: optionalText(8),
    next_action: optionalText(500),
    notes: optionalText(),
  })
  .refine(
    (data) => !data.start_date || !data.due_date || data.due_date >= data.start_date,
    { message: "O prazo não pode ser anterior à data inicial." },
  );

export const deliverableSchema = z.object({
  project_id: z.string().uuid(),
  title: z.string().trim().min(2).max(180),
  description: optionalText(),
  priority: z.enum(PRIORITIES),
  status: z.enum(STATUS_OPTIONS.deliverables),
  due_date: optionalDate,
  progress,
  completion_criteria: optionalText(),
});

export const actionSchema = z.object({
  project_id: optionalUuid,
  deliverable_id: optionalUuid,
  title: z.string().trim().min(2).max(180),
  description: optionalText(),
  priority: z.enum(PRIORITIES),
  status: z.enum(STATUS_OPTIONS.actions),
  due_at: optionalDateTime,
  estimated_minutes: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().positive().max(100000).optional(),
  ),
  completion_criteria: optionalText(),
  is_next_action: z.preprocess((value) => value === "on" || value === "true", z.boolean()),
});

export const blockerSchema = z.object({
  project_id: optionalUuid,
  deliverable_id: optionalUuid,
  action_id: optionalUuid,
  title: z.string().trim().min(2).max(180),
  description: optionalText(),
  impact: optionalText(1000),
  responsible: optionalText(180),
  resolution_due_at: optionalDateTime,
  status: z.enum(STATUS_OPTIONS.blockers),
  solution: optionalText(),
});

export const ideaSchema = z.object({
  project_id: optionalUuid,
  title: z.string().trim().min(2).max(180),
  description: optionalText(),
  source: optionalText(500),
  potential: optionalText(1000),
  priority: z.enum(PRIORITIES),
  status: z.enum(STATUS_OPTIONS.ideas),
  next_decision: optionalText(1000),
});

export const factoryIntakeSchema = z.object({
  title: z.string().trim().min(2).max(180),
  description: optionalText(6000),
  problem: z.string().trim().min(3).max(6000),
  project_type: z.enum(["commercial", "non_commercial"]),
  target_user: optionalText(2000),
  expected_value: optionalText(4000),
  constraints: optionalText(4000),
  source: optionalText(1000),
});

export const evidenceSchema = z
  .object({
    action_id: optionalUuid,
    deliverable_id: optionalUuid,
    project_id: optionalUuid,
    evidence_type: z.enum(EVIDENCE_TYPES),
    title: optionalText(180),
    description: optionalText(),
    url: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      httpUrl.optional(),
    ),
    storage_path: optionalText(1000),
    numeric_value: optionalNumber,
  })
  .refine(
    (data) => data.action_id || data.deliverable_id || data.project_id,
    { message: "Associe a evidência a uma acção, entregável ou projecto." },
  );

export const metricSchema = z.object({
  objective_id: optionalUuid,
  project_id: optionalUuid,
  name: z.string().trim().min(2).max(180),
  description: optionalText(),
  metric_type: z.enum(METRIC_TYPES),
  unit: optionalText(40),
  baseline_value: optionalNumber,
  target_value: optionalNumber,
  current_value: optionalNumber,
  measurement_date: optionalDate,
});

export const projectMemorySchema = z.object({
  project_id: z.string().uuid(),
  memory_type: z.enum(["context", "decision_context", "constraint", "assumption", "learning", "reference"]),
  title: z.string().trim().min(2).max(180),
  content: z.string().trim().min(2).max(12000),
  source: optionalText(1000),
});

export const decisionSchema = z.object({
  project_id: optionalUuid,
  title: z.string().trim().min(2).max(180),
  context: optionalText(6000),
  options_considered: optionalText(6000),
  decision: z.string().trim().min(2).max(6000),
  rationale: optionalText(6000),
  outcome: optionalText(6000),
});

export const commercialProfileSchema = z.object({
  project_id: z.string().uuid(),
  is_priority: z.preprocess((value) => value === "on" || value === "true", z.boolean()),
  offer: optionalText(6000),
  ideal_customer: optionalText(4000),
  price: optionalNumber,
  currency: optionalText(8),
  channel: optionalText(1000),
  validation_status: z.enum(["not_ready", "draft", "ready_to_validate", "validating", "validated"]),
});

export const commercialLeadSchema = z.object({
  project_id: z.string().uuid(),
  name: z.string().trim().min(2).max(180),
  organisation: optionalText(180),
  contact_reference: optionalText(500),
  source: optionalText(500),
  stage: z.enum(["lead", "contacted", "qualified", "proposal", "negotiation", "won", "lost"]),
  value: optionalNumber,
  currency: optionalText(8),
  next_action: optionalText(1000),
  next_action_at: optionalDateTime,
  risk: optionalText(1000),
  information_missing: optionalText(2000),
});

export const financialEntrySchema = z.object({
  project_id: z.string().uuid(),
  entry_type: z.enum(["revenue", "cost"]),
  category: optionalText(180),
  description: z.string().trim().min(2).max(1000),
  amount: z.coerce.number().finite().min(0),
  currency: z.string().trim().min(2).max(8),
  occurred_on: optionalDate,
  status: z.enum(["actual", "forecast", "pending"]),
  evidence_reference: optionalText(1000),
});

export const subscriptionFunnelMetricSchema = z.object({
  project_id: z.string().uuid(),
  metric_date: optionalDate,
  acquired: z.coerce.number().int().min(0),
  payment_started: z.coerce.number().int().min(0),
  paid: z.coerce.number().int().min(0),
  activated: z.coerce.number().int().min(0),
  retained: z.coerce.number().int().min(0),
  churned: z.coerce.number().int().min(0),
  notes: optionalText(4000),
});

export const agentRunSchema = z.object({
  project_id: optionalUuid,
  agent_type: z.enum(["command", "research", "business", "marketing", "product", "qa", "analytics"]),
  prompt_code: optionalText(40),
  objective: z.string().trim().min(3).max(4000),
});

export const intelligenceSignalSchema = z.object({
  project_id: optionalUuid,
  signal_type: z.enum(["briefing", "opportunity", "risk", "market", "customer", "operational"]),
  title: z.string().trim().min(3).max(240),
  summary: optionalText(6000),
  source_reference: optionalText(1000),
  confidence: z.enum(["unverified", "low", "medium", "high", "verified"]),
  status: z.enum(["new", "reviewed", "actionable", "dismissed", "converted"]),
  action_hint: optionalText(2000),
});

export function zodMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Dados inválidos.";
}
