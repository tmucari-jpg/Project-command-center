import { describe, expect, it } from "vitest";
import { classifyAIProviderHealth } from "@/lib/ai-provider-state";

describe("AI provider operational classification", () => {
  it("separates valid configuration from exhausted quota", () => {
    expect(classifyAIProviderHealth({
      status: "degraded",
      message: "OpenAI HTTP 429 — You have no credits remaining. Add credits to continue.",
    })).toEqual({ configuration_status: "valid", availability_reason: "quota" });
  });

  it("marks free quota exhaustion as valid configuration", () => {
    expect(classifyAIProviderHealth({
      status: "offline",
      message: "insufficient_quota: Free quota exhausted. Please add funds.",
    })).toEqual({ configuration_status: "valid", availability_reason: "quota" });
  });

  it("marks authentication failures as invalid configuration", () => {
    expect(classifyAIProviderHealth({
      status: "offline",
      message: "HTTP 401 unauthorized",
    })).toEqual({ configuration_status: "invalid", availability_reason: "auth" });
  });

  it("marks a successful call as healthy", () => {
    expect(classifyAIProviderHealth({ status: "healthy", message: "OK" }))
      .toEqual({ configuration_status: "valid", availability_reason: "healthy" });
  });
});
