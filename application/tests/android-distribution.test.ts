import { afterEach, describe, it, expect, vi } from "vitest";
import { isVerifiedOfficialAndroidBuild, type AndroidDocument } from "@/lib/android-distribution";
vi.mock("@/lib/auth", () => ({ requireUser: async () => ({ supabase: {}, user: { id: "owner" } }) }));
vi.mock("@/lib/android-distribution", async (original) => ({ ...await original<typeof import("@/lib/android-distribution")>(), resolveOfficialAndroidApk: vi.fn() }));
import { resolveOfficialAndroidApk } from "@/lib/android-distribution";
import { GET } from "@/app/api/mobile/android-apk/route";
const document: AndroidDocument = { id: "official-id", document_key: "android_apk", format: "apk", status: "current", sha256: "a".repeat(64), released_at: "2026-10-28T10:00:00Z", version_label: "1.0.0", created_at: "2026-10-28T10:00:00Z" };
const details = { document_id: document.id, sha256: document.sha256, signature_verified: true, signing_mode: "release", physical_install_validated: true };
afterEach(() => vi.clearAllMocks());
describe("official APK distribution", () => {
  it("requires matching release, signature, hash and physical install evidence", () => {
    const validation = { scope: "mobile_android", status: "passed", release_sha: "commit", details };
    expect(isVerifiedOfficialAndroidBuild(document, validation, "commit")).toBe(true);
    expect(isVerifiedOfficialAndroidBuild(document, validation)).toBe(false);
    expect(isVerifiedOfficialAndroidBuild(document, validation, "other")).toBe(false);
    for (const patch of [{ signing_mode: "debug" }, { physical_install_validated: false }, { sha256: "wrong" }, { document_id: "other" }]) expect(isVerifiedOfficialAndroidBuild(document, { ...validation, details: { ...details, ...patch } }, "commit")).toBe(false);
  });
  it("returns actionable unavailable instead of silently serving debug bytes", async () => {
    vi.mocked(resolveOfficialAndroidApk).mockResolvedValue(null);
    const result = await GET(new Request("https://pcc.example/api/mobile/android-apk"));
    expect(result.status).toBe(503); expect((await result.json()).error).toContain("PWA");
  });
  it("uses the authenticated official document download for verified builds", async () => {
    vi.mocked(resolveOfficialAndroidApk).mockResolvedValue(document);
    const result = await GET(new Request("https://pcc.example/api/mobile/android-apk"));
    expect(result.status).toBe(307); expect(result.headers.get("location")).toBe("https://pcc.example/api/official-documents/official-id/download");
  });
});
