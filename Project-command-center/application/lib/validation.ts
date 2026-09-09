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

export function zodMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Dados inválidos.";
}
