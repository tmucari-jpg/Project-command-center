import { AppShell } from "@/components/app-shell";
import { redirect } from "next/navigation";
import { isAdminUser, requireUser } from "@/lib/auth";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, authUser } = await requireUser();
  // Clients use a distinct product shell. An authenticated GIE360° client
  // must never be shown the PCC's administrative navigation.
  const { data: gieClientMembership, error: membershipError } = await supabase
    .from("gie360_memberships")
    .select("organization_id")
    .eq("client_user_id", authUser.id)
    .limit(1);
  if (membershipError) {
    throw new Error("GIE360_CLIENT_ACCESS_CHECK_FAILED");
  }
  if (gieClientMembership?.length) redirect("/gie-client");

  const [isAdmin, unreadResult] = await Promise.all([
    isAdminUser(supabase, user.id, user.email),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null),
  ]);

  return (
    <AppShell
      isAdmin={isAdmin}
      notificationCount={unreadResult.count ?? 0}
    >
      {children}
    </AppShell>
  );
}
