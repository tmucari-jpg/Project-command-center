"use client";

import { FormEvent, useRef, useState } from "react";
import { createFactoryIntake } from "@/app/(protected)/mutations";
import { ProjectQuestionnaireActions } from "@/components/project-questionnaire-actions";
import { primaryButtonClass } from "@/components/ui";

type Intent =
  | "idea"
  | "client_request"
  | "investment"
  | "internal_improvement"
  | "digital_solution"
  | "problem";

const fieldClass =
  "mt-1 w-full rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface-strong)] px-3 py-2.5 text-sm text-[var(--cc-foreground)] outline-none";

const intentLabels: Record<Intent, string> = {
  idea: "Tenho uma ideia ou projecto que quero avaliar",
  client_request: "Recebi um pedido de um cliente",
  investment: "Quero encontrar uma oportunidade de negócio / investimento",
  internal_improvement: "Quero melhorar um processo interno",
  digital_solution: "Quero criar uma solução digital / produto",
  problem: "Tenho um problema que quero resolver",
};

function contextRows(formData: FormData) {
  const grouped = new Map<string, string[]>();

  for (const [key, value] of formData.entries()) {
    const text = String(value).trim();
    if (!key.startsWith("context_") || !text) continue;

    const current = grouped.get(key) ?? [];
    if (!current.includes(text)) current.push(text);
    grouped.set(key, current);
  }

  return Array.from(grouped.entries()).map(
    ([key, values]) =>
      `${key.replace("context_", "").replaceAll("_", " ")}: ${values.join("; ")}`,
  );
}

