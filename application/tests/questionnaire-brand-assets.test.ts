import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("public questionnaire brand assets", () => {
  const component = readFileSync(resolve(process.cwd(), "components/client-diagnostic-questionnaire.tsx"), "utf8");
  it("uses the existing PCC and GIE360 logos", () => {
    expect(existsSync(resolve(process.cwd(), "public/brand/pcc-logo-transparent.svg"))).toBe(true);
    expect(existsSync(resolve(process.cwd(), "public/gie360/logo.png"))).toBe(true);
    expect(component).toContain('src="/brand/pcc-logo-transparent.svg"');
    expect(component).toContain('src="/gie360/logo.png"');
  });
  it("renders GIE360 branding only for the GIE360 questionnaire version", () => {
    expect(component).toContain('questionnaireVersion === "executive-gie360-v1"');
    expect(component).toContain("{gie &&");
  });
});
