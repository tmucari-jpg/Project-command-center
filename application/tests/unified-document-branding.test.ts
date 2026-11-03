import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const root = new URL("../../", import.meta.url);
const render = readFileSync(new URL("application/lib/artifacts/render.ts", root), "utf8");
const model = readFileSync(new URL("application/lib/artifacts/model.ts", root), "utf8");
const snapshot = readFileSync(new URL("application/lib/artifacts/snapshot.ts", root), "utf8");
const archiveRoute = readFileSync(new URL("application/app/api/deliverables/[id]/generate/route.ts", root), "utf8");
const downloadRoute = readFileSync(new URL("application/app/api/deliverables/artifacts/[id]/download/route.ts", root), "utf8");
const g3 = readFileSync(new URL("application/app/api/projects/[id]/commitment-draft/route.ts", root), "utf8");
describe("common document renderer", () => {
 it("supports both official identities", () => {
   expect(model).toContain('documentBrand?: "PCC" | "GIE360°"');
   expect(render).toContain('s.documentBrand === "GIE360°" ? "PCC + GIE360°" : "PCC"');
 });
 it("uses the same renderer for G3 and other deliverables", () => {
   expect(g3).toContain("renderArtifact(snapshot)");
   expect(render).toContain("return renderDocument(s)");
 });
 it("uses only approved G3 baselines and the existing authenticated archive", () => {
   expect(snapshot).toContain('.in("status",["internal_approved","client_approved"])');
   expect(snapshot).toContain('COMMITMENT_BASELINE_NOT_APPROVED');
   expect(archiveRoute).toContain('"commitment"');
   expect(archiveRoute).toContain('finalize_generated_deliverable');
   expect(downloadRoute).toContain('sha256');
   expect(downloadRoute).toContain('resolveWorkspaceUser');
 });
 it("preserves the PCC ivory and green style", () => {
   expect(render).toContain('green="073F36"');
   expect(render).toContain('ivory="F8F6F0"');
 });
});
