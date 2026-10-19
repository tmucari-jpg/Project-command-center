import { describe, expect, it } from "vitest";
import {
  defaultMonetizationStatus,
  defaultReturnType,
  monetizationNeedsEvidence,
} from "@/lib/value-return";

describe("value and return assessment", () => {
  it("does not equate non-commercial with impossible monetization", () => {
    expect(defaultMonetizationStatus("non_commercial")).toBe("not_primary");
  });

  it("keeps monetization unresolved when evidence is insufficient", () => {
    expect(defaultMonetizationStatus("commercial")).toBe("insufficient");
  });

  it("does not invent a return type", () => {
    expect(defaultReturnType()).toBe("undetermined");
  });

  it("requires evidence before claiming monetization", () => {
    expect(monetizationNeedsEvidence("yes")).toBe(true);
    expect(monetizationNeedsEvidence("potential")).toBe(true);
    expect(monetizationNeedsEvidence("not_primary")).toBe(false);
    expect(monetizationNeedsEvidence("insufficient")).toBe(false);
  });
});
