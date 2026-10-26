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
          O PCC já funciona como aplicação instalada em formato PWA. O ícone do manifest é gerado a partir do logo oficial do PCC.
          APK/AAB são canais adicionais de distribuição e não substituem a PWA.
        </p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <h2 className="inline-flex items-center gap-2 font-semibold text-[var(--cc-foreground)]"><Download size={18} /> Android APK</h2>
          {latestApk ? (
            <>
              <p className="mt-2 text-sm text-[var(--cc-secondary)]">{latestApk.version_label} · {formatDateTime(latestApk.created_at)}</p>
              <a download className={secondaryButtonClass + " mt-4"} href={`/api/official-documents/${latestApk.id}/download`}>Baixar APK</a>
            </>
          ) : (
            <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
              Ainda não existe APK oficial assinado. O download só é activado quando uma build assinada e validada for promovida para Actual.
            </p>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="inline-flex items-center gap-2 font-semibold text-[var(--cc-foreground)]"><Store size={18} /> Android AAB</h2>
          {latestAab ? (
            <>
              <p className="mt-2 text-sm text-[var(--cc-secondary)]">{latestAab.version_label} · {formatDateTime(latestAab.created_at)}</p>
              <a download className={secondaryButtonClass + " mt-4"} href={`/api/official-documents/${latestAab.id}/download`}>Baixar AAB</a>
            </>
          ) : (
            <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
              O AAB é o pacote de publicação no Google Play. A build oficial depende de package ID e assinatura de distribuição definitivos.
            </p>
          )}
        </Card>
      </div>

      <Card className="mt-6 p-5">
        <h2 className="inline-flex items-center gap-2 font-semibold text-[var(--cc-foreground)]"><Wifi size={18} /> PWA</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
          Continua disponível como instalação imediata no dispositivo. Em iPhone, use Safari → Partilhar → Adicionar ao Ecrã Principal.
        </p>
        <Link href="/optimization" className={secondaryButtonClass + " mt-4"}>Ver saúde operacional</Link>
      </Card>
    </>
  );
}
