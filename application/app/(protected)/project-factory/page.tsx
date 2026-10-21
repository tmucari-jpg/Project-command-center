import { createFactoryIntake } from "@/app/(protected)/mutations";
import { Field, Select, TextArea } from "@/components/form-fields";
import { FlashMessage } from "@/components/flash-message";
import { FactoryAIAssistant } from "@/components/factory-ai-assistant";
import { PageHeader } from "@/components/page-header";
import { Card, primaryButtonClass } from "@/components/ui";
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
      <PageHeader
        eyebrow="Projectos"
        title="Novo projecto"
      />
      <FlashMessage
        error={params.error}
        created={params.created}
        message={params.created ? "Novo projecto recebido. A avaliação foi iniciada." : undefined}
      />

      <div className="max-w-4xl">
        <Card className="p-5">
          <div>
            <p className="text-sm leading-6 text-[var(--cc-secondary)]">
              Descreva a ideia. O PCC inicia a avaliação antes de qualquer planeamento ou execução.
            </p>
          </div>

          <form action={createFactoryIntake} className="mt-5 space-y-4">
            <FactoryAIAssistant />

            <div className="space-y-4">
              <Field
                label="1. Qual é o projecto ou ideia que quer avaliar?"
                name="title"
                required
                placeholder="Ex.: Criar um novo serviço para melhorar o atendimento ao cliente."
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
                help="Escolha Comercial quando o resultado depende de mercado, clientes ou receita. Escolha Interno quando o foco é operação, eficiência ou gestão."
              >
                <option value="commercial">Comercial / mercado</option>
                <option value="non_commercial">Interno / não comercial</option>
              </Select>

              <input type="hidden" name="description" value="" />
              <input type="hidden" name="constraints" value="" />
              <input type="hidden" name="source" value="" />
            </div>

            <button className={primaryButtonClass} type="submit">Iniciar avaliação</button>
          </form>
        </Card>
      </div>
    </>
  );
}
