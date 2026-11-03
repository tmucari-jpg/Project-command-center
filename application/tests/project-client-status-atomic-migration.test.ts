import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("../../", import.meta.url);
const sql = readFileSync(new URL("supabase/migrations/20261102163000_atomic_project_client_status.sql", root), "utf8");
const mutations = readFileSync(new URL("application/app/(protected)/mutations.ts", root), "utf8");

describe("project client share atomic release safeguards", () => {
  it("binds each external link to a fixed published snapshot", () => {
    expect(sql).toContain("snapshot_id uuid references public.project_client_status_snapshots(id)");
    expect(sql).toContain("l.snapshot_id");
  });
  it("publishes the snapshot, revokes old links and issues the new one within one RPC", () => {
    expect(sql).toContain("for update");
    expect(sql).toContain("returning id into v_snapshot");
    expect(sql).toContain("status='revoked'");
    expect(sql).toContain("returning id into v_link");
    expect(mutations).toContain('supabase.rpc("publish_project_client_status_atomic"');
  });
  it("preserves signed-in access policy and the public token rate limit", () => {
    expect(sql).toContain("security invoker");
    expect(sql).toContain("private.is_global_admin()");
    expect(sql).toContain("private.consume_project_client_status_rate_limit");
    expect(sql).toContain("grant execute on function public.project_client_status_lookup(text) to anon");
  });
});
