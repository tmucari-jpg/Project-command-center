import { describe, expect, it } from "vitest";
import { recommendGie360Package } from "../lib/gie360-package-recommendation";

describe("GIE360 diagnostic package proposal", () => {
  it("does not invent a package when there is no declared business need", () => {
    expect(recommendGie360Package({focus:"melhorar processo"})).toBeNull();
  });
  it("proposes essential for indicators and planning", () => {
    expect(recommendGie360Package({necessidades:["Gestão e indicadores"]})?.code).toBe("gie360-essential");
  });
  it("proposes professional for sales and clients", () => {
    expect(recommendGie360Package({necessidades:["Vendas e clientes"]})?.code).toBe("gie360-professional");
  });
  it("proposes complete for cash flow or operational costs", () => {
    expect(recommendGie360Package({necessidades:["Vendas e clientes","Cobranças e tesouraria"]})?.code).toBe("gie360-complete");
    expect(recommendGie360Package({necessidades:["Custos e operações"]})?.code).toBe("gie360-complete");
  });
  it("does not automatically recommend enterprise or approve AI", () => {
    expect(recommendGie360Package({necessidades:["Gestão e indicadores"]})?.code).not.toBe("gie360-enterprise");
  });
});
