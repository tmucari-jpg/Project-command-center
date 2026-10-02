import { describe, expect, it } from "vitest";
import { chooseProvider, providerNeedsSecret } from "@/lib/ai-provider-adapter";

describe("chooseProvider", () => {
  const providers = [
    { provider: "groq", label: "Groq", mode: "cloud" as const, enabled: true, priority: 20, cost_class: "low" as const, last_health_status: "healthy" as const, capabilities: ["chat"] },
    { provider: "qwen_local", label: "Qwen local", mode: "local" as const, enabled: true, priority: 50, cost_class: "free" as const, last_health_status: "healthy" as const, capabilities: ["chat"] },
  ];

  it("prefers local when requested", () => {
    expect(chooseProvider(providers, { preferLocal: true, capability: "chat" })?.provider).toBe("qwen_local");
  });

  it("prefers lowest cost when cost-sensitive", () => {
    expect(chooseProvider(providers, { costSensitive: true, capability: "chat" })?.provider).toBe("qwen_local");
  });

  it("ignores offline providers", () => {
    expect(chooseProvider([{ ...providers[1], last_health_status: "offline" }], { preferLocal: true })).toBeNull();
  });
});

describe("providerNeedsSecret", () => {
  it("keeps local providers secret-free by default", () => {
    expect(providerNeedsSecret({
      provider: "koboldcpp_local",
      label: "KoboldCPP",
      mode: "local",
      enabled: true,
      priority: 1,
      cost_class: "free",
      last_health_status: "healthy",
    })).toBe(false);
  });
});
