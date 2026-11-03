import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const migration = readFileSync(new URL("../../supabase/migrations/20261102143000_prepare_project_operational_atomic.sql", import.meta.url), "utf8");
describe("atomic operational preparation migration guardrails", () => {
  it("uses the same global-admin predicate as the existing table policies", () => {
    expect(migration).toContain("private.is_global_admin()");
    expect(migration).not.toContain("from public.user_roles r");
    expect(migration).toContain("security invoker");
  });
  it("uses one project-row lock and retains all operational entity writes", () => {
    expect(migration).toMatch(/where id=p_project_id and user_id=p_workspace_user_id for update/);
    for (const table of ["objectives", "projects", "deliverables", "actions", "metrics"]) {
      expect(migration).toContain("public." + table);
    }
  });
  it("never permits anonymous execution of the RPC", () => {
    expect(migration).toContain("revoke all on function public.prepare_project_operational_atomic(uuid,uuid) from public, anon");
    expect(migration).toContain("grant execute on function public.prepare_project_operational_atomic(uuid,uuid) to authenticated");
  });
});
