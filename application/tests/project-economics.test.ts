import { describe, expect, it } from "vitest";
import { deriveProjectEconomics } from "@/lib/project-economics";

describe("project economics derivation", () => {
  it("calculates only from real available records", () => {
    const result = deriveProjectEconomics({
      leads: [
        { stage: "qualified", value: 0, currency: "MZN" },
        { stage: "won", value: 1000, currency: "MZN" },
      ],
      financialEntries: [
        { entry_type: "revenue", amount: 1000, status: "actual", currency: "MZN" },
        { entry_type: "cost", category: "Marketing", amount: 200, status: "actual", currency: "MZN" },
        { entry_type: "cost", category: "Custo variável", amount: 300, status: "actual", currency: "MZN" },
      ],
    });

    expect(result.cac.value).toBe(200);
    expect(result.conversionRate.value).toBe(50);
    expect(result.arpu.value).toBe(1000);
    expect(result.grossMargin.value).toBe(70);
    expect(result.currency.value).toBe("MZN");
  });

  it("does not invent payback or economics without inputs", () => {
    const result = deriveProjectEconomics({ leads: [], financialEntries: [] });
    expect(result.cac.state).toBe("missing");
    expect(result.arpu.state).toBe("missing");
    expect(result.grossMargin.state).toBe("missing");
    expect(result.paybackMonths.state).toBe("missing");
  });

  it("preserves previously recorded values with provenance", () => {
    const result = deriveProjectEconomics({
      existing: { cac: 25, currency: "MZN" },
    });
    expect(result.cac.value).toBe(25);
    expect(result.cac.state).toBe("inferred");
    expect(result.cac.source).toContain("project_unit_economics.cac");
  });
});

describe("MZN and observed zeros", () => {
  it("reports a real zero conversion without treating it as missing", () => {
    expect(deriveProjectEconomics({leads:[{stage:"qualified"}]}).conversionRate.value).toBe(0);
  });
  it("preserves explicit zero costs and revenue", () => {
    const s=deriveProjectEconomics({leads:[{stage:"won",currency:"MZN",value:0}],financialEntries:[{entry_type:"cost",category:"Marketing",status:"actual",amount:0,currency:"MZN"}]});
    expect(s.cac.value).toBe(0);expect(s.arpu.value).toBe(0);expect(s.currency.value).toBe("MZN");
  });
  it("blocks a mixed-currency sum without a documented rate", () => {
    const s=deriveProjectEconomics({leads:[{stage:"won"}],financialEntries:[{entry_type:"revenue",amount:100,currency:"MZN",status:"actual"},{entry_type:"revenue",amount:100,currency:"EUR",status:"actual"}]});
    expect(s.arpu.value).toBeNull();expect(s.arpu.missing).toContain("exchange_rate_EUR_to_MZN");
  });
  it("converts only with rate, date and source", () => {
    const input={leads:[{stage:"won"}],financialEntries:[{entry_type:"revenue",amount:100,currency:"EUR",status:"actual"}]};
    const s=deriveProjectEconomics({...input,exchangeRates:[{currency:"EUR",mznPerUnit:70,asOf:"2026-10-28",source:"Test rate"}]});
    expect(s.arpu.value).toBe(7000);expect(s.arpu.source.join()).toContain("Test rate");
    expect(deriveProjectEconomics({...input,exchangeRates:[{currency:"EUR",mznPerUnit:70,asOf:"",source:""}]}).arpu.value).toBeNull();
  });
  it("never relabels historical EUR amounts as MZN", () => {
    const s=deriveProjectEconomics({existing:{arpu:100,currency:"EUR"}});
    expect(s.arpu.value).toBeNull();expect(s.arpu.missing).toContain("project_unit_economics.arpu.currency_MZN");
  });
});

it("uses current client/handoff stages as acquired customers alongside historical won",()=>{
 const s=deriveProjectEconomics({leads:[{stage:"diagnosis"},{stage:"client",value:100,currency:"MZN"},{stage:"handoff",value:200,currency:"MZN"}]});
 expect(s.conversionRate.value).toBeCloseTo(200/3);expect(s.arpu.value).toBe(150);
});

describe("factual financial populations and periods",()=>{
 it("labels acquired lead counts as an active-customer proxy",()=>{
  const s=deriveProjectEconomics({leads:[{stage:"won",value:100,currency:"MZN"}],financialEntries:[{entry_type:"revenue",amount:100,currency:"MZN",status:"actual"}]});
  expect(s.arpu.value).toBe(100);expect(s.arpu.state).toBe("estimated");expect(s.arpu.source.join()).toContain("not_verified_active_customers");
 });
 it("uses verified active-customer observations with actual period revenue",()=>{
  const s=deriveProjectEconomics({activeCustomers:2,reportingPeriod:{start:"2026-10-01",end:"2026-10-31"},financialEntries:[{entry_type:"revenue",amount:100,currency:"MZN",status:"actual",occurred_on:"2026-10-10"},{entry_type:"revenue",amount:900,currency:"MZN",status:"actual",occurred_on:"2026-09-10"}]});
  expect(s.arpu.value).toBe(50);expect(s.arpu.state).toBe("calculated");
 });
 it("does not invent dates or substitute all-time sales for missing period revenue",()=>{
  const s=deriveProjectEconomics({activeCustomers:2,reportingPeriod:{start:"2026-10-01",end:"2026-10-31"},financialEntries:[{entry_type:"revenue",amount:100,currency:"MZN",status:"actual"}]});
  expect(s.arpu.value).toBeNull();expect(s.arpu.missing).toContain("financial_entries.occurred_on");
  const noRevenue=deriveProjectEconomics({activeCustomers:2,leads:[{stage:"won",value:200,currency:"MZN"}],reportingPeriod:{start:"2026-10-01",end:"2026-10-31"}});
  expect(noRevenue.arpu.value).toBeNull();
 });
 it("preserves a recorded zero without relabelling it as a sales estimate",()=>{
  const s=deriveProjectEconomics({existing:{arpu:0,currency:"MZN"}});
  expect(s.arpu.state).toBe("inferred");expect(s.arpu.value).toBe(0);
 });
 it("rejects calendar-overflow exchange-rate dates",()=>{
  const s=deriveProjectEconomics({leads:[{stage:"won",value:100,currency:"EUR"}],exchangeRates:[{currency:"EUR",mznPerUnit:70,asOf:"2026-02-30",source:"test"}]});
  expect(s.arpu.value).toBeNull();
 });
});
