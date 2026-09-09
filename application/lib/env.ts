export function requirePublicSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  return { url, key };
}

export function requireBraveKey() {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) {
    throw new Error("Brave Search is not configured. Set BRAVE_SEARCH_API_KEY.");
  }
  return key;
}
