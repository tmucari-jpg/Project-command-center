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
  workstream: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? "general" : value),
    z.enum(["general", "commercial", "sales", "marketing", "monetization", "financial", "operational", "governance", "security", "technical", "other"]),
  ),
  owner_id: optionalUuid,
  supersedes_deliverable_id: optionalUuid,
  title: z.string().trim().min(2).max(180),
  description: optionalText(),
  priority: z.enum(PRIORITIES),
  status: z.enum(STATUS_OPTIONS.deliverables),
  due_date: optionalDate,
  progress,
  completion_criteria: optionalText(),
  artifact_type: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? "other" : value),
    z.enum([
      "document",
      "spreadsheet",
      "presentation",
      "pdf",
      "website",
      "application",
      "dashboard",
      "api",
      "dataset",
      "prototype",
      "other",
    ]),
  ),
  artifact_url: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().url().max(1000).optional(),
  ),
  artifact_reference: optionalText(500),
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

export const competitiveIntelligenceSchema = z.object({
  factory_case_id: z.string().uuid(),
  market_summary: z.string().trim().min(3).max(8000),
  competitors: z.string().trim().min(3).max(8000),
  existing_solutions: z.string().trim().min(3).max(8000),
  differentiation: z.string().trim().min(3).max(8000),
  trends: z.string().trim().min(3).max(8000),
  risks_barriers: z.string().trim().min(3).max(8000),
  sources: z.string().trim().min(3).max(8000),
  confidence: z.enum(["low", "medium", "high", "verified"]),
  intent: z.enum(["save", "complete"]),
});

export const factoryValidationSchema = z.object({
  factory_case_id: z.string().uuid(),
  critical_hypotheses: z.string().trim().min(3).max(8000),
  validation_plan: z.string().trim().min(3).max(8000),
  evidence: z.string().trim().min(3).max(12000),
  result_summary: z.string().trim().min(3).max(8000),
  viability_status: z.enum(["viable", "conditional", "not_viable", "insufficient"]),
  viability_summary: z.string().trim().min(3).max(8000),
  conditions_to_proceed: optionalText(8000),
  missing_information: optionalText(8000),
  recommendation: z.enum(["proceed", "modify", "hold"]),
  arena_required: z.preprocess((value) => value === "true" || value === "on", z.boolean()),
});

export const factoryReportSchema = z.object({
  factory_case_id: z.string().uuid(),
  problem_identified: z.string().trim().min(3).max(8000),
  market: optionalText(8000),
  competitors: optionalText(8000),
  existing_solutions: optionalText(8000),
  differentiation: optionalText(8000),
  market_trend: optionalText(8000),
  technology_required: optionalText(8000),
  estimated_cost: optionalText(4000),
  revenue_model: optionalText(4000),
  risks: optionalText(8000),
  regulation: optionalText(8000),
  execution_probability: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().min(0).max(100).optional(),
  ),
  adoption_probability: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().min(0).max(100).optional(),
  ),
  critical_hypotheses: optionalText(8000),
  tests_required: optionalText(8000),
});

export const factoryDecisionSchema = z.object({
  factory_case_id: z.string().uuid(),
  decision: z.enum(["go", "modify", "hold", "kill"]),
  decision_rationale: z.string().trim().min(3).max(8000),
});

export const orchestratorRouteSchema = z.object({
  factory_case_id: optionalUuid,
  project_id: optionalUuid,
  task_type: z.enum(["command", "research", "competitive_intelligence", "business", "marketing", "product", "qa", "analytics"]),
  objective: z.string().trim().min(3).max(4000),
  risk_level: z.enum(["low", "medium", "high", "critical"]),
  factuality: z.enum(["standard", "high"]),
  cost_sensitivity: z.enum(["low", "medium", "high"]),
});

