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
            <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Novo projecto</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
              Registe a ideia ou iniciativa. O PCC inicia a avaliação e o acompanhamento passa a ficar disponível na área de Projectos.
            </p>
          </div>

          <form action={createFactoryIntake} className="mt-5 space-y-4">
            <FactoryAIAssistant />

            <div className="space-y-4">
              <Field
                label="1. Qual é o projecto ou ideia que quer avaliar?"
                name="title"
                required
                help="Use um nome simples e directo. Ex.: Briefing Diário, Nova loja online, Sistema de controlo de frota."
              />

              <TextArea
                label="2. Que problema ou oportunidade justifica este projecto?"
                name="problem"
                required
                help="Explique o problema real que pretende resolver ou a oportunidade que quer aproveitar. Foque no motivo para investir recursos."
                placeholder="Ex.: os clientes demoram demasiado a receber propostas e estamos a perder vendas."
              />

              <TextArea
                label="3. Que resultado espera obter se o projecto funcionar?"
                name="expected_value"
                help="Indique o resultado concreto esperado: receita, redução de custo, ganho de tempo, melhoria de serviço, crescimento ou outro valor mensurável."
                placeholder="Ex.: reduzir o tempo de resposta e aumentar a taxa de conversão."
              />

              <TextArea
                label="4. Quem será afectado ou beneficiado pelo projecto?"
                name="target_user"
                help="Identifique o cliente, utilizador, equipa ou grupo que terá o problema resolvido ou receberá o valor do projecto."
                placeholder="Ex.: clientes empresariais que pedem propostas comerciais."
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

            <button className={primaryButtonClass} type="submit">Adicionar novo projecto</button>
          </form>
        </Card>
      </div>
    </>
  );
}
