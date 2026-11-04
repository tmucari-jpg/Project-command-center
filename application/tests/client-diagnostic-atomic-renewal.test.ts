import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(),path),"utf8");
const action = read("app/(protected)/mutations.ts");
const start = action.indexOf("export async function createClientDiagnosticRequest(");
const end = action.indexOf("export async function importClientDiagnosticLink(",start);
const renewal = action.slice(start,end);
const sql = read("../supabase/migrations/20261104123000_atomic_client_diagnostic_renewal.sql");

describe("PCC diagnostic renewal is atomic and backward compatible", () => {
  it("preserves both approved questionnaire variants in UI and database", () => {
    expect(renewal).toContain('brandScope.data === "pcc_gie360" ? "executive-v3-gie360" : "executive-v3"');
    expect(sql).toContain("'executive-v3', 'executive-v3-gie360'");
    expect(renewal).toContain('issue_client_diagnostic_request_atomic');
  });

  it("does not revoke the previous link before a separate insert", () => {
    expect(renewal).not.toContain('.update({ status: "revoked" })');
    expect(renewal).not.toContain('.from("client_diagnostic_requests")');
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("status IN ('active', 'opened')");
    expect(sql).toContain("RETURNING id INTO v_request_id");
    expect(renewal).toContain("O link anterior permanece válido.");
  });

  it("preserves authorization, case ownership and human-review separation", () => {
    expect(sql).toContain("SECURITY INVOKER");
    expect(sql).toContain("auth.uid()");
    expect(sql).toContain("private.is_global_admin()");
    expect(sql).toContain("user_id = p_owner_id");
    expect(sql).toContain("GRANT EXECUTE");
    expect(sql).toContain("TO authenticated");
    expect(sql).not.toContain("pcc_external_share_approvals");
    expect(sql).not.toContain("client_diagnostic_reviews");
    expect(sql).not.toContain("status IN ('submitted', 'analyzing', 'reviewed')");
  });
});
