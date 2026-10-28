import type { SupabaseClient } from "@supabase/supabase-js";

/** A provisioned client identity never inherits the internal PCC shell. */
export async function isGIE360Client(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase.from("gie360_memberships")
    .select("organization_id").eq("client_user_id", userId).limit(1);
  // Compatible with the previous PCC release before the additive migration exists.
  if (error && ["42P01", "PGRST205"].includes(error.code)) return false;
  if (error) throw new Error("IDENTITY_BOUNDARY_UNAVAILABLE");
  return Boolean(data?.length);
}

export function isGIE360Path(pathname: string) {
  return pathname === "/gie360" || pathname.startsWith("/gie360/");
}