function cleanJson(text: string) {
  return text.replace(/^\`\`\`(?:json)?/i, "").replace(/\`\`\`$/i, "").trim();
}

export function AdaptiveProjectIntake() {
  const [intent, setIntent] = useState<Intent>("idea");
  const [projectType, setProjectType] = useState<"commercial" | "non_commercial">("commercial");
  const [preparing, setPreparing] = useState(false);
  const bypassEnrichment = useRef(false);

  function chooseIntent(value: Intent) {
    setIntent(value);
    if (value === "internal_improvement") setProjectType("non_commercial");
    if (["client_request", "investment", "digital_solution"].includes(value)) setProjectType("commercial");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    if (bypassEnrichment.current) return;

    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const rows = contextRows(formData);
    const descriptionInput = form.elements.namedItem("description") as HTMLInputElement;
    const constraintsInput = form.elements.namedItem("constraints") as HTMLInputElement;
    const sourceInput = form.elements.namedItem("source") as HTMLInputElement;

    const baseDescription = [
      `Tipo de entrada: ${intentLabels[intent]}`,
      ...rows,
    ].join("\n");

    descriptionInput.value = baseDescription;
    sourceInput.value = `adaptive_${intent}`;

    const directConstraints = formData
      .getAll("context_constraints")
      .map((value) => String(value).trim())
      .filter(Boolean)
      .join("; ");
    constraintsInput.value = directConstraints;

    setPreparing(true);

    if (intent === "investment") {
      bypassEnrichment.current = true;
      form.requestSubmit();
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 8_000);

    try {
      const input = JSON.stringify({
        intent: intentLabels[intent],
        title: formData.get("title"),
        problem: formData.get("problem"),
        expected_value: formData.get("expected_value"),
        target_user: formData.get("target_user"),
        project_type: projectType,
        additional_context: rows,
      });

      const response = await fetch("/api/ai/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          input,
          instructions:
            "Estruture este intake do Project Command Center usando APENAS os factos fornecidos. Não invente mercado, custos, datas, clientes ou resultados. Devolva APENAS JSON válido com as chaves description e constraints. Em description, organize o contexto factual e destaque informação em falta. Em constraints, consolide apenas restrições declaradas ou claramente ausentes como informação a confirmar. Português de Moçambique, executivo e conciso.",
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as { text?: string };
        if (data.text) {
          const parsed = JSON.parse(cleanJson(data.text)) as {
            description?: string;
            constraints?: string;
          };
          if (parsed.description?.trim()) {
            descriptionInput.value = parsed.description.trim();
          }
          if (parsed.constraints?.trim()) {
            constraintsInput.value = parsed.constraints.trim();
          }
        }
      }
    } catch {
      // A avaliação continua normalmente quando o enriquecimento interno não responde.
    } finally {
      window.clearTimeout(timer);
      bypassEnrichment.current = true;
      setPreparing(false);
      form.requestSubmit();
    }
  }

  return (
    <form action={createFactoryIntake} onSubmit={submit} className="space-y-6 p-5 sm:p-6">
      <section className="rounded-2xl border border-[var(--cc-border)] bg-[var(--cc-surface-muted)] p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#073f36] text-sm font-semibold text-white">1</span>
          <div>
            <label className="text-sm font-semibold text-[var(--cc-foreground)]">
              O que pretende fazer?
            </label>
            <p className="mt-0.5 text-xs text-[var(--cc-secondary)]">
              Esta escolha define as perguntas seguintes e o modelo de questionário.
            </p>
          </div>
        </div>
        <select
          className={fieldClass + " mt-4"}
          value={intent}
          onChange={(event) => chooseIntent(event.target.value as Intent)}
          name="intent"
        >
          {Object.entries(intentLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <div className="mt-4">
          <ProjectQuestionnaireActions intent={intent} intentLabel={intentLabels[intent]} />
        </div>
      </section>

      {intent === "investment" ? (
        <>
          <input type="hidden" name="title" value="Exploração de oportunidades de investimento" />
          <input
            type="hidden"
            name="problem"
            value="Identificar e comparar oportunidades de negócio compatíveis com o perfil de investimento antes de seleccionar uma para validação."
          />
          <input type="hidden" name="expected_value" value="Seleccionar uma oportunidade prioritária para validação." />
          <input type="hidden" name="target_user" value="" />
        </>
      ) : (
        <>
          <label className="block text-sm font-medium text-[var(--cc-foreground)]">
            2. Como chama este projecto, oportunidade ou problema?
            <input
              className={fieldClass}
              name="title"
              required
              placeholder="Ex.: Automatizar propostas comerciais para clientes empresariais"
            />
          </label>

          <label className="block text-sm font-medium text-[var(--cc-foreground)]">
            3. O que está a acontecer hoje e porque é importante actuar?
            <textarea
              className={fieldClass + " min-h-28"}
              name="problem"
              required
              placeholder="Descreva o problema, necessidade ou oportunidade com o máximo de contexto factual que tiver."
            />
          </label>

          <label className="block text-sm font-medium text-[var(--cc-foreground)]">
            4. Que resultado pretende alcançar?
            <textarea
              className={fieldClass + " min-h-24"}
              name="expected_value"
              placeholder="Ex.: reduzir tempo, aumentar vendas, lançar um serviço, melhorar controlo ou resolver uma dor específica."
            />
          </label>

          <label className="block text-sm font-medium text-[var(--cc-foreground)]">
            5. Quem será afectado, beneficiado ou utilizador principal?
            <textarea
              className={fieldClass + " min-h-20"}
              name="target_user"
              placeholder="Clientes, equipa, parceiros, mercado, utilizadores internos..."
            />
          </label>
        </>
      )}

      {intent === "client_request" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Extra label="6. Quem é o cliente / organização?" name="context_client" />
          <Extra label="7. Qual foi o pedido exacto?" name="context_client_request" />
          <Extra label="8. Existe orçamento ou intervalo de investimento?" name="context_budget" />
          <Extra label="9. Existe prazo ou data de entrega?" name="context_deadline" />
          <Extra label="10. Quem decide / valida do lado do cliente?" name="context_decision_maker" />
          <Extra label="11. Que informação ou activos o cliente já forneceu?" name="context_available_inputs" />
        </div>
      )}

      {intent === "investment" && (
        <div className="space-y-4">
          <section className="rounded-2xl border border-[var(--cc-border)] bg-white p-4 sm:p-5">
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#146453]">Perfil de investimento</p>
              <h3 className="mt-1 text-base font-semibold text-[var(--cc-foreground)]">Recursos e horizonte</h3>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Extra label="2. Capital ou recursos disponíveis" name="context_budget" />
              <Extra label="3. Horizonte de investimento" name="context_horizon" />
            </div>
          </section>

          <MultiSelectField
            label="4. Geografia / mercados onde pode operar"
            name="context_geography"
            options={geographyOptions}
            helper="Seleccione todos os mercados em que estaria disposto a operar."
            detailLabel="Outro mercado / detalhes"
            detailPlaceholder="Ex.: cidade específica, país, corredor logístico, mercado online ou restrição geográfica."
          />

          <MultiSelectField
            label="5. Sectores de interesse, se existirem"
            name="context_sectors"
            options={sectorOptions}
            helper="Pode seleccionar vários sectores. Se não tiver preferência, deixe em branco ou indique isso nos detalhes."
            detailLabel="Outro sector / detalhes"
            detailPlaceholder="Acrescente um sector específico, nicho ou combinação que não esteja nas opções."
          />

          <MultiSelectField
            label="6. Capacidades, experiência ou activos que já possui"
            name="context_capabilities"
            options={capabilityOptions}
          />

          <MultiSelectField
            label="7. Nível de envolvimento pretendido no negócio"
            name="context_involvement"
            options={involvementOptions}
            helper="Seleccione todas as formas de envolvimento que estaria disposto a assumir."
            detailLabel="Outro modelo de envolvimento / detalhes"
            detailPlaceholder="Ex.: disponibilidade semanal, papel pretendido, necessidade de sócio operador ou gestão profissional."
          />

          <MultiSelectField
            label="8. Objectivo de retorno / resultado pretendido"
            name="context_return_objective"
            options={returnObjectiveOptions}
          />

          <MultiSelectField
            label="9. Tolerância ao risco"
            name="context_risk"
            helper="Seleccione os tipos de risco que estaria disposto a aceitar."
            options={riskToleranceOptions}
          />
        </div>
      )}

      {intent === "internal_improvement" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Extra label="6. Como funciona o processo hoje?" name="context_current_process" area />
          <Extra label="7. Onde está a maior dor, atraso ou desperdício?" name="context_pain" area />
          <Extra label="8. Que equipa está envolvida?" name="context_team" />
          <Extra label="9. Que sistemas ou ferramentas já são usados?" name="context_systems" />
          <Extra label="10. Que dependências existem?" name="context_dependencies" area />
          <Extra label="11. Como saberá que a melhoria funcionou?" name="context_success_measure" />
        </div>
      )}

      {intent === "digital_solution" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Extra label="6. Quem são os utilizadores principais?" name="context_users" />
          <Extra label="7. Quais são as funcionalidades essenciais?" name="context_features" area />
          <Extra label="8. Que dados serão usados?" name="context_data" area />
          <Extra label="9. Que integrações são necessárias?" name="context_integrations" area />
          <Extra label="10. Existem requisitos de segurança / acesso?" name="context_security" area />
          <Extra label="11. Existe prazo ou marco de lançamento?" name="context_deadline" />
        </div>
      )}

      {intent === "idea" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Extra label="6. Em que fase está a ideia?" name="context_stage" />
          <Extra label="7. Que recursos já existem?" name="context_resources" area />
          <Extra label="8. Existe prazo ou urgência?" name="context_deadline" />
          <Extra label="9. Que pressupostos ainda precisam de validação?" name="context_assumptions" area />
        </div>
      )}

      {intent === "problem" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Extra label="6. Onde e quando o problema acontece?" name="context_problem_context" area />
          <Extra label="7. Qual é o impacto actual?" name="context_impact" area />
          <Extra label="8. O que já foi tentado?" name="context_attempts" area />
          <Extra label="9. Que pessoas / sistemas estão envolvidos?" name="context_dependencies" area />
        </div>
      )}

      <MultiSelectField
        label={`${constraintsQuestionNumber(intent)}. Restrições, limites ou condições que o PCC deve respeitar`}
        name="context_constraints"
        options={constraintOptions}
        helper="Seleccione as condições aplicáveis e acrescente detalhes quando necessário."
        detailLabel="Detalhes adicionais"
        detailPlaceholder="Ex.: orçamento máximo, prazo exacto, regra específica, tecnologia obrigatória, licença necessária..."
      />

      {intent === "investment" ? (
        <input type="hidden" name="project_type" value="commercial" />
      ) : (
        <label className="block text-sm font-medium text-[var(--cc-foreground)]">
          {natureQuestionNumber(intent)}. Natureza do projecto
          <select
            className={fieldClass}
            name="project_type"
            value={projectType}
            onChange={(event) => setProjectType(event.target.value as "commercial" | "non_commercial")}
          >
            <option value="commercial">Comercial / mercado</option>
            <option value="non_commercial">Interno / não comercial</option>
          </select>
        </label>
      )}

      <input type="hidden" name="description" defaultValue="" />
      <input type="hidden" name="constraints" defaultValue="" />
      <input type="hidden" name="source" defaultValue="adaptive_idea" />

      <div className="flex justify-end border-t border-[var(--cc-border)] pt-5">
        <button className={primaryButtonClass} type="submit" disabled={preparing}>
        {preparing
          ? "A preparar..."
          : intent === "investment"
            ? "Gerar propostas para decisão"
            : "Iniciar avaliação G1/G2"}
        </button>
      </div>
    </form>
  );
}

function constraintsQuestionNumber(intent: Intent) {
  if (intent === "investment") return 10;
  if (["client_request", "internal_improvement", "digital_solution"].includes(intent)) return 12;
  return 10;
}

function natureQuestionNumber(intent: Intent) {
  if (["client_request", "internal_improvement", "digital_solution"].includes(intent)) return 13;
  return 11;
}

const constraintOptions = [
  "Orçamento máximo definido",
  "Prazo ou data limite",
  "Equipa / capacidade disponível limitada",
  "Tecnologia ou plataforma obrigatória",
  "Integrações ou sistemas existentes a respeitar",
  "Licenças, autorizações ou requisitos regulatórios",
  "Requisitos de segurança, privacidade ou acesso",
  "Geografia / mercado onde deve operar",
  "Fornecedor, parceiro ou recurso obrigatório",
  "Decisões já tomadas que não devem ser alteradas",
  "Limite de exposição financeira / capital em risco",
  "Operação deve começar pequena e ser validada antes de escalar",
];

const geographyOptions = [
  "Moçambique",
  "África Austral / SADC",
  "Outros mercados africanos",
  "Portugal",
  "União Europeia",
  "Médio Oriente / Golfo",
  "Ásia",
  "Américas",
  "Mercado global / operação online",
];

const sectorOptions = [
  "Agricultura, agro-indústria e alimentos",
  "Retalho, distribuição e e-commerce",
  "Beleza, cosmética e cuidados pessoais",
  "Saúde, bem-estar e serviços clínicos",
  "Educação, formação e capacitação",
  "Serviços financeiros, seguros e fintech",
  "Imobiliário, construção e gestão de propriedades",
  "Transportes, logística, mobilidade e frotas",
  "Turismo, hotelaria, restauração e lazer",
  "Segurança e serviços operacionais",
  "Energia, água e utilities",
  "Indústria e transformação",
  "Tecnologia, software, dados e IA",
  "Serviços profissionais e soluções B2B",
  "Media, entretenimento, conteúdo e economia criativa",
  "Sustentabilidade, ambiente e economia circular",
];

const involvementOptions = [
  "Investidor passivo",
  "Acompanhamento estratégico / conselho",
  "Desenvolvimento comercial e parcerias",
  "Participação activa na gestão",
  "Operar com um sócio / parceiro executivo",
  "Contratar gestão profissional",
  "Participação temporária até estabilizar o negócio",
  "Modelo flexível conforme a oportunidade",
];

const capabilityOptions = [
  "Gestão e liderança",
  "Vendas e desenvolvimento comercial",
  "Marketing, marca e conteúdos",
  "Finanças, contabilidade ou investimento",
  "Tecnologia, produto digital ou dados",
  "Operações, logística ou supply chain",
  "Experiência específica num sector",
  "Rede de contactos ou acesso a clientes",
  "Parceiros ou fornecedores já identificados",
  "Equipa disponível",
  "Instalações, imóveis ou terreno",
  "Equipamentos, viaturas ou outros activos físicos",
  "Marca, comunidade ou audiência",
  "Licenças, autorizações ou concessões",
  "Propriedade intelectual ou know-how próprio",
];

const returnObjectiveOptions = [
  "Rendimento recorrente / cash flow",
  "Crescimento do capital no médio ou longo prazo",
  "Retorno rápido / payback curto",
  "Construir um negócio escalável",
  "Diversificar investimentos",
  "Criar um activo para venda futura",
  "Criar sinergia com negócios ou activos existentes",
  "Construir uma empresa de longo prazo",
  "Gerar impacto social ou ambiental",
];

const riskToleranceOptions = [
  "Aceito perda parcial do capital na fase inicial",
  "Aceito receitas instáveis enquanto o negócio é validado",
  "Aceito um prazo mais longo até ao retorno",
  "Aceito entrar num mercado ainda por validar",
  "Aceito uma operação intensiva em equipa e gestão",
  "Aceito dependência relevante de tecnologia ou produto novo",
  "Aceito exposição a licenças, regulação ou aprovações",
  "Aceito dependência inicial de poucos clientes ou parceiros",
  "Aceito exposição cambial ou operação em mais de um mercado",
  "Prefiro limitar a perda de capital e privilegiar previsibilidade",
];

function MultiSelectField({
  label,
  name,
  options,
  helper,
  detailLabel = "Outro / especificar",
  detailPlaceholder = "Acrescente algo que não esteja nas opções.",
}: {
  label: string;
  name: string;
  options: string[];
  helper?: string;
  detailLabel?: string;
  detailPlaceholder?: string;
}) {
  return (
    <fieldset className="rounded-2xl border border-[var(--cc-border)] bg-white p-4 sm:p-5 md:col-span-2">
      <legend className="px-1 text-sm font-semibold text-[var(--cc-foreground)]">
        {label}
      </legend>
      {helper && (
        <p className="mb-3 max-w-3xl text-xs leading-5 text-[var(--cc-secondary)]">{helper}</p>
      )}
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {options.map((option) => (
          <label
            key={option}
            className="flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-muted)] px-3 py-2 text-[13px] leading-5 text-[var(--cc-foreground)] transition hover:border-[#9eb8ae] hover:bg-white"
          >
            <input
              className="h-4 w-4 shrink-0 accent-[var(--cc-accent)]"
              type="checkbox"
              name={name}
              value={option}
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
      <label className="mt-3 block text-xs font-medium text-[var(--cc-secondary)]">
        {detailLabel}
        <input
          className={fieldClass}
          name={name}
          placeholder={detailPlaceholder}
        />
      </label>
    </fieldset>
  );
}

function Extra({
  label,
  name,
  area = false,
}: {
  label: string;
  name: string;
  area?: boolean;
}) {
  return (
    <label className="block text-sm font-medium text-[var(--cc-foreground)]">
      {label}
      {area ? (
        <textarea className={fieldClass + " min-h-24"} name={name} />
      ) : (
        <input className={fieldClass} name={name} />
      )}
    </label>
  );
}
