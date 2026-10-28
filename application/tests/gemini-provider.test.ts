import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { aiRuntime, chatCompletionsUrl, freeAIConfigurationIssue, isFreeAIEligible, requestAIText } from "@/lib/ai-runtime";
import { validateAIProviderHealth } from "@/lib/ai-provider-health";
import { classifyAIProviderHealth } from "@/lib/ai-provider-state";
import { generateAssistWithFallback } from "@/lib/ai-assist-router";

const profile = { id: "gemini", provider: "gemini", label: "Gemini", mode: "cloud" as const, enabled: true, cost_class: "free", model_hint: "configured-free-model" };
const endpoint = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
function response(content: string | null) { return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 }); }
function registry(rows: unknown[]) {
  const updates: Array<Record<string, unknown>> = [];
  const db = { from: () => {
    const q: Record<string, unknown> = {};
    for (const key of ["select", "eq"]) q[key] = () => q;
    q.order = async () => ({ data: rows, error: null });
    q.update = (value: Record<string, unknown>) => { updates.push(value); return q; };
    return q;
  } };
  return { db: db as unknown as SupabaseClient, updates };
}
beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", "synthetic-test-key");
  vi.stubEnv("GEMINI_MODEL", "");
  vi.stubEnv("PCC_GEMINI_FREE_TIER", "true");
  vi.stubEnv("PCC_GEMINI_DATA_PROCESSING_ACCEPTED", "true");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("Gemini within the PCC runtime", () => {
  it("uses the official compatible endpoint with server credential and configured model", async () => {
    const fetch = vi.fn().mockResolvedValue(response("Resposta factual em português.")); vi.stubGlobal("fetch", fetch);
    expect(await requestAIText(profile, "Contexto aprovado", "Não inventar factos", 4000, 300)).toBe("Resposta factual em português.");
    expect(fetch.mock.calls[0][0]).toBe(endpoint);
    const init = fetch.mock.calls[0][1] as RequestInit;
    expect(init.headers).toMatchObject({ Authorization: "Bearer synthetic-test-key", "x-goog-api-client": "pcc/0.1.0" });
    expect(init.redirect).toBe("error");
    expect(JSON.parse(String(init.body))).toEqual({ model: "configured-free-model", messages: [{ role: "system", content: "Não inventar factos" }, { role: "user", content: "Contexto aprovado" }], max_tokens: 300 });
  });
  it("validates health through real generation with space for model reasoning", async () => {
    const fetch = vi.fn().mockResolvedValue(response("OK")); vi.stubGlobal("fetch", fetch);
    expect((await validateAIProviderHealth(profile)).status).toBe("healthy");
    expect(JSON.parse(String(fetch.mock.calls[0][1].body)).max_tokens).toBe(512);
  });
  it("normalizes Google's base without appending an extra v1", () => {
    expect(chatCompletionsUrl("https://generativelanguage.googleapis.com/v1beta/openai/")).toBe(endpoint);
    expect(chatCompletionsUrl(endpoint)).toBe(endpoint);
  });
  it("never enables free cloud without account and data-processing confirmation", async () => {
    expect(isFreeAIEligible(profile)).toBe(true);
    vi.stubEnv("PCC_GEMINI_FREE_TIER", "false");
    expect(isFreeAIEligible(profile)).toBe(false);
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    await expect(requestAIText(profile, "test")).rejects.toThrow("FREE_TIER_NOT_CONFIRMED");
    vi.stubEnv("PCC_GEMINI_FREE_TIER", "true"); vi.stubEnv("PCC_GEMINI_DATA_PROCESSING_ACCEPTED", "false");
    expect(isFreeAIEligible(profile)).toBe(false);
    await expect(requestAIText(profile, "test")).rejects.toThrow("DATA_PROCESSING_NOT_ACCEPTED");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("explains the administrative next step without revealing secrets", () => {
    expect(freeAIConfigurationIssue(profile)).toBeNull();
    vi.stubEnv("PCC_GEMINI_DATA_PROCESSING_ACCEPTED", "false");
    expect(freeAIConfigurationIssue(profile)).toContain("termos de tratamento de dados");
    vi.stubEnv("PCC_GEMINI_FREE_TIER", "false");
    expect(freeAIConfigurationIssue(profile)).toContain("plano gratuito");
    expect(freeAIConfigurationIssue(profile)).not.toContain("synthetic-test-key");
  });
  it("rejects paid, disabled and falsely local Gemini profiles", () => {
    expect(isFreeAIEligible({ ...profile, cost_class: "low" })).toBe(false);
    expect(isFreeAIEligible({ ...profile, enabled: false })).toBe(false);
    expect(isFreeAIEligible({ ...profile, mode: "local" })).toBe(false);
    expect(() => aiRuntime({ ...profile, mode: "local", endpoint_hint: "http://localhost:8080" })).toThrow("REQUIRES_CLOUD_MODE");
    expect(() => aiRuntime({ ...profile, cost_class: "high" })).toThrow("FREE_ONLY_POLICY");
  });
  it("does not send credentials to custom hosts, paths, ports or insecure URLs", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    for (const endpoint_hint of ["https://attacker.example/v1", "http://generativelanguage.googleapis.com/v1beta/openai", "https://generativelanguage.googleapis.com:8443/v1beta/openai", "https://generativelanguage.googleapis.com/other/v1"]) {
      await expect(requestAIText({ ...profile, endpoint_hint }, "test")).rejects.toThrow("INVALID_CLOUD_ENDPOINT");
    }
    expect(fetch).not.toHaveBeenCalled();
  });
  it("requires a server key and explicit model instead of assuming availability", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    expect((await validateAIProviderHealth(profile)).status).toBe("offline");
    vi.stubEnv("GEMINI_API_KEY", "synthetic-test-key");
    expect((await validateAIProviderHealth({ ...profile, model_hint: "" })).status).toBe("unknown");
  });
  it("reports actual authentication failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 403, status: "PERMISSION_DENIED", message: "API key invalid" } }), { status: 403 })));
    const result = await validateAIProviderHealth(profile);
    expect(result.status).toBe("offline");
    expect(classifyAIProviderHealth(result)).toEqual({ configuration_status: "invalid", availability_reason: "auth" });
  });
  it("reports quota exhaustion without declaring the model healthy", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 429, status: "RESOURCE_EXHAUSTED", message: "Quota exceeded for project" } }), { status: 429 })));
    const result = await validateAIProviderHealth(profile);
    expect(result.status).toBe("degraded");
    expect(classifyAIProviderHealth(result)).toEqual({ configuration_status: "valid", availability_reason: "quota" });
  });
  it.each([null, "", "   "])("rejects empty generation %s", async content => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(content)));
    expect((await validateAIProviderHealth(profile)).status).not.toBe("healthy");
  });
  it("falls back from exhausted Gemini to an explicitly authorised free provider", async () => {
    vi.stubEnv("GROQ_API_KEY", "synthetic-groq-key"); vi.stubEnv("PCC_GROQ_FREE_TIER", "true");
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 429, message: "Quota exceeded" } }), { status: 429 })).mockResolvedValueOnce(response("Resposta suportada pelos dados.")); vi.stubGlobal("fetch", fetch);
    const { db, updates } = registry([profile, { ...profile, id: "groq", provider: "groq", label: "Groq" }]);
    const result = await generateAssistWithFallback(db, "owner", "Contexto factual");
    expect(result.provider.provider).toBe("groq");
    expect(result.attempts.map(item => item.status)).toEqual(["failed", "passed"]);
    expect(updates[0].availability_reason).toBe("quota");
    expect(updates.every(item => !("enabled" in item))).toBe(true);
  });
  it("fails explicitly when all authorised providers fail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "unavailable" } }), { status: 503 })));
    const { db } = registry([profile]);
    await expect(generateAssistWithFallback(db, "owner", "test")).rejects.toThrow("FREE_PROVIDERS_UNAVAILABLE");
  });
});
