import { calculateArpu, calculateCac, calculateConversionRate, calculateGrossMarginPct, type AutofillResult } from "@/lib/autofill-policy";
export const OFFICIAL_CURRENCY = "MZN";
type Lead = { stage?: string | null; value?: number | null; currency?: string | null };
type Entry = { entry_type?: string | null; category?: string | null; amount?: number | null; currency?: string | null; status?: string | null; occurred_on?: string | null };
type Existing = { cac?: number | null; conversion_rate_pct?: number | null; arpu?: number | null; gross_margin_pct?: number | null; payback_months?: number | null; currency?: string | null };
export type EconomicSnapshot = { cac: AutofillResult<number>; conversionRate: AutofillResult<number>; arpu: AutofillResult<number>; grossMargin: AutofillResult<number>; paybackMonths: AutofillResult<number>; currency: AutofillResult<string> };
type Rate = { currency: string; mznPerUnit: number; asOf: string; source: string };
const missing = (...fields: string[]): AutofillResult<number> => ({ value: null, state: "missing", source: [], missing: fields });
function recorded(value: number | null | undefined, field: string) {
  return value == null || !Number.isFinite(value) ? null : { value, state: "inferred" as const, source: [`project_unit_economics.${field}`], missing: [] };
}
export function deriveProjectEconomics(input: { leads?: Lead[] | null; financialEntries?: Entry[] | null; existing?: Existing | null; projectCurrency?: string | null; commercialCurrency?: string | null; exchangeRates?: Rate[]; activeCustomers?: number; acquiredCustomers?: number; reportingPeriod?: { start: string; end: string } }): EconomicSnapshot {
  const leads = input.leads ?? [], entries = (input.financialEntries ?? []).filter(e => e.status === "actual");
  const qualified = leads.filter(l => ["qualified", "proposal", "negotiation", "won", "diagnosis", "demonstration", "client", "handoff"].includes(l.stage ?? "")).length;
  const wins = leads.filter(l => ["won", "client", "handoff"].includes(l.stage ?? "")), won = wins.length;
  const rates = input.exchangeRates ?? [];
  const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0,10) === date;
  const period = input.reportingPeriod;
  const invalidPeriod = Boolean(period && (!validDate(period.start) || !validDate(period.end) || period.start > period.end));
  const unknownPeriodEntries = Boolean(period && entries.some(e => !e.occurred_on || !validDate(e.occurred_on)));
  const periodEntries = period && !invalidPeriod ? entries.filter(e => e.occurred_on && e.occurred_on >= period.start && e.occurred_on <= period.end) : entries;

  function sum(rows: Array<{ value?: number | null; currency?: string | null }>, source: string) {
    if (!rows.length) return missing(source);
    const sources = [source, ...(period ? [`period:${period.start}/${period.end}`] : ["period:cumulative_unspecified"])];
    let total = 0;
    for (const row of rows) {
      if (row.value == null || !Number.isFinite(Number(row.value))) return missing(`${source}.amount`);
      const currency = (row.currency || input.projectCurrency || input.commercialCurrency)?.trim().toUpperCase();
      if (!currency) return missing(`${source}.currency`);
      if (currency === OFFICIAL_CURRENCY) { total += Number(row.value); continue; }
      const rate = rates.find(r => r.currency.toUpperCase() === currency && Number.isFinite(r.mznPerUnit) && r.mznPerUnit > 0 && /^\d{4}-\d{2}-\d{2}$/.test(r.asOf) && validDate(r.asOf) && r.source.trim());
      if (!rate) return missing(`exchange_rate_${currency}_to_MZN`);
      total += Number(row.value) * rate.mznPerUnit;
      sources.push(`fx:${currency}/MZN:${rate.mznPerUnit}:${rate.asOf}:${rate.source}`);
    }
    return { value: total, state: "calculated" as const, source: sources, missing: [] };
  }
  const revenueRows = periodEntries.filter(e => e.entry_type === "revenue");
  const revenue = revenueRows.length ? sum(revenueRows.map(e => ({ value: e.amount, currency: e.currency })), "financial_entries.actual_revenue") : period ? missing("financial_entries.actual_revenue_in_period") : sum(wins.map(l => ({ value: l.value, currency: l.currency })), "commercial_leads.won_value");
  const costs = (pattern: RegExp, field: string) => sum(periodEntries.filter(e => e.entry_type === "cost" && pattern.test(e.category ?? "")).map(e => ({ value: e.amount, currency: e.currency })), field);
  const acquisition = costs(/(acquisition|aquisi|marketing|sales|vendas|comercial)/i, "financial_entries.acquisition_cost");
  const variable = costs(/(variable|vari[aá]vel|cogs|cost of goods)/i, "financial_entries.variable_cost");
  // Historical monetary observations stay untouched; never relabel EUR as MZN.
  const recordedMoney = (value: number | null | undefined, field: string) => {
    if (value == null) return null;
    if (input.existing?.currency?.toUpperCase() !== OFFICIAL_CURRENCY) return missing(`project_unit_economics.${field}.currency_MZN`);
    return recorded(value, field);
  };
  const withSources = (value: AutofillResult<number>, sources: string[]) => value.value == null ? value : { ...value, source: sources };
  const cac: AutofillResult<number> = recordedMoney(input.existing?.cac, "cac") ?? (acquisition.value == null ? acquisition : withSources(calculateCac(acquisition.value, input.acquiredCustomers ?? won), [...acquisition.source, input.acquiredCustomers == null ? "commercial_leads.won" : "verified_customers.acquired_in_period"]));
  const arpu: AutofillResult<number> = recordedMoney(input.existing?.arpu, "arpu") ?? (revenue.value == null ? revenue : withSources(calculateArpu(revenue.value, input.activeCustomers ?? won), [...revenue.source, input.activeCustomers == null ? "commercial_leads.won" : "verified_customers.active_in_period"]));
  const grossMargin: AutofillResult<number> = recorded(input.existing?.gross_margin_pct, "gross_margin_pct") ?? (revenue.value == null ? revenue : variable.value == null ? variable : withSources(calculateGrossMarginPct(revenue.value, variable.value), [...revenue.source, ...variable.source]));
  // A commercial commitment is not collected revenue; show the fallback as an estimate.
  if(!revenueRows.length){
    if(arpu.value!=null && input.existing?.arpu == null)arpu.state="estimated";
    if(grossMargin.value!=null && input.existing?.gross_margin_pct == null)grossMargin.state="estimated";
  }
  // Lead counts are acquisition proxies, not verified active-customer observations.
  if (arpu.value != null && input.existing?.arpu == null && (input.activeCustomers == null || !period)) {
    arpu.state = "estimated"; arpu.source.push("proxy:acquired_leads_not_verified_active_customers", "period:not_verified");
  }
  if (cac.value != null && input.existing?.cac == null && (input.acquiredCustomers == null || !period)) {
    cac.state = "estimated"; cac.source.push("proxy:lead_cohort_not_verified", "period:not_verified");
  }
  if (invalidPeriod || unknownPeriodEntries) {
    for (const metric of [cac, arpu, grossMargin]) {
      metric.value = null; metric.state = "missing"; metric.source = [];
      metric.missing = [invalidPeriod ? "valid_reporting_period" : "financial_entries.occurred_on"];
    }
  }
  return { cac, arpu, grossMargin,
    conversionRate: recorded(input.existing?.conversion_rate_pct, "conversion_rate_pct") ?? withSources(calculateConversionRate(won, qualified), ["commercial_leads.won", "commercial_leads.qualified"]),
    paybackMonths: recorded(input.existing?.payback_months, "payback_months") ?? missing("monthly_contribution", "investment_period"),
    currency: { value: OFFICIAL_CURRENCY, state: "calculated", source: ["PCC.official_currency"], missing: [] },
  };
}
