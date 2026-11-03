import { createClient } from "@supabase/supabase-js";
import { requirePublicSupabaseEnv } from "@/lib/env";

/** Server-only. Call only after authenticating and authorizing the tenant. */
export function createServiceClient() {
  const { url } = requirePublicSupabaseEnv();
  const parsed = new URL(url);
  const loopback = parsed.protocol === "http:" && ["127.0.0.1", "localhost"].includes(parsed.hostname) && parsed.port === "54321";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || (loopback ? process.env.PCC_LOCAL_SERVICE_ROLE_KEY : undefined);
  if (!key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
