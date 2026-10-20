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
