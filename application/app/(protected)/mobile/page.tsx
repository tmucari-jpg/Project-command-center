import Link from "next/link";
import { Download, Smartphone, Store, Wifi } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, secondaryButtonClass } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

export default async function MobileDistributionPage() {
  const { supabase, user } = await requireAdmin();

  const { data: builds, error } = await supabase
    .from("pcc_official_documents")
    .select("id,document_key,title,format,version_label,status,created_at")
    .eq("user_id", user.id)
    .in("document_key", ["android_apk", "android_aab"])
    .order("created_at", { ascending: false });

  const latestApk = (builds ?? []).find((item) => item.document_key === "android_apk" && item.status === "current");
  const latestAab = (builds ?? []).find((item) => item.document_key === "android_aab" && item.status === "current");

  return (
    <>
      <PageHeader eyebrow="Administração" title="Mobile & Distribuição" />

      {error && <Card className="mb-6 p-5 text-sm text-[var(--cc-danger)]">{error.message}</Card>}

      <Card className="mb-6 p-5">
        <h2 className="inline-flex items-center gap-2 font-semibold text-[var(--cc-foreground)]">
          <Smartphone size={18} /> App PCC existente
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
          O PCC já funciona como aplicação instalada em formato PWA. O ícone do man���q�^