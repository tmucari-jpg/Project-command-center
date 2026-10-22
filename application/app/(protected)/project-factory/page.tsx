import Link from "next/link";
import { Landmark, Lightbulb } from "lucide-react";
import { createFactoryIntake } from "@/app/(protected)/mutations";
import { Field, Select, TextArea } from "@/components/form-fields";
import { FlashMessage } from "@/components/flash-message";
import { FactoryAIAssistant } from "@/components/factory-ai-assistant";
import { InvestmentOpportunityAssistant } from "@/components/investment-opportunity-assistant";
import { PageHeader } from "@/components/page-header";
import { Card, primaryButtonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export default async function ProjectFactoryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string; mode?: string }>;
}) {
  const params = await searchParams;
  await requireUser();
  const mode = params.mode === "idea" || params.mode === "discover" ? params.mode : "";

  return (
    <>
      <PageHeader eyebrow="Projectos" title="Novo projecto" />
      <FlashMessage
        error={params.error}
        created={params.created}
        message={params.created ? "Novo projecto recebido. A avaliação foi iniciada." : undefined}
      />

      {!mode ? (
        <div className="grid max-w-5xl gap-4 md:grid-cols-2">
          <Link href="/project-factory?mode=idea" className="group">
            <Card className="h-full p-6 transition group-hover:border-[var(--cc-accent)] group-hover:shadow-[var(--cc-shadow-md)]">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--cc-success-soft)] text-[var(--cc-accent)]">
                <Lightbulb size={21} />
              </span>
              <h2 className="mt-5 text-xl font-semibold text-[var(--cc-foreground)]">Já tenho uma ideia para avaliar</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
                Estruture a ideia, clarifique o problema e o resultado esperado e inicie a avaliação de viabilidade.
              </p>
              <p className="mt-5 text-sm font-semibold text-[var(--cc-accent)]">Começar pela ideia →</p>
            </Card>
          </Link>

          <Link href="/project-factory?mode=discover" className="group">
            <Card className="h-full p-6 transition group-hover:border-[var(--cc-gold)] group-hover:shadow-[var(--cc-shadow-md)]">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--cc-warning-soft)] text-[#8A611C]">
                <Landmark size={21} />
              </span>
              <h2 className="mt-5 text-xl font-semibold text-[var(--cc-foreground)]">Quero investir, mas ainda não tenho uma ideia</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
                Defina capital, horizonte, capacidades, retorno pretendido e restrições. O PCC propõe hipóteses para avaliar — não negócios já validados.
              </p>
              <p className="mt-5 text-sm font-semibold text-[var(--cc-accent)]">Explorar oportunidades →</p>
            </Card>
          </Link>
        </div>
      ) : mode === "discover" ? (
        <div className="max-w-6xl">
          <div className="mb-4">
            <Link href="/project-factory" className="text-sm font-semibold text-[var(--cc-accent)]">← Voltar às opções</Link>
          </div>
          <InvestmentOpportunityAssistant />
        </div>
      ) : (
        <div className="max-w-4xl">
          <div className="mb-4">
            <Link href="/project-factory" className="text-sm font-semibold text-[var(--cc-accent)]">← Voltar às opções</Link>
          </div>
          <Card className="p-5">
            <p className="text-sm leading-6 text-[var(--cc-secondary)]">
              Descreva a ideia. O PCC inicia a avaliação antes de qualquer avanço para planeamento ou execução.
            </p>

            <form action={createFactoryIntake} className="mt-5 space-y-4">
              <FactoryAIAssistant />

              <div className="space-y-4">
                <Field
                  label="1. Qual é o projecto ou ideia que quer avaliar?"
                  name="title"
                  required
                  placeholder="Ex.: Criar um novo serviço para melhorar o atendimento."
                />

                <TextArea
                  label="2. Que problema ou oportunidade justifica este projecto?"
                  name="problem"
                  required
                  placeholder="Ex.: O processo actual é lento e provoca atrasos no atendimento."
                />

                <TextArea
                  label="3. Que resultado espera obter se o projecto funcionar?"
                  name="expected_value"
                  placeholder="Ex.: Reduzir o tempo de resposta e melhorar a satisfação dos clientes."
                />

                <TextArea
                  label="4. Quem será afectado ou beneficiado pelo projecto?"
                  name="target_user"
                  placeholder="Ex.: Clientes ou equipas directamente afectados pelo problema."
                />

                <Select
                  label="5. Que tipo de projecto é?"
                  name="project_type"
                  defaultValue="commercial"
                  help="Escolha a natureza do projecto para orientar a avaliação."
                >
                  <option value="commercial">Comercial / mercado</option>
                  <option value="non_commercial">Interno / não comercial</option>
                </Select>

                <input type="hidden" name="description" value="" />
                <input type="hidden" name="constraints" value="" />
                <input type="hidden" name="source" value="direct_idea" />
              </div>

              <button className={primaryButtonClass} type="submit">Adicionar novo projecto</button>
            </form>
          </Card>
        </div>
      )}
    </>
  );
}
