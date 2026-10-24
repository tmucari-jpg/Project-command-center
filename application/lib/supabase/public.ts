import { createClient } from "@supabase/supabase-js";
import { requirePublicSupabaseEnv } from "@/lib/env";

export function createPublicClient() {
  const { url, key } = requirePublicSupabaseEnv();

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        "x-pcc-surface": "client-diagnostic-public",
      },
    },
  });
}
