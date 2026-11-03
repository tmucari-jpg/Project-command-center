import { it, expect, vi } from "vitest";
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null }, error: null }) } }) }));
import { GET } from "@/app/api/projects/[id]/commitment-draft/route";
const id = "20000000-0000-4000-8000-000000000001";
it("rejects invalid identifiers and formats before accessing data", async () => {
  expect((await GET(new Request("http://localhost/api/projects/invalid/commitment-draft"), { params: Promise.resolve({ id: "invalid" }) })).status).toBe(400);
  expect((await GET(new Request(`http://localhost/api/projects/${id}/commitment-draft?format=exe`), { params: Promise.resolve({ id }) })).status).toBe(400);
});
it("requires an authenticated session to export a contractual draft", async () => {
  expect((await GET(new Request(`http://localhost/api/projects/${id}/commitment-draft?format=pdf`), { params: Promise.resolve({ id }) })).status).toBe(401);
});
