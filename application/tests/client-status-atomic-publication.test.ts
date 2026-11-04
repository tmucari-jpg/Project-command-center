import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("PCC publication remains atomic", () => {
  it("reuses the existing transactional RPC and never revokes the previous link in a separate request", () => {
    const source=readFileSync(join(process.cwd(),"app/(protected)/mutations.ts"),"utf8");
    const start=source.indexOf("export async function publishProjectClientStatus(");
    const end=source.indexOf("export async function createClientDiagnosticRequest(",start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const fn=source.slice(start,end);
    expect(fn).toContain('supabase.rpc(\n    "publish_project_client_status_atomic"');
    expect(fn).toContain("p_owner_id: user.id");
    expect(fn).toContain("p_project_id: project.id");
    expect(fn).not.toContain('from("project_client_status_snapshots").insert');
    expect(fn).not.toContain('from("project_client_status_links")');
    expect(fn).toContain("O link anterior foi preservado.");
    expect(fn).toContain("linkId: String(linkId)");
  });
});
