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


          <AdaptiveProjectIntake />
        </Card>
      </div>
    </>
  );
}