export const executionArenaTrialSchema = z.object({
  factory_case_id: optionalUuid,
  orchestrator_route_id: optionalUuid,
  scenario: z.string().trim().min(3).max(4000),
  candidate_label: z.string().trim().min(2).max(180),
  model_label: optionalText(180),
  agent_type: z.enum(["command", "research", "business", "marketing", "product", "qa", "analytics"]),
  strategy: z.string().trim().min(2).max(180),
  tool_label: optionalText(180),
  quality_score: z.coerce.number().int().min(0).max(100),
  factuality_score: z.coerce.number().int().min(0).max(100),
  task_success_score: z.coerce.number().int().min(0).max(100),
  duration_ms: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().min(0).optional(),
  ),
  cost_amount: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : value),
    z.coerce.number().min(0).optional(),
  ),
  cost_currency: optionalText(8),
  human_correction_minutes: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().min(0).optional(),
  ),
  review_notes: optionalText(4000),
});

export const automationWorkflowSchema = z.object({
  code: z.string().trim().min(2).max(120).regex(/^[a-z0-9_-]+$/i, "Código inválido."),
  name: z.string().trim().min(2).max(180),
  description: optionalText(4000),
  trigger_mode: z.enum(["webhook", "poll"]),
  requires_approval: z.preprocess((value) => value === "true" || value === "on", z.boolean()),
});

export const automationJobSchema = z.object({
  workflow_id: optionalUuid,
  orchestrator_route_id: optionalUuid,
  factory_case_id: optionalUuid,
  project_id: optionalUuid,
  objective: z.string().trim().min(3).max(4000),
  payload_json: optionalText(12000),
  priority: z.enum(["low", "normal", "high"]),
});

export const factoryLibraryItemSchema = z.object({
  asset_type: z.enum(["component", "workflow", "template", "prompt", "strategy", "lesson"]),
  title: z.string().trim().min(2).max(180),
  summary: optionalText(4000),
  content_text: z.string().trim().min(2).max(12000),
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
  stage: z.enum(["contact", "interest", "diagnosis", "demo", "proposal", "won", "lost"]),
  value: optionalNumber,
  currency: optionalText(8),
  next_action: optionalText(1000),
  next_action_at: optionalDateTime,
  risk: optionalText(1000),
  information_missing: optionalText(2000),
});

