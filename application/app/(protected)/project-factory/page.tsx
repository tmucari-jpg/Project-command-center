import { AdaptiveProjectIntake } from "@/components/adaptive-project-intake";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export default async function ProjectFactoryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const params = await searchParams;
  await requireUser();

  return (
    <>
      <PageHeader eyebrow="Projectos" title="Novo projecto" />
      <FlashMessage
        error={params.error}
        created={params.created}
        message={params.created ? "Novo projecto recebido. A avaliação foi iniciada." : undefined}
      />

      <div className="max-w-5xl">
        <Card className="p-5 sm:p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-[var(--cc-foreground)]">
              Defina o ponto de partida
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--cc-secondary)]">
              O PCC adapta as perguntas ao tipo de situação e recolhe o contexto necessário para iniciar G1 e preparar G2. Não precisa escolher ferramentas nem modos de trabalho.
            </p>
          </div>

          <AdaptiveProjectIntake />
        </Card>
      </div>
    </>
  );
}
