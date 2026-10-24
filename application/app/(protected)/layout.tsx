import { AppShell } from "@/components/app-shell";
import { isAdminUser, requireUser } from "@/lib/auth";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await requireUser();
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
