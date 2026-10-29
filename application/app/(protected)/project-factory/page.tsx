import Link from "next/link";
import { AdaptiveProjectIntake } from "@/components/adaptive-project-intake";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui";

export default async function ProjectFactoryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const params = await searchParams;


  return (
    <>
      <PageHeader eyebrow="Projectos" title="Novo projecto" />
      <FlashMessage
        error={params.error}
        created={params.created}
        message={params.created ? "Novo projecto recebido. A avaliação foi iniciada." : undefined}
      />

      <div className="max-w-6xl">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-[var(--cc-border)] bg-[var(--cc-surface-muted)] px-5 py-5 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#146453]">
                  Ponto de partida
                </p>
                <h2 className="mt-1 text-xl font-semibold text-[var(--cc-foreground)]">
                  Defina como quer começar
                </h2>

              </div>
              <div className="rounded-full border border-[#e2d3ae] bg-white px-3 py-1.5 text-xs font-semibold text-[#8b6a25]">
                Diagnóstico adaptativo
              </div>
            </div>
          </div>

          <div className="mx-5 mt-5 rounded-xl border border-[#c99439]/40 bg-[#f8f6f0] p-5 sm:mx-6"><p className="text-xs font-semibold uppercase tracking-widest text-[#146453]">Entrada empresarial</p><h3 className="mt-2 text-lg font-semibold text-[#073f36]">GIE360° — Gestão Inteligente Empresarial</h3><p className="mt-2 text-sm text-slate-700">Para associar uma empresa ao diagnóstico, configurar os módulos seleccionados e disponibilizar o percurso autónomo do cliente.</p><Link href="/products" className="mt-4 inline-flex rounded-lg bg-[#073f36] px-4 py-2.5 text-sm font-semibold text-white">Associar empresa no GIE360°</Link></div>
          <AdaptiveProjectIntake />
        </Card>
      </div>
    </>
  );
}
