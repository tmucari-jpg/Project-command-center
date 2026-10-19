import Link from "next/link";
import { notFound } from "next/navigation";
import { finalizeFactoryDecision, saveCompetitiveIntelligence, saveFactoryReport, saveFactoryValidation } from "@/app/(protected)/mutations";
import { Field, Select, TextArea } from "@/components/form-fields";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { Card, primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { GOVERNANCE_GATE_LABELS, GOVERNANCE_GATE_QUESTIONS, GOVERNANCE_STATUS_LABELS } from "@/lib/governance";

const STAGE_LABELS: Record<string, string> = {
  new_idea: "Ideia recebida",
  viability: "Em avaliação",
  competitive_intelligence: "Análise de mercado",
  validation: "Avaliação de viabilidade",
  execution_arena: "Teste",
  factory_report: "Síntese para decisão",
  decision: "Decisão",
  converted_to_project: "Aprovado — em planeamento",
  on_hold: "Em espera",
  killed: "Não aprovado",
};

const VIABILITY_LABELS: Record<string, string> = {
  viable: "Viável",
  conditional: "Viável com condições",
  not_viable: "Não viável",
  insufficient: "Informação insuficiente",
};

const VIABILITY_RECOMMENDATIONS: Record<string, string> = {
  viable: "A avaliação suporta avançar para decisão de investimento.",
  conditional: "Só deve avançar se as condições críticas forem cumpridas.",
  not_viable: "A avaliação não recomenda investir recursos neste momento.",
  insufficient: "É necessário recolher mais informação antes de decidir.",
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
      `oportunidade associada a "${factoryCase.title}". Problema identificado: ${factoryCase.problem}. Público-alvo: ${factoryCase.target_user || "a confirmar"}. Valor esperado: ${factoryCase.expected_value || "a confirmar"}.`,
    competitors:
      report?.competitors ??
      "mapear concorrentes directos que resolvem o mesmo problema, alternativas indirectas e a opção de o cliente não adoptar nenhuma solução. Validar nomes e posicionamento com fontes antes da conclusão.",
    existing_solutions:
      report?.existing_solutions ??
      `considerar soluções actualmente usadas pelo público-alvo para responder ao problema "${factoryCase.problem}", incluindo processos manuais, fornecedores existentes e ferramentas substitutas. Validar com evidência de mercado.`,
    differentiation:
      report?.differentiation ??
      `a diferenciação deve concentrar-se no valor esperado — ${factoryCase.expected_value || "resultado mensurável para o utilizador"} — com experiência simples, demonstração prática e execução mais eficiente do que as alternativas existentes.`,
    trends:
      report?.trends ??
      "validar tendências de digitalização, automação, experiência do utilizador, eficiência operacional e adopção de soluções orientadas por dados relevantes para este mercado.",
    risks_barriers:
      report?.risks_barriers ??
      "principais barreiras a validar incluem adopção, confiança, diferenciação insuficiente, custo de aquisição, execução operacional, disponibilidade de recursos e dependência de terceiros.",
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
    (
      [
        validation?.viability_summary,
        validation?.conditions_to_proceed ? `Condições para avançar: ${validation.conditions_to_proceed}` : null,
        validation?.result_summary,
      ].filter(Boolean).join("\n\n") ||
      `Decisão baseada na evidência recolhida para "${factoryCase.title}", no valor esperado e nos riscos identificados ao longo da avaliação.`
    );

  return (
    <>
      <div className="mb-4">
        <Link className={secondaryButtonClass} href="/project-factory">Voltar à Fábrica de Projectos</Link>
      </div>

      <PageHeader
        eyebrow="Fábrica de Projectos"
        title={factoryCase.title}
      />

      <FlashMessage
        error={query.error}
        created={query.saved ?? query.completed ?? query.validated ?? query.report ?? query.decision}
        message={
          query.decision
            ? "Decisão final registada."
            : query.report
              ? "Síntese consolidada. O caso avançou para Decisão."
              : query.validated
                ? "Avaliação de viabilidade concluída."
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
              <dt className="font-semibold text-[var(--cc-secondary)]">Gate de governança</dt>
              <dd className="mt-1 font-semibold text-[var(--cc-foreground)]">
                {GOVERNANCE_GATE_LABELS[factoryCase.governance_gate] ?? factoryCase.governance_gate}
              </dd>
              <dd className="mt-1 text-[var(--cc-secondary)]">
                {GOVERNANCE_GATE_QUESTIONS[factoryCase.governance_gate] ?? ""}
              </dd>
              <dd className="mt-1 text-xs text-[var(--cc-secondary)]">
                {GOVERNANCE_STATUS_LABELS[factoryCase.governance_gate_status] ?? factoryCase.governance_gate_status}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-[var(--cc-secondary)]">Etapa de trabalho</dt>
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
              <form action={saveCompetitiveIntelligence} className="mt-5 space-y-4">
                <input type="hidden" name="factory_case_id" value={factoryCase.id} />
                <TextArea label="Mercado e oportunidade" name="market_summary" required defaultValue={autoCompetitive.market_summary} />
                <TextArea
                  label="Concorrência e alternativas existentes"
                  name="competitors"
                  required
                  defaultValue={report?.competitors ? [report.competitors, report.existing_solutions].filter(Boolean).join("\n\n") : [autoCompetitive.competitors, autoCompetitive.existing_solutions].join("\n\n")}
                />
                <input type="hidden" name="existing_solutions" value={report?.existing_solutions ?? autoCompetitive.existing_solutions} />
                <TextArea label="Diferenciação possível" name="differentiation" required defaultValue={autoCompetitive.differentiation} />
                <TextArea label="Tendências relevantes" name="trends" required defaultValue={autoCompetitive.trends} />
                <TextArea label="Riscos e barreiras" name="risks_barriers" required defaultValue={autoCompetitive.risks_barriers} />
                <TextArea
                  label="Fontes / evidências"
                  name="sources"
                  required
                  defaultValue={report?.sources ?? ""}
                  placeholder="Indique links, documentos, entrevistas, dados ou outras evidências usadas para validar a análise."
                />
                <Select
                  label="Confiança da análise"
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
          <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Avaliação de viabilidade</h2>
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
              label="Evidência observada"
              name="evidence"
              required
              placeholder="Registe evidência real: testes, entrevistas, métricas, documentos ou observações."
              defaultValue={validation?.evidence ?? ""}
            />

            <Select
              label="Conclusão de viabilidade"
              name="viability_status"
              required
              defaultValue={validation?.viability_status ?? ""}
            >
              <option value="" disabled>Seleccione após rever a evidência</option>
              <option value="viable">Viável</option>
              <option value="conditional">Viável com condições</option>
              <option value="not_viable">Não viável</option>
              <option value="insufficient">Informação insuficiente</option>
            </Select>

            <TextArea
              label="Fundamentação da viabilidade"
              name="viability_summary"
              defaultValue={validation?.viability_summary ?? ""}
              placeholder="Se ficar vazio, o PCC prepara uma fundamentação com base na evidência."
            />

            <details className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-4">
              <summary className="cursor-pointer text-sm font-semibold text-[var(--cc-foreground)]">Condições e informação em falta</summary>
              <div className="mt-4 space-y-4">
                <TextArea
                  label="Condições para avançar"
                  name="conditions_to_proceed"
                  defaultValue={validation?.conditions_to_proceed ?? ""}
                />
                <TextArea
                  label="Informação ainda necessária"
                  name="missing_information"
                  defaultValue={validation?.missing_information ?? ""}
                />
              </div>
            </details>

            <label className="flex min-h-12 items-center gap-3 rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] px-4 text-sm text-[var(--cc-foreground)]">
              <input
                type="checkbox"
                name="arena_required"
                defaultChecked={validation?.arena_required ?? false}
              />
              Exige teste adicional antes da decisão
            </label>

            <button className={primaryButtonClass} type="submit">Concluir avaliação</button>
            {factoryCase.stage === "execution_arena" && (
              <Link className={secondaryButtonClass} href={`/execution-arena?factory_case_id=${factoryCase.id}`}>
                Abrir teste
              </Link>
            )}
          </form>
        </Card>
      )}

      {validation?.viability_status && (
        <Card className="mt-6 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--cc-secondary)]">Conclusão da avaliação</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-[var(--cc-surface-muted)] px-3 py-1.5 text-sm font-semibold text-[var(--cc-foreground)]">
              {VIABILITY_LABELS[validation.viability_status] ?? validation.viability_status}
            </span>
            <p className="text-sm text-[var(--cc-secondary)]">
              {VIABILITY_RECOMMENDATIONS[validation.viability_status] ?? ""}
            </p>
          </div>
          {validation.viability_summary && (
            <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[var(--cc-foreground)]">{validation.viability_summary}</p>
          )}
          {validation.conditions_to_proceed && (
            <p className="mt-3 text-sm text-[var(--cc-foreground)]"><span className="font-semibold">Condições:</span> {validation.conditions_to_proceed}</p>
          )}
          {validation.missing_information && (
            <p className="mt-3 text-sm text-[var(--cc-foreground)]"><span className="font-semibold">Informação em falta:</span> {validation.missing_information}</p>
          )}
        </Card>
      )}

      {["factory_report", "decision", "converted_to_project", "on_hold", "killed"].includes(factoryCase.stage) && (
        <Card className="mt-6 p-5">
          <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Síntese para decisão</h2>
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
              <p className="text-sm font-semibold text-[var(--cc-foreground)]">Resumo consolidado</p>
              <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
                Informação das etapas anteriores incluída.
              </p>
            </div>

            <TextArea label="Tecnologia necessária" name="technology_required" defaultValue={factoryReport?.technology_required ?? ""} />
            <TextArea label="Custo estimado" name="estimated_cost" defaultValue={factoryReport?.estimated_cost ?? ""} />
            <TextArea label="Modelo de receita / sustentabilidade" name="revenue_model" defaultValue={factoryReport?.revenue_model ?? ""} />
            <TextArea label="Regulamentação / requisitos legais" name="regulation" defaultValue={factoryReport?.regulation ?? ""} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Probabilidade de execução (%)" name="execution_probability" type="number" min={0} max={100} defaultValue={factoryReport?.execution_probability ?? undefined} />
              <Field label="Probabilidade de adopção (%)" name="adoption_probability" type="number" min={0} max={100} defaultValue={factoryReport?.adoption_probability ?? undefined} />
            </div>
            <button className={primaryButtonClass} type="submit">Consolidar avaliação</button>
          </form>
        </Card>
      )}

      {["decision", "converted_to_project", "on_hold", "killed"].includes(factoryCase.stage) && factoryReport && (
        <Card className="mt-6 p-5">
          <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Decisão</h2>
          <form action={finalizeFactoryDecision} className="mt-5 space-y-4">
            <input type="hidden" name="factory_case_id" value={factoryCase.id} />
            <Select label="Decisão sobre o projecto" name="decision" required defaultValue={factoryReport.final_decision ?? ""}>
              <option value="" disabled>Seleccione a decisão final</option>
              <option value="go">AVANÇAR</option>
              <option value="modify">AJUSTAR</option>
              <option value="hold">ESPERA</option>
              <option value="kill">ENCERRAR</option>
            </Select>
            <TextArea label="Justificação da decisão" name="decision_rationale" required defaultValue={autoDecisionRationale} />
            <button className={primaryButtonClass} type="submit">Registar decisão</button>
          </form>
        </Card>
      )}
    </>
  );
}
