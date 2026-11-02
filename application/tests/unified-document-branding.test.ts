import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const root = new URL("../../", import.meta.url);
const render = readFileSync(new URL("application/lib/artifacts/render.ts", root), "utf8");
const model = readFileSync(new URL("application/lib/artifacts/model.ts", root), "utf8");
const g3 = readFileSync(new URL("application/app/api/projects/[id]/commitment-draft/route.ts", root), "utf8");
describe("common document renderer", () => {
 it("supports both official identities", () => {
   expect(model).toContain('documentBrand?: "PCC" | "GIE360°"');
   expect(render).toContain('s.documentBrand ?? "PCC"');
 });
 it("uses the same renderer for G3 and other deliverables", () => {
   expect(g3).toContain("renderArtifact(snapshot)");
   expect(render).toContain("return renderDocument(s)");
 });
 it("preserves the PCC ivory and green style", () => {
   expect(render).toContain('green="073F36"');
   expect(render).toContain('ivory="F8F6F0"');
 });
});
