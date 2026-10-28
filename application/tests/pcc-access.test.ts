import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isGIE360Client, isGIE360Path } from "@/lib/pcc-access";

function client(result: unknown) {
  const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue(result) };
  return { from: vi.fn().mockReturnValue(query) } as unknown as SupabaseClient;
}
describe("GIE360 identity boundary", () => {
  it("uses server memberships instead of editable user metadata", async () => {
    expect(await isGIE360Client(client({ data: [{ organization_id: "org" }], error: null }), "client")).toBe(true);
    expect(await isGIE360Client(client({ data: [], error: null }), "manager")).toBe(false);
  });
  it("fails closed when identity lookup is unavailable", async () => {
    await expect(isGIE360Client(client({ data: null, error: { code: "PGRST000" } }), "user")).rejects.toThrow("IDENTITY_BOUNDARY_UNAVAILABLE");
    expect(await isGIE360Client(client({ data: null, error: { code: "PGRST205" } }), "user")).toBe(false);
  });
  it("recognizes route segments without accepting lookalikes", () => {
    expect(isGIE360Path("/gie360")).toBe(true);
    expect(isGIE360Path("/gie360/login")).toBe(true);
    expect(isGIE360Path("/gie360-admin")).toBe(false);
  });
});
