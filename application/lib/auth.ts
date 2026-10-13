import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/auth/login");
  }

  return { supabase, user };
}


export function isConfiguredAdminEmail(email?: string | null) {
  if (!email) return false;

  const allowed = (process.env.PCC_ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return allowed.includes(email.trim().toLowerCase());
}

export async function isAdminUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  email?: string | null,
) {
  if (isConfiguredAdminEmail(email)) return true;

  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("scope_type", "global")
    .in("role", ["owner", "admin"]);

  return !error && Boolean(data?.length);
}

export async function requireAdmin() {
  const { supabase, user } = await requireUser();

  if (!(await isAdminUser(supabase, user.id, user.email))) {
    redirect("/dashboard");
  }

  return { supabase, user };
}
