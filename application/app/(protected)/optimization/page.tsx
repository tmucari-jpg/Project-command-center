import Link from "next/link";
import { Bot, Database, Download, Gauge, HardDrive, Repeat2, Smartphone, WalletCards, Wifi } from "lucide-react";
import { OperationalReadinessCheck } from "@/components/operational-readiness-check";
import { PageHeader } from "@/components/page-header";
import { Card, EmptyState, secondaryButtonClass } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { calculateToolGovernanceScore, optimizationStatus } from "@/lib/optimization";
import { formatDateTime } from "@/lib/format";

function validationLabel(status?: string | null) {
  if (status === "passed") return "Validado operacionalmente";
  if (status === "failed") return "Falhou validaÃ§Ã£o";
  if (status === "partial") return "ValidaÃ§Ã£o parcial";
  return "NÃ£o validado";
}

export default async function OptimizationPage() {
  const { supabase, user } = await requireAdmin();

  const [
    { data: projects, error: projectsError },
    { data: actions, error: actionsError },
    { data: blockers, error: blockersError },
    { data: metrics, error: metricsError },
    { data: providers, error: providersError },
    { data: validations, error: validationsError },
    { data: officialDocuments, error: documentsError },
  ] = await Promise.all([
    supabase.from("projects").select("id,status,progress").eq("user_id", user.id),
    supabase.from("actions").select("id,status").eq("user_id", user.id),
    supabase.from("blockers").select("id,status").eq("user_id", user.id),
 ¶»§q«^