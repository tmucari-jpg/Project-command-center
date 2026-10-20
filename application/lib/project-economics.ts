import {
  calculateArpu,
  calculateCac,
  calculateConversionRate,
  calculateGrossMarginPct,
  type AutofillResult,
} from "@/lib/autofill-policy";

type Lead = {
  stage?: string | null;
  value?: number | null;
  currency?: string | null;
};

type FinancialEntry = {
  entry_type?: string | null;
  category?: string | null;
  amount?: number | null;
  currency?: string | null;
  status?: string | null;
};

type ExistingEconomics = {
  cac?: number | null;
  conversion_rate_pct?: number | null;
  arpu?: number | null;
  gross_margin_pct?: number | null;
  payback_months?: number | null;
  currency?: string | null;
};

export type EconomicSnapshot = {
  cac: AutofillResult<number>;
  conversionRate: AutofillResult<number>;
  arpu: AutofillResult<number>;
  grossMargin: AutofillResult<number>;
  paybackMonths: AutofillResult<number>;
  currency: AutofillResult<string>;
};

function recorded(value: number | null | undefined, field: string): AutofillResult<number> | null {
  if (value == null) return null;
  return { value, state: "inferred", source: [`project_unit_economics.${field}`], missing: [] };
}

function withSource(result: AutofillResult<number>, source: string[]) {
  return result.value == null ? result : { ...result, source };
}

export function deriveProjectEconomics(input: {
  leads?: Lead[] | null;
  financialEntries?: FinancialEntry[] | null;
  existing?: ExistingEconomics | null;
  projectCurrency?: string | null;
  commercialCurrency?: string | null;
}): EconomicSnapshot {
  const leads = input.leads ?? [];
  const entries = (input.financialEntries ?? []).filter((item) => item.status === "actual");

  const qualifiedStages = new Set(["qualified", "proposal", "negotiation", "won"]);
  const qualified = leads.filter((item) => qualifiedStages.has(item.stage ?? "")).length;
  const won = leads.filter((item) => item.stage === "won").length;

  const actualRevenue = entries
    .filter((item) => item.entry_type === "revenue")
    .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const wonLeadRevenue = leads
    .filter((item) => item.stage === "won")
    .reduce((sum, item) => sum + Number(item.value ?? 0), 0);
  const revenue = actualRevenue > 0 ? actualRevenue : wonLeadRevenue > 0 ? wonLeadRevenue : null;
  const revenueSource = actualRevenue > 0 ? ["financial_entries.actual_revenue"] : ["commercial_leads.won_value"];

  const acquisitionPattern = /(acquisition|aquisi|marketing|sales|vendas|comercial)/i;
  const acquisitionCost = entries
    .filter((item) => item.entry_type === "cost" && acquisitionPattern.test(item.category ?? ""))
    .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);

  const variablePattern = /(variable|vari[aá]vel|cogs|cost of goods)/i;
  const variableCost = entries
    .filter((item) => item.entry_type === "cost" && variablePattern.test(item.category ?? ""))
    .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);

  const cac =
    recorded(input.existing?.cac, "cac") ??
    withSource(calculateCac(acquisitionCost > 0 ? acquisitionCost : null, won || null), [
      "financial_entries.acquisition_cost",
      "commercial_leads.won",
    ]);

  const conversionRate =
    recorded(input.existing?.conversion_rate_pct, "conversion_rate_pct") ??
    withSource(calculateConversionRate(won || null, qualified || null), [
      "commercial_leads.won",
      "commercial_leads.qualified",
    ]);

  const arpu =
    recorded(input.existing?.arpu, "arpu") ??
    withSource(calculateArpu(revenue, won || null), [
      ...revenueSource,
      "commercial_leads.won",
    ]);

  const grossMargin =
    recorded(input.existing?.gross_margin_pct, "gross_margin_pct") ??
    withSource(calculateGrossMarginPct(revenue, variableCost > 0 ? variableCost : null), [
      ...revenueSource,
      "financial_entries.variable_cost",
    ]);

  const paybackMonths =
    recorded(input.existing?.payback_months, "payback_months") ?? {
      value: null,
      state: "missing",
      source: [],
      missing: ["monthly_contribution", "investment_period"],
    };

  const currencyValue =
    input.existing?.currency ??
    input.projectCurrency ??
    input.commercialCurrency ??
    entries.find((item) => item.currency)?.currency ??
    leads.find((item) => item.currency)?.currency ??
    null;

  return {
    cac,
    conversionRate,
    arpu,
    grossMargin,
    paybackMonths,
    currency: currencyValue
      ? { value: currencyValue, state: "inferred", source: ["project/commercial/data"], missing: [] }
      : { value: null, state: "missing", source: [], missing: ["currency"] },
  };
}
