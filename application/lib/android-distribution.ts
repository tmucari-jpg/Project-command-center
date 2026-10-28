import type { SupabaseClient } from "@supabase/supabase-js";
export type AndroidDocument = { id: string; document_key: string; format: string; status: string; sha256: string | null; released_at: string | null; version_label: string; created_at: string };
type Validation = { status: string; scope: string; release_sha: string | null; details: Record<string, unknown> };

export function isVerifiedOfficialAndroidBuild(document: AndroidDocument, validation: Validation, releaseSha?: string) {
  return document.document_key === "android_apk" && document.format === "apk" && document.status === "current"
    && Boolean(document.released_at && document.sha256 && /^[0-9a-f]{64}$/.test(document.sha256))
    && validation.scope === "mobile_android" && validation.status === "passed"
    && Boolean(releaseSha && validation.release_sha === releaseSha)
    && validation.details.document_id === document.id && validation.details.sha256 === document.sha256
    && validation.details.signature_verified === true && validation.details.signing_mode === "release"
    && validation.details.physical_install_validated === true;
}
export async function resolveOfficialAndroidApk(supabase: SupabaseClient, userId: string, releaseSha?: string) {
  const [documents, validations] = await Promise.all([
    supabase.from("pcc_official_documents").select("id,document_key,format,status,sha256,released_at,version_label,created_at").eq("user_id", userId).eq("document_key", "android_apk").eq("status", "current").order("created_at", { ascending: false }).limit(20),
    supabase.from("operational_validation_runs").select("scope,status,release_sha,details").eq("user_id", userId).eq("scope", "mobile_android").eq("status", "passed").order("created_at", { ascending: false }).limit(50),
  ]);
  if (documents.error || validations.error) return null;
  return (documents.data as AndroidDocument[] | null)?.find((document) => (validations.data as Validation[] | null)?.some((validation) => isVerifiedOfficialAndroidBuild(document, validation, releaseSha))) ?? null;
}
