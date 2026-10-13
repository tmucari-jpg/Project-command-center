import Link from "next/link";
import { notFound } from "next/navigation";
import { finalizeFactoryDecision, saveCompetitiveIntelligence, saveFactoryReport, saveFactoryValidation } from "@/app/(protected)/mutations";
import { Field, Select, TextArea } from "@/components/form-fields";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { Card, primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";

const STAGE_LABELS: Record<string, string> = {
  new_idea: "Ideia recebida",
  viability: "Em análise",
  competitive_intelligence: "Inteligência competitiva",
  validation: "Validação",
  execution_arena: "Arena de execução",
  factory_report: "Relatório final",
  decision: "Decisão",
  converted_to_project: "Convertido em projecto",
  on_hold: "Em espera",
  killed: "Encerrado",
};

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
        `1. Testar com uma amostra real de ${factoryCase.target_user || "utilizadores do público-alvo"}.`,
        "2. Registar quantos reconhecem o problema e quantos consideram a proposta relevante.",
        "3. Medir intenção de adopção/avanço e recolher as principais objecções.",
        "4. Comparar a proposta com as alternativas actualmente utilizadas.",
        "5. Fechar a validação com números, evidências e uma decisão clara: avançar, ajustar ou esperar.",
      ].join("\n"),
    result_summary:
      validation?.result_summary ??
      [
        "RESULTADOS A REGISTAR APÓS O TESTE:",
        "• Procura: nº de pessoas testadas e % que confirma o problema.",
        "• Valor: % que considera a proposta útil/relevante.",
        "• Adopção: nº ou % com intenção concreta de avançar.",
        "• Barreiras: 3 principais objecções ou riscos observados.",
        "",
        "ACÇÕES SEGUINTES:",
        "• Evidência forte → avançar para preparação final.",
        "• Evidência parcial → ajustar proposta e validar novamente.",
        "• Evidência fraca → colocar em espera e rever a hipótese.",
      ].join("\n"),
  };

  const autoFactoryReport = {
    problem_identified: factoryReport?.problem_identified ?? factoryCase.problem ?? "",
    market: factoryReport?.market ?? report?.market_summary ?? autoCompetitive.market_summary,
    competitors: factoryReport?.competitors ?? report?.competitors ?? autoCompetitive.competitors,
    existing_solutions: factoryReport?.existing_solutions ?? report?.existing_solutions ?? autoCompetitive.existing_solutions,
    differentiation: factoryReport?.differentiation ?? report?.differentiation ?? autoCompetitive.differentiation,
    market_trend: factoryReport?.market_trend ?? report?.trends ?? autoCompetitive.trends,
    risks: factoryReport?.risks ?? report?.risks_barriers ?? autoCompetitive.risks_barriers,
    critical_hypotheses: factoryReport?.critical_hypotheses ?? validation?.critical_hypotheses ?? autoValidation.critical_hypotheses,
    tests_required: factoryReport?.tests_required ?? validation?.validation_plan ?? autoValidation.validation_plan,
  };

  const autoDecisionRationale =
    factoryReport?.decision_rationale ??
    validation?.result_summary ??
    `Decisão baseada na evidência recolhida para "${factoryCase.title}", no valor esperado e nos riscos identificados ao longo da validação.`;

  return (
    <>
      <div className="mb-4">
        <Link className={secondaryButtonClass} href="/project-factory">Voltar à Fábrica de Projectos</Link>
      </div>

      <PageHeader
        eyebrow="Fábrica de Projectos"
        title={factoryCase.title}
        description={factoryCase.problem}
      />

      <FlashMessage
        error={query.error}
        created={query.saved ?? query.completed ?? query.validated ?? query.report ?? query.decision}
        message={
          query.decision
            ? "Decisão final registada."
            : query.report
              ? "Relatório Final consolidado. O caso avançou para Decisão."
              : query.validated
                ? "Validação concluída e etapa seguinte definida."
                : query.completed
                  ? "Inteligência Competitiva concluída. O caso avançou para Validação."
                  : "Inteligência Competitiva guardada como rascunho."
        }
      />

      <div className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Contexto do projecto</h2>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="font-semibold text-[var(--cc-secondary)]">Tipo</dt>
              <dd className="mt-1 text-[var(--cc-foreground)]">
                {isCommercial ? "Comercial / mercado" : "Não comercial"}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-[var(--cc-secondary)]">Etapa actual</dt>
              <dd className="mt-1 text-[var(--cc-foreground)]">{STAGE_LABELS[factoryCase.stage] ?? factoryCase.stage.replaceAll("_", " ")}</dd>
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
              <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Inteligência Competitiva</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--cc-secondary)]">
                Esta etapa não é obrigatória para projectos não comerciais.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Inteligência Competitiva</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
                O PCC pré-preenche a análise com base no contexto do projecto. Reveja apenas o que precisar. O preenchimento manual obrigatório fica limitado às fontes/evidências e à confiança da análise.
              </p>

              <form action={saveCompetitiveIntelligence} className="mt-5 space-y-4">
                <input type="hidden" name="factory_case_id" value={factoryCase.id} />
                <TextArea label="Mercado e oportunidade · automático" name="market_summary" required defaultValue={autoCompetitive.market_summary} />
                <TextArea
                  label="Concorrência e alternativas existentes · automático"
                  name="competitors"
                  required
                  defaultValue={report?.competitors ? [report.competitors, report.existing_solutions].filter(Boolean).join("\n\n") : [autoCompetitive.competitors, autoCompetitive.existing_solutions].join("\n\n")}
                />
                <input type="hidden" name="existing_solutions" value={report?.existing_solutions ?? autoCompetitive.existing_solutions} />
                <TextArea label="Diferenciação possível · automático" name="differentiation" required defaultValue={autoCompetitive.differentiation} />
                <TextArea label="Tendências relevantes · automático" name="trends" required defaultValue={autoCompetitive.trends} />
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
                    Guardar rascunho
                  </button>
                  <button className={primaryButtonClass} type="submit" name="intent" value="complete">
                    Concluir e avançar para Validação
                  </button>
                </div>
              </form>
            </>
          )}
        </Card>
      </div>

      {["validation", "execution_arena", "factory_report", "on_hold"].includes(factoryCase.stage) && (
        <Card className="mt-6 p-5">
          <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Validação</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
            O PCC pré-preenche as hipóteses, o plano e a estrutura de resultados com base na entrada inicial e na Inteligência Competitiva. Registe manualmente apenas a evidência realmente observada, complete os números obtidos e reveja a recomendação antes de concluir.
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
            <div className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface-muted)] p-4">
              <p className="text-sm font-semibold text-[var(--cc-foreground)]">Resultado da validação · automático</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--cc-secondary)]">
                {validation?.result_summary ?? autoValidation.result_summary}
              </p>
              <p className="mt-2 text-xs leading-5 text-[var(--cc-secondary)]">
                Ao concluir, o PCC transforma a evidência observada e a recomendação numa conclusão concreta com acções seguintes.
              </p>
            </div>
            <Select
              label="Recomendação · decisão humana obrigatória"
              name="recommendation"
              required
              defaultValue={validation?.recommendation ?? ""}
            >
              <option value="" disabled>Seleccione após rever a evidência</option>
              <option value="proceed">Avançar</option>
              <option value="modify">Ajustar e validar novamente</option>
              <option value="hold">Colocar em espera</option>
            </Select>
            <label className="flex min-h-12 items-center gap-3 rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] px-4 text-sm text-[var(--cc-foreground)]">
              <input
                type="checkbox"
                name="arena_required"
                defaultChecked={validation?.arena_required ?? false}
              />
              Arena de Execução necessária antes do Relatório Final
            </label>
            <button className={primaryButtonClass} type="submit">
              Concluir Validação
            </button>
            {factoryCase.stage === "execution_arena" && (
              <Link className={secondaryButtonClass} href={`/execution-arena?factory_case_id=${factoryCase.id}`}>
                Abrir Arena de Execução
              </Link>
            )}
          </form>
        </Card>
      )}

      {["factory_report", "decision", "converted_to_project", "on_hold", "killed"].includes(factoryCase.stage) && (
        <Card className="mt-6 p-5">
          <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Relatório Final</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
            A informação já recolhida é consolidada automaticamente. Preencha apenas os elementos que exigem avaliação humana antes da decisão final.
          </p>

          <form action={saveFactoryReport} className="mt-5 space-y-4">
            <input type="hidden" name="factory_case_id" value={factoryCase.id} />
            <input type="hidden" name="problem_identified" value={autoFactoryReport.problem_identified} />
            <input type="hidden" name="market" value={autoFactoryReport.market} />
            <input type="hidden" name="competitors" value={autoFactoryReport.competitors} />
            <input type="hidden" name="existing_solutions" value={autoFactoryReport.existing_solutions} />
            <input type="hidden" name="differentiation" value={autoFactoryReport.differentiation} />
            <input type="hidden" name="market_trend" value={autoFactoryReport.market_trend} />
            <input type="hidden" name="risks" value={autoFactoryReport.risks} />
            <input type="hidden" name="critical_hypotheses" value={autoFactoryReport.critical_hypotheses} />
            <input type="hidden" name="tests_required" value={autoFactoryReport.tests_required} />

            <div className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface-muted)] p-4">
              <p className="text-sm font-semibold text-[var(--cc-foreground)]">Consolidado automaticamente</p>
              <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
                Problema, mercado, concorrência, alternativas, diferenciação, tendências, riscos, hipóteses e testes já foram reaproveitados das etapas anteriores. Não precisa de os preencher novamente.
              </p>
            </div>

            <TextArea label="Tecnologia necessária · preencher apenas se aplicável" name="technology_required" defaultValue={factoryReport?.technology_required ?? ""} />
            <TextArea label="Custo estimado · avaliação humana" name="estimated_cost" defaultValue={factoryReport?.estimated_cost ?? ""} />
            <TextArea label="Modelo de receita / sustentabilidade · avaliação humana" name="revenue_model" defaultValue={factoryReport?.revenue_model ?? ""} />
            <TextArea label="Regulamentação / requisitos legais · preencher apenas se aplicável" name="regulation" defaultValue={factoryReport?.regulation ?? ""} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Probabilidade de execução (%) · avaliação humana" name="execution_probability" type="number" min={0} max={100} defaultValue={factoryReport?.execution_probability ?? undefined} />
              <Field label="Probabilidade de adopção (%) · avaliação humana" name="adoption_probability" type="number" min={0} max={100} defaultValue={factoryReport?.adoption_probability ?? undefined} />
            </div>
            <button className={primaryButtonClass} type="submit">Consolidar Relatório Final</button>
          </form>
        </Card>
      )}

      {["decision", "converted_to_project", "on_hold", "killed"].includes(factoryCase.stage) && factoryReport && (
        <Card className="mt-6 p-5">
          <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Decisão</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
            AVANÇAR cria o projecto em Planeamento. AJUSTAR devolve o caso à Validação. ESPERA e ENCERRAR preservam todo o histórico sem criar projecto.
          </p>
          <form action={finalizeFactoryDecision} className="mt-5 space-y-4">
            <input type="hidden" name="factory_case_id" value={factoryCase.id} />
            <Select label="Decisão final · decisão humana obrigatória" name="decision" required defaultValue={factoryReport.final_decision ?? ""}>
              <option value="" disabled>Seleccione a decisão final</option>
              <option value="go">AVANÇAR</option>
              <option value="modify">AJUSTAR</option>
              <option value="hold">ESPERA</option>
              <option value="kill">ENCERRAR</option>
            </Select>
            <TextArea label="Justificação da decisão · pré-preenchida, rever antes de confirmar" name="decision_rationale" required defaultValue={autoDecisionRationale} />
            <button className={primaryButtonClass} type="submit">Registar decisão</button>
          </form>
        </Card>
      )}
    </>
  );
}