export const financialEntrySchema = z
  .object({
    project_id: z.string().uuid(),
    entry_type: z.enum(["revenue", "cost"]),
    category: optionalText(180),
    description: z.string().trim().min(2).max(1000),
    amount: z.coerce.number().finite().min(0),
    currency: z.string().trim().min(2).max(8),
    occurred_on: optionalDate,
    status: z.enum(["actual", "forecast", "pending"]),
    evidence_reference: optionalText(1000),
    cost_classification: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.enum(["internal_pcc", "client_direct", "reimbursable_external", "additional_scope"]).optional(),
    ),
    supplier_name: optionalText(180),
    recurrence: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.enum(["one_off", "monthly", "annual", "usage"]).optional(),
    ),
    client_approved: z.preprocess((value) => value === "on" || value === "true", z.boolean()),
    related_deliverable_id: optionalUuid,
  })
  .refine((data) => data.entry_type !== "cost" || Boolean(data.cost_classification), {
    message: "Classifique o custo como interno PCC, directo do cliente, reembolsável externo ou âmbito adicional.",
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

export const projectCommitmentSchema = z
  .object({
    project_id: z.string().uuid(),
    expected_result: z.string().trim().min(3).max(8000),
    scope_included: z.string().trim().min(3).max(12000),
    exclusions: z.string().trim().min(2).max(8000),
    deliverables_summary: z.string().trim().min(3).max(12000),
    acceptance_summary: z.string().trim().min(3).max(8000),
    pcc_responsibilities: z.string().trim().min(3).max(8000),
    client_responsibilities: z.string().trim().min(3).max(8000),
    assumptions_dependencies: z.string().trim().min(3).max(8000),
    capacity_validation: z.string().trim().min(3).max(8000),
    financial_validation: z.string().trim().min(3).max(8000),
    security_validation: z.string().trim().min(3).max(8000),
    external_costs_note: z.string().trim().min(3).max(8000),
    validation_milestones: optionalText(8000),
    payment_terms: optionalText(4000),
    asset_ownership_terms: optionalText(6000),
    intellectual_property_terms: optionalText(6000),
    post_delivery_terms: optionalText(6000),
    capacity_required_hours: optionalNumber,
    capacity_available_hours: optionalNumber,
    capacity_period: optionalText(180),
    capacity_exception_approved: z.preprocess((value) => value === "on" || value === "true", z.boolean()),
    capacity_exception_rationale: optionalText(4000),
    estimated_pcc_cost: optionalNumber,
    minimum_margin_pct: z.preprocess(
      (value) => (value === "" || value === null || value === undefined ? 20 : value),
      z.coerce.number().finite().min(0).max(100),
    ),
    margin_exception_approved: z.preprocess((value) => value === "on" || value === "true", z.boolean()),
    margin_exception_rationale: optionalText(4000),
    price: optionalNumber,
    currency: optionalText(8),
    due_date: optionalDate,
    intent: z.enum(["save", "submit_client"]),
  })
  .superRefine((data, ctx) => {
    if ((data.capacity_required_hours == null) !== (data.capacity_available_hours == null)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Informe capacidade necessária e disponível em conjunto." });
    }
    if (
      data.capacity_required_hours != null &&
      data.capacity_available_hours != null &&
      data.capacity_required_hours > data.capacity_available_hours &&
      !data.capacity_exception_approved
    ) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "A capacidade disponível é inferior à necessária. Registe uma excepção de capacidade fundamentada antes de avançar." });
    }
    if (data.intent === "submit_client") {
      for (const [value, message] of [
        [data.validation_milestones, "Defina os marcos de validação antes de apresentar o compromisso ao cliente."],
        [data.payment_terms, "Defina as condições de pagamento."],
        [data.asset_ownership_terms, "Defina a propriedade dos activos."],
        [data.intellectual_property_terms, "Defina as condições de propriedade intelectual."],
        [data.post_delivery_terms, "Defina as condições pós-entrega, correcção e suporte."],
      ] as const) {
        if (!value?.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
      }
      if (data.price != null && data.estimated_pcc_cost == null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Antes do compromisso comercial, estime o custo PCC da entrega." });
      }
      if (data.price != null && data.estimated_pcc_cost != null && data.price > 0) {
        const marginPct = ((data.price - data.estimated_pcc_cost) / data.price) * 100;
        if (marginPct < data.minimum_margin_pct && !data.margin_exception_approved) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `A margem estimada (${marginPct.toFixed(1)}%) está abaixo do mínimo de ${data.minimum_margin_pct}%.` });
        }
      }
      if (data.capacity_exception_approved && !data.capacity_exception_rationale?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Fundamente a excepção de capacidade." });
      }
      if (data.margin_exception_approved && !data.margin_exception_rationale?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Fundamente a excepção de margem." });
      }
    }
  });
export const projectCommitmentDecisionSchema = z
  .object({
    project_id: z.string().uuid(),
    baseline_id: z.string().uuid(),
    decision: z.enum(["approved", "rejected"]),
    client_validator: z.string().trim().min(2).max(180),
    approval_reference: optionalText(1000),
    notes: optionalText(4000),
  })
  .refine((data) => data.decision !== "approved" || Boolean(data.approval_reference?.trim()), {
    message: "Registe a referência da aprovação do cliente.",
  });

export const projectChangeRequestSchema = z.object({
  project_id: z.string().uuid(),
  request_summary: z.string().trim().min(3).max(8000),
  impact_scope: z.string().trim().min(2).max(8000),
  impact_schedule: z.string().trim().min(2).max(4000),
  impact_cost: z.string().trim().min(2).max(4000),
  impact_capacity: z.string().trim().min(2).max(4000),
  impact_security: z.string().trim().min(2).max(4000),
  affected_areas: z.string().trim().min(2).max(2000),
  cost_delta: optionalNumber,
  currency: optionalText(8),
  due_date_delta_days: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().min(-3650).max(3650).optional(),
  ),
});

