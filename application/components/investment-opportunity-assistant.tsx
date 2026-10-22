"use client";

import { useEffect, useMemo, useState } from "react";
import { createFactoryIntake } from "@/app/(protected)/mutations";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui";

type Opportunity = {
  title: string;
  problem: string;
  expected_value: string;
  target_user: string;
  rationale?: string;
  assumptions?: string;
  missing_information?: string;
};

type Brief = {
  budget: string;
  horizon: string;
  geography: string;
  sectors: string;
  capabilities: string;
  desiredOutcome: string;
  riskTolerance: string;
  constraints: string;
};

const STORAGE_KEY = "pcc-investment-opportunity-brief";

const EMPTY_BRIEF: Brief = {
  budget: "",
  horizon: "",
  geography: "",
  sectors: "",
  capabilities: "",
  desiredOutcome: "",
  riskTolerance: "",
  constraints: "",
};

const INSTRUCTIONS = `Actua como assistente do Project Command Center. O utilizador quer investir mas ainda não tem uma ideia de negócio. A partir do perfil fornecido, propõe no máximo 3 oportunidades como HIPÓTESES para posterior avaliação G1/G2. Não inventes factos de mercado, receitas, procura, custos ou probabilidades. Quando não houver evidência, explicita pressupostos e informação em falta. Devolve APENAS JSON válido: {"opportunities":[{"title":"","problem":"","expected_value":"","target_user":"","rationale":"","assumptions":"","missing_information":""}]}. Escreve em português de Moçambique, executivo e conciso.`;

