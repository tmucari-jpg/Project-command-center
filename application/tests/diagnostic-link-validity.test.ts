import { describe, expect, it, vi, afterEach } from "vitest";
import { isDiagnosticLinkUnavailable } from "../lib/diagnostic-link-validity";

describe("Validade dos links públicos de diagnóstico", () => {
  afterEach(() => vi.useRealTimers());

  it("rejeita link expirado e data no instante actual", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-30T12:00:00Z"));
    expect(isDiagnosticLinkUnavailable("2026-10-30T11:59:59Z", "active")).toBe(true);
    expect(isDiagnosticLinkUnavailable("2026-10-30T12:00:00Z", "active")).toBe(true);
  });

  it("rejeita links revogados mesmo antes da expiração", () => {
    expect(isDiagnosticLinkUnavailable("2099-01-01T00:00:00Z", "revoked")).toBe(true);
  });

  it("rejeita data ausente ou inválida", () => {
    expect(isDiagnosticLinkUnavailable(null, "active")).toBe(true);
    expect(isDiagnosticLinkUnavailable("data inválida", "active")).toBe(true);
  });

  it("mantém acesso aos links activos ainda válidos", () => {
    expect(isDiagnosticLinkUnavailable("2099-01-01T00:00:00Z", "active")).toBe(false);
    expect(isDiagnosticLinkUnavailable("2099-01-01T00:00:00Z", "opened")).toBe(false);
  });
});