export const projectChangeDecisionSchema = z.object({
  project_id: z.string().uuid(),
  change_request_id: z.string().uuid(),
  decision: z.enum(["approved", "rejected", "implemented"]),
  decision_rationale: z.string().trim().min(2).max(6000),
});

export const deliverableQaSchema = z.object({
  deliverable_id: z.string().uuid(),
  project_id: z.string().uuid(),
  qa_status: z.enum(["passed", "failed"]),
  qa_notes: optionalText(4000),
});

export const deliverableAcceptanceSchema = z
  .object({
    deliverable_id: z.string().uuid(),
    project_id: z.string().uuid(),
    status: z.enum(["in_review", "accepted", "accepted_with_reservations", "changes_requested"]),
    actor_name: z.string().trim().min(2).max(180),
    notes: optionalText(6000),
    evidence_reference: optionalText(1000),
  })
  .refine(
    (data) =>
      !["accepted", "accepted_with_reservations"].includes(data.status) ||
      Boolean(data.evidence_reference?.trim()),
    { message: "Registe a referência que comprova a aceitação do cliente." },
  );

export const projectClosureAssessmentSchema = z.object({
  project_id: z.string().uuid(),
  value_status: z.enum(["not_assessed", "proven", "observing", "not_proven"]),
  value_summary: z.string().trim().min(2).max(8000),
  client_acceptance_complete: z.preprocess((value) => value === "on" || value === "true", z.boolean()),
  changes_closed: z.preprocess((value) => value === "on" || value === "true", z.boolean()),
  financials_updated: z.preprocess((value) => value === "on" || value === "true", z.boolean()),
  handover_required: z.preprocess((value) => value === "on" || value === "true", z.boolean()),
  handover_complete: z.preprocess((value) => value === "on" || value === "true", z.boolean()),
  access_transfer_complete: z.preprocess((value) => value === "on" || value === "true", z.boolean()),
  temporary_access_revoked: z.preprocess((value) => value === "on" || value === "true", z.boolean()),
  data_retention_reviewed: z.preprocess((value) => value === "on" || value === "true", z.boolean()),
  security_transfer_notes: optionalText(8000),
  continuity_notes: optionalText(8000),
});

export const projectGovernanceRiskSchema = z
  .object({
    project_id: z.string().uuid(),
    gate: z.enum(["g3_planning", "g4_execution", "g5_closure"]),
    category: z.enum(["security", "privacy", "compliance", "market", "financial", "operational", "technology", "third_party", "other"]),
    title: z.string().trim().min(2).max(240),
    description: optionalText(6000),
    severity: z.enum(["low", "medium", "high", "critical"]),
    blocks_progress: z.preprocess((value) => value === "on" || value === "true", z.boolean()),
    mitigation_plan: optionalText(6000),
  })
  .refine((data) => data.severity !== "critical" || data.blocks_progress, {
    message: "Um risco crítico deve bloquear o avanço até ser mitigado, aceite formalmente ou resolvido.",
  });

export const projectGovernanceRiskUpdateSchema = z.object({
  project_id: z.string().uuid(),
  risk_id: z.string().uuid(),
  status: z.enum(["open", "mitigating", "mitigated", "accepted", "resolved"]),
  mitigation_plan: optionalText(6000),
  evidence: optionalText(6000),
});

export const projectGovernanceDependencySchema = z.object({
  project_id: z.string().uuid(),
  gate: z.enum(["g3_planning", "g4_execution", "g5_closure"]),
  kind: z.enum(["information", "validation", "confirmation", "decision"]),
  owner_role: z.enum(["pcc", "project_owner", "client"]),
  required_item: z.string().trim().min(2).max(500),
  description: optionalText(6000),
  source_reference: optionalText(1000),
  blocks_progress: z.preprocess((value) => value === "on" || value === "true", z.boolean()),
});

export function zodMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Dados inválidos.";
}
