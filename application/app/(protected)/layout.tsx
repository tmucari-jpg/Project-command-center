import { AppShell } from "@/components/app-shell";
import { isAdminUser, requireUser } from "@/lib/auth";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await requireUser();
  const isAdmin = await isAdminUser(supabase, user.id, user.email);

  return <AppShell isAdmin={isAdmin}>{children}</AppShell>;
}
