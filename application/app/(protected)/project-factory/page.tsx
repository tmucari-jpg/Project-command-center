import { createFactoryIntake } from "@/app/(protected)/mutations";
import { Field, Select, TextArea } from "@/components/form-fields";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { Card, EmptyState, primaryButtonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";

const STAGE_LABELS: Record<string, string> = {
  new_idea: "New Idea",
  viability: "Viability Analysis",
  competitive_intelligence: "Competitive Intelligence",
  validation: "Validation",
  execution_arena: "Execution Arena",
  factory_report: "Factory Report",
  decision: "Decision",
  converted_to_project: "Project",
  on_hold: "On Hold",
  killed: "Killed",
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
        eyebrow="Project Factory"
        title="Entrada obrigatória de novos projectos"
        description="Toda nova ideia entra aqui antes de se tornar projecto. O primeiro bloco captura o problema, valor esperado e contexto e encaminha automaticamente para Viability Analysis."
      />
      <FlashMessage
        error={params.error ?? error?.message}
        created={params.created}
        message={params.created ? "Ideia recebida pela Factory e encaminhada para Viability Analysis." : undefined}
      />

      <div className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">New Idea</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
            Registe apenas informação suficiente para a Factory iniciar a análise. Projectos comerciais ficam marcados para Competitive Intelligence na etapa própria.
          </p>

          <form action={createFactoryIntake} className="mt-5 space-y-4">
            <Field label="Título" name="title" required />
            <TextArea label="Descrição" name="description" />
            <TextArea label="Problema identificado" name="problem" required />
            <Select label="Tipo de projecto" name="project_type" defaultValue="commercial">
              <option value="commercial">Comercial / mercado</option>
              <option value="non_commercial">Não comercial</option>
            </Select>
            <TextArea label="Utilizador / público-alvo" name="target_user" />
            <TextArea label="Valor esperado" name="expected_value" />
            <TextArea label="Restrições conhecidas" name="constraints" />
            <Field label="Origem da ideia" name="source" />
            <button className={primaryButtonClass} type="submit">
              Enviar para a Factory
            </button>
          </form>
        </Card>

        <Card>
          <div className="border-b border-[var(--cc-border)] p-5">
            <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Pipeline da Factory</h2>
          </div>
          <div className="p-5">
            {!cases?.length ? (
              <EmptyState>Ainda não existem ideias na Project Factory.</EmptyState>
            ) : (
              <div className="space-y-4">
                {cases.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface-strong)] p-4"
                  >
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-[var(--cc-foreground)]">{item.title}</h3>
                        <p className="mt-1 text-sm text-[var(--cc-secondary)]">
                          {STAGE_LABELS[item.stage] ?? item.stage}
                        </p>
                      </div>
                      <span className="w-fit rounded-full bg-[var(--cc-surface-muted)] px-3 py-1 text-xs font-semibold text-[var(--cc-secondary)]">
                        {item.project_type === "commercial" ? "Comercial" : "Não comercial"}
                      </span>
                    </div>

                    <p className="mt-3 text-sm leading-6 text-[var(--cc-foreground)]">{item.problem}</p>

                    {item.competitive_intelligence_required && (
                      <p className="mt-3 text-xs font-medium text-[var(--cc-accent)]">
                        Competitive Intelligence obrigatória antes da decisão final.
                      </p>
                    )}
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