function parseOpportunities(text: string): Opportunity[] {
  try {
    const clean = text.replace(/^\`\`\`(?:json)?/i, "").replace(/\`\`\`$/i, "").trim();
    const parsed = JSON.parse(clean);
    if (!parsed || !Array.isArray(parsed.opportunities)) return [];
    return parsed.opportunities
      .filter((item: unknown): item is Opportunity => Boolean(item && typeof item === "object"))
      .map((item: Opportunity) => ({
        title: String(item.title ?? "").trim(),
        problem: String(item.problem ?? "").trim(),
        expected_value: String(item.expected_value ?? "").trim(),
        target_user: String(item.target_user ?? "").trim(),
        rationale: String(item.rationale ?? "").trim(),
        assumptions: String(item.assumptions ?? "").trim(),
        missing_information: String(item.missing_information ?? "").trim(),
      }))
      .filter((item: Opportunity) => item.title.length >= 2 && item.problem.length >= 3)
      .slice(0, 3);
  } catch {
    return [];
  }
}

async function callLocal(input: string) {
  const response = await fetch("http://127.0.0.1:8080/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "qwen-local",
      messages: [
        { role: "system", content: INSTRUCTIONS },
        { role: "user", content: input },
      ],
      temperature: 0.2,
      max_tokens: 1500,
    }),
  });
  if (!response.ok) throw new Error(`LOCAL_${response.status}`);
  const body = await response.json();
  return String(body?.choices?.[0]?.message?.content ?? "");
}

export function InvestmentOpportunityAssistant() {
  const [brief, setBrief] = useState<Brief>(EMPTY_BRIEF);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setBrief({ ...EMPTY_BRIEF, ...JSON.parse(saved) });
    } catch {
      // O formulário continua disponível mesmo quando o armazenamento local não está acessível.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(brief));
    } catch {
      // Sem armazenamento local, o formulário continua a funcionar durante a sessão.
    }
  }, [brief]);

  const profile = useMemo(() => [
    `Capital/recursos disponíveis: ${brief.budget || "Em falta"}`,
    `Horizonte: ${brief.horizon || "Em falta"}`,
    `Geografia: ${brief.geography || "Em falta"}`,
    `Sectores de interesse: ${brief.sectors || "Em falta"}`,
    `Capacidades/recursos existentes: ${brief.capabilities || "Em falta"}`,
    `Resultado pretendido: ${brief.desiredOutcome || "Em falta"}`,
    `Tolerância ao risco: ${brief.riskTolerance || "Em falta"}`,
    `Restrições: ${brief.constraints || "Em falta"}`,
  ].join("\n"), [brief]);

  function update<K extends keyof Brief>(key: K, value: Brief[K]) {
    setBrief((current) => ({ ...current, [key]: value }));
  }

  async function generate() {
    setBusy(true);
    setMessage(null);
    setOpportunities([]);
    try {
      let text = "";
      const cloud = await fetch("/api/ai/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: profile, instructions: INSTRUCTIONS }),
      });

      if (cloud.ok) {
        const data = await cloud.json();
        text = String(data.text ?? "");
      } else {
        try {
          text = await callLocal(profile);
        } catch {
          throw new Error("IA indisponível");
        }
      }

      const parsed = parseOpportunities(text);
      if (!parsed.length) throw new Error("Resposta sem oportunidades válidas");
      setOpportunities(parsed);
      setMessage("Hipóteses preparadas. Escolha uma apenas para iniciar a avaliação formal; nenhuma está validada ainda.");
    } catch {
      setMessage("O perfil ficou guardado neste dispositivo, mas o PCC não cria oportunidades sem uma IA disponível. Volte a gerar quando houver ligação ou runtime local validado.");
    } finally {
      setBusy(false);
    }
  }

  const fieldClass = "mt-1 w-full rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface-strong)] px-3 py-2.5 text-sm text-[var(--cc-foreground)] outline-none";

  return (
    <div className="space-y-5">
      <div className="rounded-[var(--cc-radius-lg)] border border-[var(--cc-border)] bg-[var(--cc-surface)] p-5">
        <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Defina primeiro o perfil de investimento</h2>
        <p className="mt-1 text-sm leading-6 text-[var(--cc-secondary)]">
          O PCC usa este perfil para propor hipóteses. Não assume procura, retorno ou viabilidade sem evidência.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-[var(--cc-foreground)]">
            Capital ou recursos disponíveis
            <input className={fieldClass} value={brief.budget} onChange={(e) => update("budget", e.target.value)} placeholder="Ex.: até 2.000.000 MZN; equipa de 2 pessoas" />
          </label>
          <label className="text-sm font-medium text-[var(--cc-foreground)]">
            Horizonte esperado
            <input className={fieldClass} value={brief.horizon} onChange={(e) => update("horizon", e.target.value)} placeholder="Ex.: 12–24 meses" />
          </label>
          <label className="text-sm font-medium text-[var(--cc-foreground)]">
            Mercado / geografia
            <input className={fieldClass} value={brief.geography} onChange={(e) => update("geography", e.target.value)} placeholder="Ex.: Maputo, Moçambique, regional" />
          </label>
          <label className="text-sm font-medium text-[var(--cc-foreground)]">
            Sectores de interesse
            <input className={fieldClass} value={brief.sectors} onChange={(e) => update("sectors", e.target.value)} placeholder="Ex.: serviços, seguros, tecnologia; ou aberto" />
          </label>
          <label className="text-sm font-medium text-[var(--cc-foreground)]">
            Capacidades ou activos que já possui
            <textarea className={fieldClass + " min-h-24"} value={brief.capabilities} onChange={(e) => update("capabilities", e.target.value)} placeholder="Experiência, rede comercial, tecnologia, instalações, equipa..." />
          </label>
          <label className="text-sm font-medium text-[var(--cc-foreground)]">
            Resultado que pretende alcançar
            <textarea className={fieldClass + " min-h-24"} value={brief.desiredOutcome} onChange={(e) => update("desiredOutcome", e.target.value)} placeholder="Rendimento, crescimento, impacto, diversificação..." />
          </label>
          <label className="text-sm font-medium text-[var(--cc-foreground)]">
            Tolerância ao risco
            <input className={fieldClass} value={brief.riskTolerance} onChange={(e) => update("riskTolerance", e.target.value)} placeholder="Baixa, média, alta; explique se necessário" />
          </label>
          <label className="text-sm font-medium text-[var(--cc-foreground)]">
            Restrições
            <textarea className={fieldClass + " min-h-24"} value={brief.constraints} onChange={(e) => update("constraints", e.target.value)} placeholder="Tempo, licenças, equipa, liquidez, sectores a evitar..." />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" className={primaryButtonClass} disabled={busy} onClick={generate}>
            {busy ? "A preparar hipóteses..." : "Procurar oportunidades para avaliar"}
          </button>
          <span className="text-xs text-[var(--cc-secondary)]">O perfil é guardado localmente enquanto trabalha.</span>
        </div>
        {message && <p className="mt-4 text-sm text-[var(--cc-secondary)]">{message}</p>}
      </div>

      {opportunities.length > 0 && (
        <div className="grid gap-4 xl:grid-cols-3">
          {opportunities.map((opportunity, index) => {
            const description = [
              "Hipótese originada a partir de um brief de investimento.",
              opportunity.rationale ? `Racional: ${opportunity.rationale}` : "",
              `Perfil usado:\n${profile}`,
              opportunity.assumptions ? `Pressupostos a validar: ${opportunity.assumptions}` : "",
            ].filter(Boolean).join("\n\n");
            const constraints = [
              brief.constraints ? `Restrições declaradas: ${brief.constraints}` : "",
              opportunity.missing_information ? `Informação em falta: ${opportunity.missing_information}` : "",
            ].filter(Boolean).join("\n\n");

            return (
              <article key={`${opportunity.title}-${index}`} className="rounded-[var(--cc-radius-lg)] border border-[var(--cc-border)] bg-[var(--cc-surface)] p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-gold)]">Hipótese {index + 1}</p>
                <h3 className="mt-2 text-lg font-semibold text-[var(--cc-foreground)]">{opportunity.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[var(--cc-secondary)]">{opportunity.rationale || opportunity.problem}</p>
                {opportunity.assumptions && <p className="mt-3 text-xs text-[var(--cc-overdue)]">Pressupostos: {opportunity.assumptions}</p>}
                {opportunity.missing_information && <p className="mt-2 text-xs text-[var(--cc-secondary)]">Em falta: {opportunity.missing_information}</p>}

                <form action={createFactoryIntake} className="mt-5">
                  <input type="hidden" name="title" value={opportunity.title} />
                  <input type="hidden" name="problem" value={opportunity.problem} />
                  <input type="hidden" name="expected_value" value={opportunity.expected_value} />
                  <input type="hidden" name="target_user" value={opportunity.target_user} />
                  <input type="hidden" name="project_type" value="commercial" />
                  <input type="hidden" name="description" value={description} />
                  <input type="hidden" name="constraints" value={constraints} />
                  <input type="hidden" name="source" value="investment_discovery" />
                  <button className={secondaryButtonClass} type="submit">Avaliar esta oportunidade</button>
                </form>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
