import { afterEach, describe, expect, it, vi } from "vitest";
import {
  generateBotIAPlan,
  generateBotIAPlanWithFallback,
} from "@/lib/bot-ia-provider";

const ORIGINAL_ENV = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
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

function validProviderPlan() {
  return JSON.stringify({
    intent: "question",
    response: "O projecto está operacional.",
    summary: "Estado factual.",
    diagnosis: "Sem alteração necessária.",
    operations: [],
  });
}

describe("BotIA provider failover", () => {
  it("falls back from OpenAI 429 to Qwen Cloud", async () => {
    process.env.OPENAI_API_KEY = "test-openai";
    process.env.OPENAI_MODEL = "test-openai-model";
    process.env.QWEN_API_KEY = "test-qwen";
    process.env.QWEN_MODEL = "qwen-plus";

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => "no credits",
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => "no credits",
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: validProviderPlan() } }],
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const result = await generateBotIAPlanWithFallback(
      [
        {
          provider: "openai",
          label: "OpenAI principal",
          mode: "cloud",
          model_hint: "test-openai-model",
        },
        {
          provider: "qwen_cloud",
          label: "Qwen Cloud fallback",
          mode: "cloud",
          endpoint_hint: "https://workspace.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1",
          model_hint: "qwen-plus",
        },
      ],
      { project: { title: "PCC" } },
    );

    expect(result.provider.provider).toBe("qwen_cloud");
    expect(result.attempts).toEqual([
      expect.objectContaining({ provider: "openai", status: "failed" }),
      expect.objectContaining({ provider: "qwen_cloud", status: "passed" }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain("/chat/completions");
    const openAIInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const openAIBody = JSON.parse(String(openAIInit.body));
    expect(openAIBody.reasoning_effort).toBe("none");
    expect(openAIBody.max_completion_tokens).toBe(1800);
    expect(openAIBody.temperature).toBeUndefined();
  });

  it("requires an explicit Qwen Workspace endpoint", async () => {
    process.env.QWEN_API_KEY = "test-qwen";
    process.env.QWEN_MODEL = "qwen-plus";

    await expect(generateBotIAPlan(
      {
        provider: "qwen_cloud",
        label: "Qwen Cloud fallback",
        mode: "cloud",
        model_hint: "qwen-plus",
      },
      { project: { title: "PCC" } },
    )).rejects.toThrow("QWEN_WORKSPACE_ENDPOINT_NOT_CONFIGURED");
  });
});
