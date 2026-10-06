import Link from "next/link";
import { notFound } from "next/navigation";
import { saveCompetitiveIntelligence } from "@/app/(protected)/mutations";
import { Select, TextArea } from "@/components/form-fields";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { Card, primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export default async function FactoryCasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; completed?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { supabase, user } = await requireUser();

  const [{ data: factoryCase }, { data: report }] = await Promise.all([
    supabase
      .from("project_factory_cases")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("factory_competitive_intelligence")
      .select("*")
      .eq("factory_case_id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (!factoryCase) notFound();

  const isCommercial = factoryCase.project_type === "commercial";

  return (
    <>
      <div className="mb-4">
        <Link className={secondaryButtonClass} href="/project-factory">Voltar à Project Factory</Link>
      </div>

      <PageHeader
        eyebrow="Project Factory"
        title={factoryCase.title}
        description={factoryCase.problem}
      />

      <FlashMessage
        error={query.error}
        created={query.saved ?? query.completed}
        message={
          query.completed
            ? "Competitive Intelligence concluída. O caso avançou para Validation."
            : "Competitive Intelligence guardada como draft."
        }
      />

      <div className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Contexto da Factory</h2>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="font-semibold text-[var(--cc-secondary)]">Tipo</dt>
              <dd className="mt-1 text-[var(--cc-foreground)]">
                {isCommercial ? "Comercial / mercado" : "Não comercial"}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-[var(--cc-secondary)]">Etapa actual</dt>
              <dd className="mt-1 text-[var(--cc-foreground)]">{factoryCase.stage.replaceAll("_", " ")}</dd>
            </div>
            {factoryCase.target_user && (
              <div>
                <dt className="font-semibold text-[var(--cc-secondary)]">Público-alvo</dt>
                <dd className="mt-1 whitespace-pre-wrap text-[var(--cc-foreground)]">{factoryCase.target_user}</dd>
              </div>
            )}
            {factoryCase.expected_value && (
              <div>
                <dt className="font-semibold text-[var(--cc-secondary)]">Valor esperado</dt>
                <dd className="mt-1 whitespace-pre-wrap text-[var(--cc-foreground)]">{factoryCase.expected_value}</dd>
              </div>
            )}
          </dl>
        </Card>

        <Card className="p-5">
          {!isCommercial ? (
            <>
              <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Competitive Intelligence</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--cc-secondary)]">
                Esta etapa não é obrigatória para projectos não comerciais.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Competitive Intelligence</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
                Registe evidência de mercado antes da validação. As fontes devem ser suficientes para permitir revisão posterior.
              </p>

              <form action={saveCompetitiveIntelligence} className="mt-5 space-y-4">
                <input type="hidden" name="factory_case_id" value={factoryCase.id} />
                <TextArea label="Mercado e oportunidade" name="market_summary" required defaultValue={report?.market_summary ?? ""} />
                <TextArea label="Concorrentes principais" name="competitors" required defaultValue={report?.competitors ?? ""} />
                <TextArea label="Soluções existentes" name="existing_solutions" required defaultValue={report?.existing_solutions ?? ""} />
                <TextArea label="Diferenciação possível" name="differentiation" required defaultValue={report?.differentiation ?? ""} />
                <TextArea label="Tendências de mercado" name="trends" required defaultValue={report?.trends ?? ""} />
                <TextArea label="Riscos e barreiras" name="risks_barriers" required defaultValue={report?.risks_barriers ?? ""} />
                <TextArea label="Fontes / evidências" name="sources" required defaultValue={report?.sources ?? ""} />
                <Select label="Confiança da análise" name="confidence" defaultValue={report?.confidence ?? "medium"}>
                  <option value="low">Baixa</option>
                  <option value="medium">Média</option>
                  <option value="high">Alta</option>
                  <option value="verified">Verificada</option>
                </Select>

                <div className="flex flex-wrap gap-3 pt-2">
                  <button className={secondaryButtonClass} type="submit" name="intent" value="save">
                    Guardar draft
                  </button>
                  <button className={primaryButtonClass} type="submit" name="intent" value="complete">
                    Concluir e avançar para Validation
                  </button>
                </div>
              </form>
            </>
          )}
        </Card>
      </div>
    </>
  );
}
