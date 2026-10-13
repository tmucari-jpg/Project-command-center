import Link from "next/link";
import { notFound } from "next/navigation";
import { finalizeFactoryDecision, saveCompetitiveIntelligence, saveFactoryReport, saveFactoryValidation } from "@/app/(protected)/mutations";
import { Field, Select, TextArea } from "@/components/form-fields";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { Card, primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export default async function FactoryCasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; completed?: string; validated?: string; report?: string; decision?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { supabase, user } = await requireUser();

  const [{ data: factoryCase }, { data: report }, { data: validation }, { data: factoryReport }] = await Promise.all([
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
    supabase
      .from("factory_validations")
      .select("*")
      .eq("factory_case_id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("factory_reports")
      .select("*")
      .eq("factory_case_id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (!factoryCase) notFound();

  const isCommercial = factoryCase.project_type === "commercial";

  const autoCompetitive = {
    market_summary:
      report?.market_summary ??
      `Pré-análise automática: oportunidade associada a "${factoryCase.title}". Problema identificado: ${factoryCase.problem}. Público-alvo: ${factoryCase.target_user || "a confirmar"}. Valor esperado: ${factoryCase.expected_value || "a confirmar"}.`,
    competitors:
      report?.competitors ??
      "Pré-análise automática: mapear concorrentes directos que resolvem o mesmo problema, alternativas indirectas e a opção de o cliente não adoptar nenhuma solução. Validar nomes e posicionamento com fontes antes da conclusão.",
    existing_solutions:
      report?.existing_solutions ??
      `Pré-análise automática: considerar soluções actualmente usadas pelo público-alvo para responder ao problema "${factoryCase.problem}", incluindo processos manuais, fornecedores existentes e ferramentas substitutas. Validar com evidência de mercado.`,
    differentiation:
      report?.differentiation ??
      `Pré-análise automática: a diferenciação deve concentrar-se no valor esperado — ${factoryCase.expected_value || "resultado mensurável para o utilizador"} — com experiência simples, demonstração prática e execução mais eficiente do que as alternativas existentes.`,
    trends:
      report?.trends ??
      "Pré-análise automática: validar tendências de digitalização, automação, experiência do utilizador, eficiência operacional e adopção de soluções orientadas por dados relevantes para este mercado.",
    risks_barriers:
      report?.risks_barriers ??
      "Pré-análise automática: principais barreiras a validar incluem adopção, confiança, diferenciação insuficiente, custo de aquisição, execução operacional, disponibilidade de recursos e dependência de terceiros.",
  };

  const autoValidation = {
    critical_hypotheses:
      validation?.critical_hypotheses ??
      [
        `O público-alvo (${factoryCase.target_user || "a confirmar"}) reconhece o problema como relevante.`,
        `A proposta consegue entregar o valor esperado: ${factoryCase.expected_value || "resultado mensurável"}.`,
        `A diferenciação proposta é suficientemente clara face às alternativas existentes.`,
        `Os principais riscos e barreiras identificados podem ser reduzidos a um nível aceitável.`,
      ].join("\n"),
    validation_plan:
      validation?.validation_plan ??
      [
        "Validar a relevância do problema com utilizadores representativos do público-alvo.",
        "Testar a proposta de valor e a diferenciação com demonstração, protótipo ou experiência controlada.",
        "Comparar reacções e objecções com as alternativas actualmente utilizadas.",
        "Registar evidências, critérios de sucesso e sinais de adopção antes da decisão.",
      ].join("\n"),
    result_summary:
      validation?.result_summary ??
      `Resultado esperado da validação: confirmar se existe evidência suficiente para avançar com "${factoryCase.title}", se o valor esperado é percebido pelo público-alvo e se os riscos identificados são controláveis.`,
  };

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
        created={query.saved ?? query.completed ?? query.validated ?? query.report ?? query.decision}
        message={
          query.decision
            ? "Decisão final da Factory registada."
            : query.report
              ? "Factory Report consolidado. O caso avançou para Decision."
              : query.validated
                ? "Validation concluída e etapa seguinte definida."
                : query.completed
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
                O PCC pré-preenche a análise com base no contexto do projecto. Reveja apenas o que precisar. O preenchimento manual obrigatório fica limitado às fontes/evidências e à confiança da análise.
              </p>

              <form action={saveCompetitiveIntelligence} className="mt-5 space-y-4">
                <input type="hidden" name="factory_case_id" value={factoryCase.id} />
                <TextArea label="Mercado e oportunidade · automático" name="market_summary" required defaultValue={autoCompetitive.market_summary} />
                <TextArea label="Concorrentes principais · automático" name="competitors" required defaultValue={autoCompetitive.competitors} />
                <TextArea label="Soluções existentes · automático" name="existing_solutions" required defaultValue={autoCompetitive.existing_solutions} />
                <TextArea label="Diferenciação possível · automático" name="differentiation" required defaultValue={autoCompetitive.differentiation} />
                <TextArea label="Tendências de mercado · automático" name="trends" required defaultValue={autoCompetitive.trends} />
                <TextArea label="Riscos e barreiras · automático" name="risks_barriers" required defaultValue={autoCompetitive.risks_barriers} />
                <TextArea
                  label="Fontes / evidências · preenchimento manual obrigatório"
                  name="sources"
                  required
                  defaultValue={report?.sources ?? ""}
                  placeholder="Indique links, documentos, entrevistas, dados ou outras evidências usadas para validar a análise."
                />
                <Select
                  label="Confiança da análise · selecção manual obrigatória"
                  name="confidence"
                  required
                  defaultValue={report?.confidence ?? ""}
                >
                  <option value="" disabled>Seleccione após rever as evidências</option>
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

      {["validation", "execution_arena", "factory_report", "on_hold"].includes(factoryCase.stage) && (
        <Card className="mt-6 p-5">
          <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Validation</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
            O PCC pré-preenche as hipóteses, o plano e o resultado esperado com base no intake e na Competitive Intelligence. Registe manualmente apenas a evidência realmente observada e reveja a recomendação antes de concluir.
          </p>

          <form action={saveFactoryValidation} className="mt-5 space-y-4">
            <input type="hidden" name="factory_case_id" value={factoryCase.id} />
            <TextArea
              label="Hipóteses críticas"
              name="critical_hypotheses"
              required
              defaultValue={autoValidation.critical_hypotheses}
            />
            <TextArea
              label="Plano de validação"
              name="validation_plan"
              required
              defaultValue={autoValidation.validation_plan}
            />
            <TextArea
              label="Evidência observada · preenchimento manual obrigatório"
              name="evidence"
              required
              placeholder="Registe apenas evidência real: entrevistas, testes, métricas, feedback, documentos ou observações."
              defaultValue={validation?.evidence ?? ""}
            />
            <TextArea
              label="Resultado da validação"
              name="result_summary"
              required
              defaultValue={autoValidation.result_summary}
            />
            <Select
              label="Recomendação"
              name="recommendation"
              defaultValue={validation?.recommendation ?? "proceed"}
            >
              <option value="proceed">Prosseguir</option>
              <option value="modify">Modificar e validar novamente</option>
              <option value="hold">Colocar em espera</option>
            </Select>
            <label className="flex min-h-12 items-center gap-3 rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] px-4 text-sm text-[var(--cc-foreground)]">
              <input
                type="checkbox"
                name="arena_required"
                defaultChecked={validation?.arena_required ?? false}
              />
              Execution Arena necessária antes do Factory Report
            </label>
            <button className={primaryButtonClass} type="submit">
              Concluir Validation
            </button>
          </form>
        </Card>
      )}

      {["factory_report", "decision", "converted_to_project", "on_hold", "killed"].includes(factoryCase.stage) && (
        <Card className="mt-6 p-5">
          <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Factory Report</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
            Consolide a evidência antes da decisão final. Os campos de mercado são pré-preenchidos com a Competitive Intelligence quando disponível.
          </p>

          <form action={saveFactoryReport} className="mt-5 space-y-4">
            <input type="hidden" name="factory_case_id" value={factoryCase.id} />
            <TextArea label="Problema identificado" name="problem_identified" required defaultValue={factoryReport?.problem_identified ?? factoryCase.problem ?? ""} />
            <TextArea label="Mercado" name="market" defaultValue={factoryReport?.market ?? report?.market_summary ?? ""} />
            <TextArea label="Concorrentes" name="competitors" defaultValue={factoryReport?.competitors ?? report?.competitors ?? ""} />
            <TextArea label="Soluções existentes" name="existing_solutions" defaultValue={factoryReport?.existing_solutions ?? report?.existing_solutions ?? ""} />
            <TextArea label="Diferenciação possível" name="differentiation" defaultValue={factoryReport?.differentiation ?? report?.differentiation ?? ""} />
            <TextArea label="Tendência de mercado" name="market_trend" defaultValue={factoryReport?.market_trend ?? report?.trends ?? ""} />
            <TextArea label="Tecnologia necessária" name="technology_required" defaultValue={factoryReport?.technology_required ?? ""} />
            <TextArea label="Custo estimado" name="estimated_cost" defaultValue={factoryReport?.estimated_cost ?? ""} />
            <TextArea label="Modelo de receita" name="revenue_model" defaultValue={factoryReport?.revenue_model ?? ""} />
            <TextArea label="Riscos" name="risks" defaultValue={factoryReport?.risks ?? report?.risks_barriers ?? ""} />
            <TextArea label="Regulamentação" name="regulation" defaultValue={factoryReport?.regulation ?? ""} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Probabilidade de execução (%)" name="execution_probability" type="number" min={0} max={100} defaultValue={factoryReport?.execution_probability ?? undefined} />
              <Field label="Probabilidade de adopção (%)" name="adoption_probability" type="number" min={0} max={100} defaultValue={factoryReport?.adoption_probability ?? undefined} />
            </div>
            <TextArea label="Hipóteses críticas" name="critical_hypotheses" defaultValue={factoryReport?.critical_hypotheses ?? validation?.critical_hypotheses ?? ""} />
            <TextArea label="Testes necessários" name="tests_required" defaultValue={factoryReport?.tests_required ?? validation?.validation_plan ?? ""} />
            <button className={primaryButtonClass} type="submit">Consolidar Factory Report</button>
          </form>
        </Card>
      )}

      {["decision", "converted_to_project", "on_hold", "killed"].includes(factoryCase.stage) && factoryReport && (
        <Card className="mt-6 p-5">
          <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Decision</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
            GO cria o projecto em Planning. MODIFY devolve o caso à Validation. HOLD e KILL preservam todo o histórico sem criar projecto.
          </p>
          <form action={finalizeFactoryDecision} className="mt-5 space-y-4">
            <input type="hidden" name="factory_case_id" value={factoryCase.id} />
            <Select label="Decisão final" name="decision" defaultValue={factoryReport.final_decision ?? "go"}>
              <option value="go">GO</option>
              <option value="modify">MODIFY</option>
              <option value="hold">HOLD</option>
              <option value="kill">KILL</option>
            </Select>
            <TextArea label="Justificação da decisão" name="decision_rationale" required defaultValue={factoryReport.decision_rationale ?? ""} />
            <button className={primaryButtonClass} type="submit">Registar decisão</button>
          </form>
        </Card>
      )}
    </>
  );
}
