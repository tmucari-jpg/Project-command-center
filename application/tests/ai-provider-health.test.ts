import { afterEach, describe, expect, it, vi } from "vitest";
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
  vi.unstubAllGlobals();
});

describe("AI provider health guards", () => {
  it("uses GPT-6-compatible Chat Completions parameters for OpenAI health", async () => {
    process.env.OPENAI_API_KEY = "test-openai";
    process.env.OPENAI_MODEL = "gpt-6-luna";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: "OK" } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await validateAIProviderHealth({
      provider: "openai",
      mode: "cloud",
      model_hint: "gpt-6-luna",
    });

    expect(result.status).toBe("healthy");
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(init.body));
    expect(body.reasoning_effort).toBe("none");
    expect(body.max_completion_tokens).toBe(64);
    expect(body.temperature).toBeUndefined();
    expect(body.max_tokens).toBeUndefined();
  });

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
      endpoint_hint: "https://workspace.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1",
      model_hint: "test-model",
    });

    expect(result.status).toBe("offline");
    expect(result.message).toContain("QWEN_API_KEY");
  });

  it("requires a Qwen Workspace endpoint before activation", async () => {
    process.env.QWEN_API_KEY = "test-qwen";
    const result = await validateAIProviderHealth({
      provider: "qwen_cloud",
      mode: "cloud",
      model_hint: "qwen-plus",
    });

    expect(result.status).toBe("unknown");
    expect(result.message).toContain("Workspace/Região");
  });

  it("surfaces Qwen 403 provider details", async () => {
    process.env.QWEN_API_KEY = "test-qwen";
    process.env.QWEN_MODEL = "qwen-plus";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        code: "AccessDenied.Unpurchased",
        message: "Access to model denied.",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await validateAIProviderHealth({
      provider: "qwen_cloud",
      mode: "cloud",
      endpoint_hint: "https://workspace.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1",
      model_hint: "qwen-plus",
    });

    expect(result.status).toBe("offline");
    expect(result.message).toContain("AccessDenied.Unpurchased");
    expect(result.message).toContain("Access to model denied");
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
