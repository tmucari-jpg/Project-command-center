import Link from "next/link";
import { createFactoryIntake } from "@/app/(protected)/mutations";
import { Field, Select, TextArea } from "@/components/form-fields";
import { FlashMessage } from "@/components/flash-message";
import { FactoryAIAssistant } from "@/components/factory-ai-assistant";
import { PageHeader } from "@/components/page-header";
import { ManualEntry } from "@/components/manual-entry";
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
        eyebrow="Novo projecto"
        title="Diga o que pretende criar"
        description="Descreva a ideia de forma simples. O PCC organiza a informação e prepara o projecto para análise."
      />
      <FlashMessage
        error={params.error ?? error?.message}
        created={params.created}
        message={params.created ? "Ideia recebida. A análise foi iniciada." : undefined}
      />

      <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Novo projecto</h2>
            </div>
            
          </div>

          <form action={createFactoryIntake} className="mt-5 space-y-4">
            <FactoryAIAssistant />

            <ManualEntry>
              <div className="space-y-4">
                <Field label="Nome da ideia ou projecto" name="title" required />
                <TextArea
                  label="Que problema quer resolver?"
                  name="problem"
                  required
                  placeholder="Ex.: clientes demoram demasiado a receber propostas comerciais."
                />
                <TextArea
                  label="O que espera conseguir?"
                  name="expected_value"
                  placeholder="Ex.: reduzir o tempo de resposta e aumentar a conversão."
                />
                <Select label="Tipo" name="project_type" defaultValue="commercial">
                  <option value="commercial">Comercial / mercado</option>
                  <option value="non_commercial">Interno / não comercial</option>
                </Select>
                <TextArea label="Descrição adicional" name="description" />
                <TextArea label="Utilizador / público-alvo" name="target_user" />
                <TextArea label="Restrições conhecidas" name="constraints" />
                <Field label="Origem da ideia" name="source" />
              </div>
            </ManualEntry>

            <button className={primaryButtonClass} type="submit">Continuar para análise</button>
          </form>

        </Card>

        <Card>
          <div className="border-b border-[var(--cc-border)] p-5">
            <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Ideias em preparação</h2>
          </div>
          <div className="p-5">
            {!cases?.length ? (
              <EmptyState>Ainda não existem ideias em preparação.</EmptyState>
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
                      <Link className={secondaryButtonClass} href={`/project-factory/${item.id}`}>Rever preparação</Link>
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
