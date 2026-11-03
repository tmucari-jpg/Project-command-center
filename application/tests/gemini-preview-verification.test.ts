import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/gemini-verification/route";

beforeEach(() => {
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("PCC_GEMINI_FREE_TIER", "true");
  vi.stubEnv("PCC_GEMINI_DATA_PROCESSING_ACCEPTED", "true");
  vi.stubEnv("GEMINI_API_KEY", "synthetic-test-only-key");
  vi.stubEnv("GEMINI_MODEL", "gemini-3.5-flash-lite");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it("exposes no live check outside protected previews", async () => {
  vi.stubEnv("VERCEL_ENV", "production");
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  expect((await GET()).status).toBe(404);
  expect((await POST()).status).toBe(404);
  expect(fetch).not.toHaveBeenCalled();
});
it("requires free-tier approvals and a server credential before a real request", async () => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  vi.stubEnv("PCC_GEMINI_FREE_TIER", "false");
  expect((await POST()).status).toBe(412);
  vi.stubEnv("PCC_GEMINI_FREE_TIER", "true");
  vi.stubEnv("GEMINI_API_KEY", "");
  expect((await POST()).status).toBe(412);
  expect(fetch).not.toHaveBeenCalled();
});
it("runs a real native Gemini generation, returns verifiable evidence and hides secrets", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: "PCC-OK" }] } }],
  }), { status: 200 }));
  vi.stubGlobal("fetch", fetch);
  const result = await POST();
  expect(result.status).toBe(200);
  const html = await result.text();
  expect(html).toContain("APROVADO");
  expect(html).toContain("PCC-OK");
  expect(html).not.toContain("synthetic-test-only-key");
  expect(String(fetch.mock.calls[0][0])).toContain("/models/gemini-3.5-flash-lite:generateContent");
  expect(fetch.mock.calls[0][1].headers["x-goog-api-key"]).toBe("synthetic-test-only-key");
});
it("keeps the provider disabled on a real HTTP error and reveals no private body", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "sensitive provider diagnostics", status: "RESOURCE_EXHAUSTED" } }), { status: 429 })));
  const result = await POST();
  expect(result.status).toBe(502);
  const html = await result.text();
  expect(html).toContain("HTTP 429");
  expect(html).not.toContain("sensitive provider diagnostics");
  expect(html).not.toContain("synthetic-test-only-key");
});