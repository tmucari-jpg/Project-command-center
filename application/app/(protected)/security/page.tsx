import { KeyRound, LockKeyhole, ShieldCheck, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, EmptyState } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

export default async function SecurityPage() {
  const { supabase, user } = await requireAdmin();

  const [
    { data: roles, error: rolesError },
    { data: vaultItems, error: vaultError },
    { data: controls, error: controlsError },
    { data: events, error: eventsError },
    { data: rateLimitRows, error: rateLimitError },
  ] = await Promise.all([
    supabase.from("user_roles").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("vault_items").select("id,category,service,username_hint,secret_reference,url,storage_mode,status,updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(30),
    supabase.from("security_controls").select("*").eq("user_id", user.id).order("control_key"),
    supabase.from("security_events").select("id,event_type,severity,description,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
    supabase.rpc("client_diagnostic_rate_limit_summary"),
  ]);

  const error = rolesError?.message ?? vaultError?.message ?? controlsError?.message ?? eventsError?.message ?? rateLimitError?.message;

  type RateLimitSummary = {
    action: string;
    tracked_links: number | string | ¶»§q«^