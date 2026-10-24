import {
  generateInvestmentDiscoveryBrief,
  selectInvestmentDiscoveryOption,
} from "@/app/(protected)/mutations";
import { Card, primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import type { InvestmentOpportunity } from "@/lib/investment-discovery";

type Brief = {
  executive_summary: string;
  opportunities: unknown;
  recommended_option_id: string | null;
  recommendation: string | null;
  decision_criteria: string | null;
  selected_option_id: string | null;
  status: string;
};

export function InvestmentDiscoveryPanel({
  factoryCaseId,
  brief,
}: {
  factoryCaseId: string;
  brief: Brief | null;
}) {
  const opportunities = Array.isArray(brief?.opportunities)
    ? brief.opportunities as InvestmentOpportunity[]
    : [];

  if (!brief || opportunities.length < 3) {
    return (
      <Card className="p-5 sm:p-6">
        <h2 className="text-xl font-semibold text-[var(--cc-foreground)]">Propostas de negócio</h2>
        <form action={generateInvestmentDiscoveryBrief} className="mt-5">
          <input type="hidden" name="factory_case_id" value={factoryCaseId} />
          <button className={primaryButtonClass} type="submit">
            Gerar propostas para decisão
          </button>
        </form>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--cc-secondary)]">
              Resumo para decisão
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--cc-foreground)]">
              Oportunidades de investimento
            </h2>
          </div>
          <a
            className={secondaryButtonClass}
            href={`/api/exports/investment-brief/${factoryCaseId}`}
          >
            Baixar resumo
          </a>
        </div>

        <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[var(--cc-foreground)]">
          {brief.executive_summary}
        </p>

        <div className="mt-6 grid gap-4">
          {opportunities.map((option, index) => {
            const recommended = option.id === brief.recommended_option_id;
            return (
              <article
                key={option.id}
                className="rounded-[var(--cc-radius-lg)] border border-[var(--cc-border)] bg-[var(--cc-surface-strong)] p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--cc-secondary)]">
                      Proposta {index + 1}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-[var(--cc-foreground)]">
                      {option.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {recommended && (
                      <span className="rounded-full bg-[var(--cc-warning-soft)] px-3 py-1 text-xs font-semibold text-[#805B1B]">
                        Recomendada
                      </span>
                    )}
                    <span className="rounded-full bg-[var(--cc-surface-muted)] px-3 py-1 text-sm font-semibold text-[var(--cc-foreground)]">
                      {option.score}/100
                    </span>
                  </div>
                </div>

                <p className="mt-4 text-sm leading-6 text-[var(--cc-foreground)]">{option.concept}</p>

                <dl className="mt-5 grid gap-4 md:grid-cols-2">
                  <Item label="Necessidade / oportunidade" value={option.problem_or_need} />
                  <Item label="Mercado a validar" value={option.target_market} />
                  <Item label="Modelo de negócio" value={option.business_model} />
                  <Item label="Porque encaixa" value={option.why_fit} />
                  <Item label="Estratégia de entrada" value={option.entry_strategy} />
                  <Item label="Estratégia de validação" value={option.validation_strategy} />
                  <Item label="Investimento inicial" value={option.estimated_initial_cost} />
                  <Item label="Tempo para validar" value={option.time_to_validate} />
                </dl>

                {option.key_risks?.length > 0 && (
                  <div className="mt-5">
                    <p className="text-sm font-semibold text-[var(--cc-foreground)]">Riscos principais</p>
                    <ul className="mt-2 space-y-1 text-sm text-[var(--cc-secondary)]">
                      {option.key_risks.map((risk) => <li key={risk}>• {risk}</li>)}
                    </ul>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--cc-secondary)]">
          Recomendação
        </p>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--cc-foreground)]">
          {brief.recommendation}
        </p>
        {brief.decision_criteria && (
          <>
            <p className="mt-5 text-sm font-semibold text-[var(--cc-foreground)]">Critérios de decisão</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--cc-secondary)]">
              {brief.decision_criteria}
            </p>
          </>
        )}
      </Card>

      <Card className="p-5 sm:p-6">
        <h2 className="text-xl font-semibold text-[var(--cc-foreground)]">Decisão</h2>
        <form action={selectInvestmentDiscoveryOption} className="mt-5 space-y-4">
          <input type="hidden" name="factory_case_id" value={factoryCaseId} />
          <label className="block text-sm font-medium text-[var(--cc-foreground)]">
            Oportunidade a seguir
            <select
              className="mt-1 w-full rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface-strong)] px-3 py-2.5 text-sm text-[var(--cc-foreground)]"
              name="option_id"
              required
              defaultValue={brief.recommended_option_id ?? ""}
            >
              <option value="" disabled>Seleccione uma proposta</option>
              {opportunities.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.title}{option.id === brief.recommended_option_id ? " — recomendada" : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-[var(--cc-foreground)]">
            Nota da decisão
            <textarea
              className="mt-1 min-h-24 w-full rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface-strong)] px-3 py-2.5 text-sm text-[var(--cc-foreground)]"
              name="decision_rationale"
              placeholder="Opcional"
            />
          </label>

          <button className={primaryButtonClass} type="submit">
            Seleccionar e seguir para validação
          </button>
        </form>
      </Card>
    </div>
  );
}

function Item({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--cc-secondary)]">
        {label}
      </dt>
      <dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[var(--cc-foreground)]">
        {value}
      </dd>
    </div>
  );
}
