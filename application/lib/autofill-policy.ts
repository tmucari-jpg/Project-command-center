export type AutofillState = "calculated" | "inferred" | "estimated" | "missing";
export type DependencyOwner = "pcc" | "project_owner";
export type DependencyKind = "information" | "validation" | "confirmation" | "decision";

export type AutofillResult<T> = {
  value: T | null;
  state: AutofillState;
  source: string[];
  missing: string[];
};

export const AUTOFILL_SOURCE_PRIORITY = {
  owner_id: ["project.owner_id", "authenticated_owner"],
  governance_gate: ["project.governance_gate", "project.status"],
  currency: ["project.currency", "commercial_profile.currency", "unit_economics.currency"],
  price: ["commercial_profile.price", "validated_factory_report"],
  revenue: ["commercial_leads.value", "validated_metric", "validated_forecast"],
  acquisition_cost: ["validated_metric", "project_cost_record"],
  customers_acquired: ["commercial_leads", "validated_metric"],
  active_customers: ["commercial_leads", "validated_metric"],
  variable_cost: ["validated_metric", "project_cost_record"],
  investment: ["project.budget", "validated_factory_report.estimated_cost", "project_cost_record"],
  success_probability: ["validated_factory_evidence", "validated_agent_assessment"],
  risk_adjusted: ["project_governance_risks"],
} as const;

export function dependencyOwner(kind: DependencyKind, canPccResolve: boolean): DependencyOwner {
  if (kind === "decision") return "project_owner";
  return canPccResolve ? "pcc" : "project_owner";
}

function result<T>(
  value: T | null,
  state: AutofillState,
  source: string[] = [],
  missing: string[] = [],
): AutofillResult<T> {
  if (typeof value === "number" && !Number.isFinite(value)) return { value: null, state: "missing", source: [], missing: ["finite_numeric_inputs"] };
  return { value, state, source, missing };
}

export function calculateCac(acquisitionCost?: number | null, customersAcquired?: number | null) {
  if ([acquisitionCost,customersAcquired].some(value => value != null && !Number.isFinite(value))) return result<number>(null, "missing", [], ["finite_numeric_inputs"]);
  if (acquisitionCost == null || customersAcquired == null || customersAcquired <= 0) {
    return result<number>(null, "missing", [], [
      ...(acquisitionCost == null ? ["acquisition_cost"] : []),
      ...(customersAcquired == null || customersAcquired <= 0 ? ["customers_acquired"] : []),
    ]);
  }
  return result(acquisitionCost / customersAcquired, "calculated", [
    "acquisition_cost",
    "customers_acquired",
  ]);
}

export function calculateConversionRate(converted?: number | null, qualified?: number | null) {
  if ([converted,qualified].some(value => value != null && !Number.isFinite(value))) return result<number>(null, "missing", [], ["finite_numeric_inputs"]);
  if (converted == null || qualified == null || qualified <= 0) {
    return result<number>(null, "missing", [], [
      ...(converted == null ? ["converted"] : []),
      ...(qualified == null || qualified <= 0 ? ["qualified"] : []),
    ]);
  }
  return result((converted / qualified) * 100, "calculated", ["converted", "qualified"]);
}

export function calculateArpu(revenue?: number | null, activeCustomers?: number | null) {
  if ([revenue,activeCustomers].some(value => value != null && !Number.isFinite(value))) return result<number>(null, "missing", [], ["finite_numeric_inputs"]);
  if (revenue == null || activeCustomers == null || activeCustomers <= 0) {
    return result<number>(null, "missing", [], [
      ...(revenue == null ? ["revenue"] : []),
      ...(activeCustomers == null || activeCustomers <= 0 ? ["active_customers"] : []),
    ]);
  }
  return result(revenue / activeCustomers, "calculated", ["revenue", "active_customers"]);
}

export function calculateGrossMarginPct(revenue?: number | null, variableCost?: number | null) {
  if ([revenue,variableCost].some(value => value != null && !Number.isFinite(value))) return result<number>(null, "missing", [], ["finite_numeric_inputs"]);
  if (revenue == null || variableCost == null || revenue <= 0) {
    return result<number>(null, "missing", [], [
      ...(revenue == null || revenue <= 0 ? ["revenue"] : []),
      ...(variableCost == null ? ["variable_cost"] : []),
    ]);
  }
  return result(((revenue - variableCost) / revenue) * 100, "calculated", [
    "revenue",
    "variable_cost",
  ]);
}

export function calculatePaybackMonths(investment?: number | null, monthlyContribution?: number | null) {
  if ([investment,monthlyContribution].some(value => value != null && !Number.isFinite(value))) return result<number>(null, "missing", [], ["finite_numeric_inputs"]);
  if (investment == null || monthlyContribution == null || monthlyContribution <= 0) {
    return result<number>(null, "missing", [], [
      ...(investment == null ? ["investment"] : []),
      ...(monthlyContribution == null || monthlyContribution <= 0 ? ["monthly_contribution"] : []),
    ]);
  }
  return result(investment / monthlyContribution, "calculated", [
    "investment",
    "monthly_contribution",
  ]);
}

export function calculateRoiPct(totalReturn?: number | null, investment?: number | null) {
  if ([totalReturn,investment].some(value => value != null && !Number.isFinite(value))) return result<number>(null, "missing", [], ["finite_numeric_inputs"]);
  if (totalReturn == null || investment == null || investment <= 0) {
    return result<number>(null, "missing", [], [
      ...(totalReturn == null ? ["total_return"] : []),
      ...(investment == null || investment <= 0 ? ["investment"] : []),
    ]);
  }
  return result(((totalReturn - investment) / investment) * 100, "calculated", [
    "total_return",
    "investment",
  ]);
}

export function calculateBurnRate(cashOutflows?: number | null, cashInflows?: number | null) {
  if ([cashOutflows,cashInflows].some(value => value != null && !Number.isFinite(value))) return result<number>(null, "missing", [], ["finite_numeric_inputs"]);
  if (cashOutflows == null || cashInflows == null) {
    return result<number>(null, "missing", [], [
      ...(cashOutflows == null ? ["cash_outflows"] : []),
      ...(cashInflows == null ? ["cash_inflows"] : []),
    ]);
  }
  return result(cashOutflows - cashInflows, "calculated", ["cash_outflows", "cash_inflows"]);
}

export function calculateViabilityFactor(
  projectedRevenue?: number | null,
  successProbability?: number | null,
  investment?: number | null,
  riskAdjusted?: number | null,
) {
  if ([projectedRevenue, successProbability, investment, riskAdjusted].some(value => value != null && !Number.isFinite(value))) return result<number>(null, "missing", [], ["finite_numeric_inputs"]);
  const denominator = (investment ?? 0) + (riskAdjusted ?? 0);
  const missing = [
    ...(projectedRevenue == null ? ["projected_revenue"] : []),
    ...(successProbability == null ? ["success_probability"] : []),
    ...(investment == null ? ["investment"] : []),
    ...(riskAdjusted == null ? ["risk_adjusted"] : []),
  ];

  if (missing.length || denominator <= 0) {
    if (denominator <= 0 && !missing.includes("investment")) missing.push("positive_denominator");
    return result<number>(null, "missing", [], missing);
  }

  return result((projectedRevenue! * successProbability!) / denominator, "calculated", [
    "projected_revenue",
    "success_probability",
    "investment",
    "risk_adjusted",
  ]);
}
