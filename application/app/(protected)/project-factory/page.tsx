import Link from "next/link";
import { createFactoryIntake } from "@/app/(protected)/mutations";
import { Field, Select, TextArea } from "@/components/form-fields";
import { FlashMessage } from "@/components/flash-message";
import { FactoryAIAssistant } from "@/components/factory-ai-assistant";
import { PageHeader } from "@/components/page-header";
import { Card, EmptyState, primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";

const STAGE_LABELS: Record<string, string> = {
  new_idea: "Ideia recebida",
  viability: "Em análise",
  competitive_intelligence: "Análise de mercado",
  validation: "Validação",
  execution_arena: "Teste",
  factory_report: "Preparação final",
  decision: "Decisão",
  converted_to_project: "Convertido em projecto",
  on_hold: "Em espera",
  killed: "Encerrado",
};

export default async function ProjectFactoryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();

  const { data: cases, error } = await supabase
    .from("project_factory_cases")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <>
      <PageHeader
        eyebrow="Novos projectos"
        title="Avaliar um projecto"
      />
      <FlashMessage
        error={params.error ?? error?.message}
        created={params.created}
        message={params.created ? "Projecto recebido. A avaliação foi iniciada." : undefined}
      />

      <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Novo projecto para avaliação</h2>
            </div>
            
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

            <button className={primaryButtonClass} type="submit">Iniciar avaliação</button>
          </form>

        </Card>

        <Card>
          <div className="border-b border-[var(--cc-border)] p-5">
            <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Projectos em avaliação</h2>
          </div>
          <div className="p-5">
            {!cases?.length ? (
              <EmptyState>Não existem iniciativas em preparação.</EmptyState>
            ) : (
              <div className="space-y-4">
                {cases.map((item) => (
                  <article key={item.id} className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface-strong)] p-4">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-[var(--cc-foreground)]">{item.title}</h3>
                        <p className="mt-1 text-sm text-[var(--cc-secondary)]">{STAGE_LABELS[item.stage] ?? item.stage}</p>
                      </div>
                      <span className="w-fit rounded-full bg-[var(--cc-surface-muted)] px-3 py-1 text-xs font-semibold text-[var(--cc-secondary)]">
                        {item.project_type === "commercial" ? "Comercial" : "Interno"}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[var(--cc-foreground)]">{item.problem}</p>
                    <div className="mt-4">
                      <Link className={secondaryButtonClass} href={`/project-factory/${item.id}`}>Rever avaliação</Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
