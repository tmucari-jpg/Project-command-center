import { afterEach, describe, expect, it } from "vitest";
import { validateAIProviderHealth } from "@/lib/ai-provider-health";

const ORIGINAL_ENV = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
  MOONSHOT_API_KEY: process.env.MOONSHOT_API_KEY,
  MOONSHOT_MODEL: process.env.MOONSHOT_MODEL,
  QWEN_API_KEY: process.env.QWEN_API_KEY,
  QWEN_MODEL: process.env.QWEN_MODEL,
};

function restore(name: keyof typeof ORIGINAL_ENV) {
  const value = ORIGINAL_ENV[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

afterEach(() => {
  (Object.keys(ORIGINAL_ENV) as Array<keyof typeof ORIGINAL_ENV>).forEach(restore);
});

describe("AI provider health guards", () => {
  it("does not enable OpenAI without a runtime credential", async () => {
    delete process.env.OPENAI_API_KEY;
    const result = await validateAIProviderHealth({
      provider: "openai",
      mode: "cloud",
      model_hint: "test-model",
    });

    expect(result.status).toBe("offline");
    expect(result.message).toContain("OPENAI_API_KEY");
  });

  it("does not enable Kimi without a Moonshot credential", async () => {
    delete process.env.MOONSHOT_API_KEY;
    const result = await validateAIProviderHealth({
      provider: "moonshot",
      mode: "cloud",
      model_hint: "test-model",
    });

    expect(result.status).toBe("offline");
    expect(result.message).toContain("MOONSHOT_API_KEY");
  });

  it("does not enable Qwen cloud without its credential", async () => {
    delete process.env.QWEN_API_KEY;
    const result = await validateAIProviderHealth({
      provider: "qwen_cloud",
      mode: "cloud",
      model_hint: "test-model",
    });

    expect(result.status).toBe("offline");
    expect(result.message).toContain("QWEN_API_KEY");
  });

  it("keeps local AI unknown until an endpoint is configured", async () => {
    const result = await validateAIProviderHealth({
      provider: "qwen_local",
      mode: "local",
    });

    expect(result.status).toBe("unknown");
    expect(result.message).toContain("Endpoint local");
  });

  it("rejects unsafe local endpoint protocols", async () => {
    const result = await validateAIProviderHealth({
      provider: "koboldcpp_local",
      mode: "local",
      endpoint_hint: "file:///tmp/model",
    });

    expect(result.status).toBe("offline");
    expect(result.message).toContain("http ou https");
  });
});
