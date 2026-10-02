import { describe, expect, it } from "vitest";
import { subscriptionFunnelRates } from "@/lib/briefing-monetization";

describe("subscriptionFunnelRates", () => {
  it("calculates only from supplied funnel counts", () => {
    expect(subscriptionFunnelRates({
      acquired: 100,
      payment_started: 40,
      paid: 20,
      activated: 18,
      retained: 15,
      churned: 3,
    })).toEqual({
      acquisition_to_payment: 40,
      payment_conversion: 50,
      activation_rate: 90,
      retention_rate: 83.33333333333334,
      churn_rate: 16.666666666666664,
    });
  });

  it("returns null when a denominator is unavailable", () => {
    expect(subscriptionFunnelRates({
      acquired: 0,
      payment_started: 0,
      paid: 0,
      activated: 0,
      retained: 0,
      churned: 0,
    })).toEqual({
      acquisition_to_payment: null,
      payment_conversion: null,
      activation_rate: null,
      retention_rate: null,
      churn_rate: null,
    });
  });
});
