import { describe, expect, it } from "vitest";
import { financialSummary, monetizationReadiness } from "@/lib/monetization";

describe("monetizationReadiness", () => {
  it("reports missing commercial basics without inventing values", () => {
    expect(monetizationReadiness({
      offer: "Serviço",
      ideal_customer: null,
      price: null,
      currency: "MZN",
      channel: "Directo",
      validation_status: "draft",
    })).toEqual({
      score: 50,
      missing: ["ideal_customer", "price"],
    });
  });
});

describe("financialSummary", () => {
  it("uses only actual entries for realised totals", () => {
    expect(financialSummary([
      { entry_type: "revenue", amount: 100, status: "actual" },
      { entry_type: "cost", amount: 30, status: "actual" },
      { entry_type: "revenue", amount: 500, status: "forecast" },
    ])).toEqual({ revenue: 100, costs: 30, net: 70 });
  });
});
