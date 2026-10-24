"use client";

import { FormEvent, useRef, useState } from "react";
import { createFactoryIntake } from "@/app/(protected)/mutations";
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

    const directConstraints = String(formData.get("context_constraints") ?? "").trim();
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
    <form action={createFactoryIntake} onSubmit={submit} className="space-y-5">
      <div>
        <label className="text-sm font-semibold text-[var(--cc-foreground)]">
          1. O que pretende fazer?
        </label>
        <select
          className={fieldClass}
          value={intent}
          onChange={(event) => chooseIntent(event.target.value as Intent)}
          name="intent"
        >
          {Object.entries(intentLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

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
          <Extra label="Quem é o cliente / organização?" name="context_client" />
          <Extra label="Qual foi o pedido exacto?" name="context_client_request" />
          <Extra label="Existe orçamento ou intervalo de investimento?" name="context_budget" />
          <Extra label="Existe prazo ou data de entrega?" name="context_deadline" />
          <Extra label="Quem decide / valida do lado do cliente?" name="context_decision_maker" />
          <Extra label="Que informação ou activos o cliente já forneceu?" name="context_available_inputs" />
        </div>
      )}

      {intent === "investment" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Extra label="Capital ou recursos disponíveis" name="context_budget" />
          <Extra label="Horizonte de investimento" name="context_horizon" />
          <Extra label="Geografia / mercados onde pode operar" name="context_geography" />
          <Extra label="Sectores de interesse, se existirem" name="context_sectors" />

          <MultiSelectField
            label="Capacidades, experiência ou activos que já possui"
            name="context_capabilities"
            options={capabilityOptions}
          />

          <Extra label="Nível de envolvimento pretendido no negócio" name="context_involvement" />

          <MultiSelectField
            label="Objectivo de retorno / resultado pretendido"
            name="context_return_objective"
            options={returnObjectiveOptions}
          />

          <MultiSelectField
            label="Tolerância ao risco"
            name="context_risk"
            helper="Seleccione os tipos de risco que estaria disposto a aceitar."
            options={riskToleranceOptions}
          />
        </div>
      )}

      {intent === "internal_improvement" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Extra label="Como funciona o processo hoje?" name="context_current_process" area />
          <Extra label="Onde está a maior dor, atraso ou desperdício?" name="context_pain" area />
          <Extra label="Que equipa está envolvida?" name="context_team" />
          <Extra label="Que sistemas ou ferramentas já são usados?" name="context_systems" />
          <Extra label="Que dependências existem?" name="context_dependencies" area />
          <Extra label="Como saberá que a melhoria funcionou?" name="context_success_measure" />
        </div>
      )}

      {intent === "digital_solution" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Extra label="Quem são os utilizadores principais?" name="context_users" />
          <Extra label="Quais são as funcionalidades essenciais?" name="context_features" area />
          <Extra label="Que dados serão usados?" name="context_data" area />
          <Extra label="Que integrações são necessárias?" name="context_integrations" area />
          <Extra label="Existem requisitos de segurança / acesso?" name="context_security" area />
          <Extra label="Existe prazo ou marco de lançamento?" name="context_deadline" />
        </div>
      )}

      {intent === "idea" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Extra label="Em que fase está a ideia?" name="context_stage" />
          <Extra label="Que recursos já existem?" name="context_resources" area />
          <Extra label="Existe prazo ou urgência?" name="context_deadline" />
          <Extra label="Que pressupostos ainda precisam de validação?" name="context_assumptions" area />
        </div>
      )}

      {intent === "problem" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Extra label="Onde e quando o problema acontece?" name="context_problem_context" area />
          <Extra label="Qual é o impacto actual?" name="context_impact" area />
          <Extra label="O que já foi tentado?" name="context_attempts" area />
          <Extra label="Que pessoas / sistemas estão envolvidos?" name="context_dependencies" area />
        </div>
      )}

      <label className="block text-sm font-medium text-[var(--cc-foreground)]">
        6. Restrições, limites ou condições que o PCC deve respeitar
        <textarea
          className={fieldClass + " min-h-24"}
          name="context_constraints"
          placeholder="Orçamento, prazo, equipa, tecnologia, regras, licenças, segurança, decisões já tomadas..."
        />
      </label>

      {intent === "investment" ? (
        <input type="hidden" name="project_type" value="commercial" />
      ) : (
        <label className="block text-sm font-medium text-[var(--cc-foreground)]">
          7. Natureza do projecto
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

      <button className={primaryButtonClass} type="submit" disabled={preparing}>
        {preparing
          ? "A preparar..."
          : intent === "investment"
            ? "Gerar propostas para decisão"
            : "Iniciar avaliação G1/G2"}
      </button>
    </form>
  );
}

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
}: {
  label: string;
  name: string;
  options: string[];
  helper?: string;
}) {
  return (
    <fieldset className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface-muted)] p-4 md:col-span-2">
      <legend className="px-1 text-sm font-semibold text-[var(--cc-foreground)]">
        {label}
      </legend>
      {helper && (
        <p className="mb-3 text-xs leading-5 text-[var(--cc-secondary)]">{helper}</p>
      )}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((option) => (
          <label
            key={option}
            className="flex cursor-pointer items-start gap-2 rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface-strong)] px-3 py-2.5 text-sm text-[var(--cc-foreground)]"
          >
            <input
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--cc-accent)]"
              type="checkbox"
              name={name}
              value={option}
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
      <label className="mt-3 block text-sm font-medium text-[var(--cc-foreground)]">
        Outro / especificar
        <input
          className={fieldClass}
          name={name}
          placeholder="Acrescente algo que não esteja nas opções."
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
