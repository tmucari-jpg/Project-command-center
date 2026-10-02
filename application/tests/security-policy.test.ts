import { describe, expect, it } from "vitest";
import { containsPlaintextSecretField, roleCan } from "@/lib/security-policy";

describe("roleCan", () => {
  it("keeps viewer read-only and editor non-admin", () => {
    expect(roleCan("viewer", "read")).toBe(true);
    expect(roleCan("viewer", "write")).toBe(false);
    expect(roleCan("editor", "manage_roles")).toBe(false);
    expect(roleCan("owner", "manage_roles")).toBe(true);
  });
});

describe("containsPlaintextSecretField", () => {
  it("detects secret-like plaintext fields", () => {
    expect(containsPlaintextSecretField({ service: "x", password: "value" })).toBe(true);
    expect(containsPlaintextSecretField({ service: "x", secret_reference: "vault://item" })).toBe(false);
  });
});
