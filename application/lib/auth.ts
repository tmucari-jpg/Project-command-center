import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
    error,
  } = await supabase.auth.getUser();

  if (error || !authUser) {
    redirect("/auth/login");
  }

  let dataUser = authUser;

  if (await isAdminUser(supabase, authUser.id, authUser.email)) {
    const { data: workspaceOwner } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("scope_type", "global")
      .eq("role", "owner")
      .is("project_id", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (workspaceOwner?.user_id && workspaceOwner.user_id !== authUser.id) {
      dataUser = { ...authUser, id: workspaceOwner.user_id };
    }
  }

  return { supabase, user: dataUser, authUser };
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
  const { supabase, user, authUser } = await requireUser();

  if (!(await isAdminUser(supabase, authUser.id, authUser.email))) {
    redirect("/dashboard");
  }

  return { supabase, user, authUser };
}
