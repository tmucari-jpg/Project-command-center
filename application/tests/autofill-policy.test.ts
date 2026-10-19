import { describe, expect, it } from "vitest";
import {
  calculateArpu,
  calculateBurnRate,
  calculateCac,
  calculateConversionRate,
  calculateGrossMarginPct,
  calculatePaybackMonths,
  calculateRoiPct,
  calculateViabilityFactor,
  dependencyOwner,
} from "@/lib/autofill-policy";

describe("PCC autofill policy", () => {
  it("keeps human decisions with the project owner", () => {
    expect(dependencyOwner("decision", true)).toBe("project_owner");
  });

  it("assigns automatically resolvable dependencies to PCC", () => {
    expect(dependencyOwner("information", true)).toBe("pcc");
    expect(dependencyOwner("validation", true)).toBe("pcc");
    expect(dependencyOwner("confirmation", false)).toBe("project_owner");
  });

  it("calculates economic indicators only with sufficient inputs", () => {
    expect(calculateCac(1000, 10).value).toBe(100);
    expect(calculateConversionRate(20, 100).value).toBe(20);
    expect(calculateArpu(5000, 20).value).toBe(250);
    expect(calculateGrossMarginPct(1000, 400).value).toBe(60);
    expect(calculatePaybackMonths(12000, 2000).value).toBe(6);
    expect(calculateRoiPct(15000, 10000).value).toBe(50);
    expect(calculateBurnRate(5000, 1500).value).toBe(3500);
    expect(calculateViabilityFactor(20000, 0.6, 5000, 1000).value).toBe(2);
  });

  it("does not invent indicators when inputs are missing", () => {
    const cac = calculateCac(null, null);
    expect(cac.state).toBe("missing");
    expect(cac.value).toBeNull();
    expect(cac.missing).toContain("acquisition_cost");

    const vf = calculateViabilityFactor(20000, null, 5000, 1000);
    expect(vf.state).toBe("missing");
    expect(vf.value).toBeNull();
    expect(vf.missing).toContain("success_probability");
  });
});
