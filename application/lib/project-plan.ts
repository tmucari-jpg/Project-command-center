type JsonRecord = Record<string, unknown>;

type ProjectPlanInput = {
  project: {
    id: string;
    title: string;
    description?: string | null;
    expected_result?: string | null;
    priority?: string | null;
    status?: string | null;
    progress?: number | string | null;
    next_action?: string | null;
  };
  factory?: {
    id?: string | null;
    problem?: string | null;
    target_user?: string | null;
    expected_value?: string | null;
    constraints?: string | null;
  } | null;
  report?: {
    market?: string | null;
    competitors?: string | null;
    existing_solutions?: string | null;
    differentiation?: string | null;
    market_trend?: string | null;
    revenue_model?: string | null;
    estimated_cost?: string | null;
    risks?: string | null;
  } | null;
  intelligence?: {
    market_summary?: string | null;
    competitors?: string | null;
    existing_solutions?: string | null;
    differentiation?: string | null;
    trends?: string | null;
    risks_barriers?: string | null;
  } | null;
  commercial?: {
    id?: string | null;
    offer?: string | null;
    ideal_customer?: string | null;
    price?: number | string | null;
    currency?: string | null;
    channel?: string | null;
    validation_status?: string | null;
  } | null;
  operational?: {
    deliverables: number;
    actions: number;
    openBlockers: number;
    evidence: number;
    leads: number;
    nextSalesAction?: string | null;
  };
  metrics?: Array<{
    name: string;
    unit?: string | null;
    baseline_value?: number | string | null;
    target_value?: number | string | null;
    current_value?: number | string | null;
  }>;
};

function clean(value: string | null | undefined) {
  return value?.trim() || null;
}

export function buildStrategyExecutionPlan(input: ProjectPlanInput) {
  const { project, factory, report, intelligence, commercial, operational, metrics = [] } = input;
  const target = clean(commercial?.ideal_customer) ?? clean(factory?.target_user);
  const market = clean(intelligence?.market_summary) ?? clean(report?.market);
  const differentiation = clean(intelligence?.differentiation) ?? clean(report?.differentiation);
  const risks = clean(intelligence?.risks_barriers) ?? clean(report?.risks);
  const channel = clean(commercial?.channel);
  const revenueModel = clean(report?.revenue_model);
  const validationStatus = clean(commercial?.validation_status) ?? "not_ready";

  const strategy: JsonRecord = {
    problem: clean(factory?.problem) ?? clean(project.description),
    expected_result: clean(project.expected_result) ?? clean(factory?.expected_value),
    target_user: target,
    market_context: market,
    competitors: clean(intelligence?.competitors) ?? clean(report?.competitors),
    existing_solutions: clean(intelligence?.existing_solutions) ?? clean(report?.existing_solutions),
    differentiation,
    trends: clean(intelligence?.trends) ?? clean(report?.market_trend),
    risks,
    constraints: clean(factory?.constraints),
    priority: project.priority ?? null,
    project_status: project.status ?? null,
  };

  const monetization: JsonRecord = {
    offer: clean(commercial?.offer),
    ideal_customer: target,
    revenue_model: revenueModel,
    price: commercial?.price ?? null,
    currency: clean(commercial?.currency),
    commercial_channel: channel,
    estimated_cost: clean(report?.estimated_cost),
    validation_status: validationStatus,
    validation_plan:
      "Validar proposta de valor, willingness-to-pay, preço, canal de pagamento, conversão e retenção antes de escalar.",
  };

  const marketing: JsonRecord = {
    goal: clean(project.expected_result) ?? clean(factory?.expected_value),
    target_audience: target,
    market_context: market,
    positioning_basis: differentiation,
    market_trends: clean(intelligence?.trends) ?? clean(report?.market_trend),
    primary_channel: channel,
    message_plan: "Transformar a proposta de valor e a diferenciação validada em mensagens por canal.",
    content_plan: "Definir calendário, formatos e conteúdos depois de validar público, mensagem e canal prioritário.",
    campaign_plan: "Executar piloto de aquisição, medir resposta e conversão, ajustar e só depois escalar.",
    launch_plan: "Piloto → validação → lançamento controlado → escala condicionada por métricas.",
  };

  const sales: JsonRecord = {
    ideal_customer: target,
    channel,
    funnel: "Lead → contacto → qualificação → proposta → negociação → ganho/perda",
    lead_count: operational?.leads ?? 0,
    next_sales_action: clean(operational?.nextSalesAction),
  };

  const execution: JsonRecord = {
    next_action: clean(project.next_action),
    deliverables: operational?.deliverables ?? 0,
    actions: operational?.actions ?? 0,
    open_blockers: operational?.openBlockers ?? 0,
    evidence_count: operational?.evidence ?? 0,
    execution_sequence: "Próxima acção → evidência → actualização da métrica → decisão → próxima acção.",
  };

  const measurement: JsonRecord = {
    project_progress: Number(project.progress ?? 0),
    metrics: metrics.map((metric) => ({
      name: metric.name,
      unit: metric.unit ?? null,
      baseline: metric.baseline_value ?? null,
      target: metric.target_value ?? null,
      current: metric.current_value ?? null,
    })),
    review_cadence: "Rever após evidência material, alteração de métrica ou decisão relevante.",
    decision_rule: "Escalar apenas quando a evidência e as métricas sustentarem a decisão.",
  };

  const missingItems = [
    !target ? "Público-alvo / cliente ideal" : null,
    !differentiation ? "Diferenciação / posicionamento" : null,
    !revenueModel ? "Modelo de receita" : null,
    commercial?.price == null ? "Preço validado" : null,
    !channel ? "Canal comercial / aquisição prioritário" : null,
    validationStatus !== "validated" ? "Validação comercial" : null,
  ].filter((item): item is string => Boolean(item));

  return {
    strategy,
    monetization,
    marketing,
    sales,
    execution,
    measurement,
    missing_items: missingItems,
    source_snapshot: {
      project_id: project.id,
      factory_case_id: factory?.id ?? null,
      commercial_profile_id: commercial?.id ?? null,
      generated_at: new Date().toISOString(),
    },
    status: "prepared" as const,
  };
}
