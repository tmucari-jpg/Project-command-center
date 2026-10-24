export type InvestmentOpportunity = {
  id: string;
  title: string;
  problem_or_need: string;
  concept: string;
  target_market: string;
  expected_value: string;
  business_model: string;
  why_fit: string;
  entry_strategy: string;
  validation_strategy: string;
  estimated_initial_cost: string;
  time_to_validate: string;
  key_risks: string[];
  score: number;
};

export type InvestmentDiscoveryBrief = {
  executive_summary: string;
  opportunities: InvestmentOpportunity[];
  recommended_option_id: string;
  recommendation: string;
  decision_criteria: string;
};

function stripFence(text: string) {
  return text.replace(/^\`\`\`(?:json)?/i, "").replace(/\`\`\`$/i, "").trim();
}

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asRisks(value: unknown) {
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).slice(0, 6);
  const text = asText(value);
  return text ? text.split(/\n|;|•/).map((item) => item.trim()).filter(Boolean).slice(0, 6) : [];
}

function asScore(value: unknown) {
  const score = Number(value);
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function parseInvestmentDiscoveryBrief(text: string): InvestmentDiscoveryBrief | null {
  try {
    const parsed = JSON.parse(stripFence(text)) as Record<string, unknown>;
    const rawOpportunities = Array.isArray(parsed.opportunities) ? parsed.opportunities : [];
    const opportunities = rawOpportunities
      .map((raw, index) => {
        const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
        const title = asText(item.title);
        const concept = asText(item.concept);
        if (!title || !concept) return null;
        return {
          id: asText(item.id) || `option-${index + 1}`,
          title,
          problem_or_need: asText(item.problem_or_need),
          concept,
          target_market: asText(item.target_market),
          expected_value: asText(item.expected_value),
          business_model: asText(item.business_model),
          why_fit: asText(item.why_fit),
          entry_strategy: asText(item.entry_strategy),
          validation_strategy: asText(item.validation_strategy),
          estimated_initial_cost: asText(item.estimated_initial_cost),
          time_to_validate: asText(item.time_to_validate),
          key_risks: asRisks(item.key_risks),
          score: asScore(item.score),
        } satisfies InvestmentOpportunity;
      })
      .filter((item): item is InvestmentOpportunity => Boolean(item))
      .slice(0, 5);

    if (opportunities.length < 3) return null;

    let recommendedOptionId = asText(parsed.recommended_option_id);
    if (!opportunities.some((item) => item.id === recommendedOptionId)) {
      recommendedOptionId = [...opportunities].sort((a, b) => b.score - a.score)[0]?.id ?? opportunities[0].id;
    }

    return {
      executive_summary: asText(parsed.executive_summary) || "Comparação de oportunidades preparada para decisão.",
      opportunities,
      recommended_option_id: recommendedOptionId,
      recommendation: asText(parsed.recommendation),
      decision_criteria: asText(parsed.decision_criteria),
    };
  } catch {
    return null;
  }
}

export function investmentDiscoveryInstructions() {
  return [
    "Actua como analista de oportunidades do Project Command Center.",
    "O utilizador quer investir mas ainda não escolheu um negócio.",
    "Com base APENAS no perfil e restrições fornecidos, cria 5 hipóteses de negócio para decisão.",
    "Não apresentes nenhuma hipótese como negócio já validado, garantido ou comprovado.",
    "Não inventes dados de mercado, receitas, concorrentes, licenças, custos exactos ou procura factual.",
    "Quando não houver dado suficiente, usa linguagem de hipótese e indica o que deve ser validado depois da decisão.",
    "As hipóteses devem ser suficientemente diferentes para permitir uma decisão real.",
    "Cada opção deve incluir a melhor estratégia inicial para entrar no mercado e a estratégia de validação antes de investimento material relevante.",
    "Classifica cada opção de 0 a 100 apenas como adequação ao perfil fornecido, não como probabilidade real de sucesso.",
    "Devolve APENAS JSON válido, sem markdown, com esta forma:",
    JSON.stringify({
      executive_summary: "resumo executivo curto para decisão",
      opportunities: [
        {
          id: "option-1",
          title: "nome curto",
          problem_or_need: "necessidade que a hipótese pretende resolver",
          concept: "descrição curta do negócio",
          target_market: "segmento a validar",
          expected_value: "resultado que o negócio pretende criar",
          business_model: "como poderá gerar receita",
          why_fit: "porque encaixa no perfil de investimento fornecido",
          entry_strategy: "melhor estratégia inicial de entrada",
          validation_strategy: "como validar antes de comprometer capital material",
          estimated_initial_cost: "ordem de grandeza ou estrutura de custos, sem inventar precisão",
          time_to_validate: "prazo indicativo de validação",
          key_risks: ["risco 1", "risco 2"],
          score: 0
        }
      ],
      recommended_option_id: "option-1",
      recommendation: "qual opção recomenda explorar primeiro e porquê",
      decision_criteria: "critérios que devem orientar a escolha"
    }),
  ].join("\n");
}
