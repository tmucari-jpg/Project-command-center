"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { submitClientDiagnostic } from "@/app/client-diagnostic/[token]/actions";
import { primaryButtonClass } from "@/components/ui";

type Nature =
  | "problem"
  | "improve_existing"
  | "idea"
  | "active_project"
  | "organization_solution"
  | "commercial_growth"
  | "investment_discovery"
  | "investment_existing"
  | "explore";

const fieldClass =
  "mt-2 w-full rounded-xl border border-[#dce5df] bg-white px-3 py-2.5 text-sm text-[#142825] outline-none focus:border-[#146453]";

const natureOptions: Array<{ value: Nature; label: string }> = [
  { value: "problem", label: "Tenho um problema que preciso de resolver" },
  { value: "improve_existing", label: "Quero melhorar algo que já existe" },
  { value: "idea", label: "Tenho uma ideia e quero perceber se é viável" },
  { value: "active_project", label: "Tenho um projecto e preciso de apoio" },
  { value: "organization_solution", label: "Preciso de uma solução para a minha organização" },
  { value: "commercial_growth", label: "Quero aumentar vendas, clientes ou resultados" },
  { value: "investment_discovery", label: "Quero investir, mas ainda não sei em quê nem por onde começar" },
  { value: "investment_existing", label: "Já tenho uma oportunidade de investimento e quero avaliá-la" },
  { value: "explore", label: "Quero explorar possibilidades antes de decidir" },
];

export function ClientDiagnosticQuestionnaire({
  token,
  clientName,
  clientOrganization,
  publicContext,
  questionnaireVersion,
  expiresAt,
}: {
  token: string;
  clientName?: string | null;
  clientOrganization?: string | null;
  publicContext?: string | null;
  questionnaireVersion?: string | null;
  expiresAt: string;
}) {
  const [respondentType, setRespondentType] = useState("");
  const isGIE360 = questionnaireVersion === "executive-gie360-v1";
  const [nature, setNature] = useState<Nature | "">(isGIE360 ? "organization_solution" : "");

  return (
    <main className="min-h-screen bg-[#f8f6f0] px-4 py-8 text-[#142825] sm:py-12">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 overflow-hidden rounded-2xl border border-[#e0e8e3] bg-white shadow-sm">
          <div className="border-b border-[#e0e8e3] bg-[#f8f6f0] px-5 py-5 sm:px-7">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Image
                src="/brand/pcc-logo-transparent.svg"
                alt="Project Command Center"
                width={230}
                height={82}
                className="h-auto w-[190px] sm:w-[220px]"
                priority
              />
              <div className="text-right">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c99439]">
                  Avalie. Decida. Execute.
                </p>
                <p className="mt-1 text-xs text-[#5f6c68]">Da Estratégia à Execução</p>
              </div>
            </div>
          </div>
          <div className="px-5 py-5 sm:px-7 sm:py-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#146453]">
              Questionário Executivo
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-[#073f36] sm:text-3xl">
              {isGIE360 ? "Diagnóstico inicial GIE360°" : "Diagnóstico inicial"}
            </h1>
            <div className="mt-3 h-0.5 w-14 bg-[#c99439]" />
            <p className="mt-4 text-sm leading-6 text-[#4f625d]">
              {isGIE360 ? "Este diagnóstico empresarial ajuda a identificar as necessidades específicas da sua empresa e a preparar uma avaliação GIE360° adequada ao contexto declarado." : "Antes de recomendarmos uma solução, queremos compreender o essencial sobre o que procura,"}
              o contexto em que se encontra e o resultado que pretende alcançar. As suas respostas
              permitem-nos preparar um diagnóstico mais focado e tornar a próxima conversa mais
              objectiva e útil.
            </p>
          <div className="mt-4 grid gap-3 rounded-xl bg-[#f5f1e6] p-4 text-sm sm:grid-cols-2">
            <div>
              <p className="font-semibold text-[#073f36]">Objectivo</p>
              <p className="mt-1 text-[#5f6c68]">
                Recolher apenas a informação fundamental para iniciar o diagnóstico.
              </p>
            </div>
            <div>
              <p className="font-semibold text-[#073f36]">Validade</p>
              <p className="mt-1 text-[#5f6c68]">
                Este link é válido por 7 dias, até {new Date(expiresAt).toLocaleDateString("pt-PT")}.
                Se necessário, pode ser emitida uma nova solicitação.
              </p>
            </div>
          </div>
          {clientOrganization && (
            <p className="mt-4 text-sm font-semibold text-[#142825]">{clientOrganization}</p>
          )}
          {clientName && <p className="mt-1 text-sm text-[#667085]">Contacto: {clientName}</p>}
            {publicContext && (
              <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[#667085]">{publicContext}</p>
            )}
          </div>
        </header>

        <form action={submitClientDiagnostic} className="space-y-5">
          <input type="hidden" name="token" value={token} />

          <Block number={1} title="Fale-nos um pouco sobre si">
            <ChoiceGrid
              name="respondent_type"
              type="radio"
              value={respondentType}
              onChange={setRespondentType}
              options={[
                ["individual", "Pessoa individual"],
                ["organization", "Empresa / organização"],
                ["independent", "Empreendedor / profissional independente"],
                ["investor", "Investidor"],
                ["institution", "Associação / ONG / instituição"],
              ]}
            />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Nome" name="respondent_name" required />
              <Field label="Email (opcional)" name="respondent_email" type="email" />
              {["organization", "institution"].includes(respondentType) && (
                <>
                  <Field label="Organização" name="organization" />
                  <Field label="Função / cargo" name="respondent_role" />
                </>
              )}
              {respondentType === "independent" && (
                <Field label="Actividade / função" name="respondent_role" />
              )}
            </div>
          </Block>

          <Block number={2} title="O que o trouxe até nós?">
            <ChoiceGrid
              name="request_nature"
              type="radio"
              value={nature}
              onChange={(value) => setNature(value as Nature)}
              options={natureOptions.map((item) => [item.value, item.label])}
            />
          </Block>

          {nature && (
            <>
              <AdaptiveContext nature={nature} />
              <AdaptiveFocus nature={nature} />
            </>
          )}

          <Block number={5} title="Que resultado gostaria de alcançar?">
            <Multi
              name="desired_result"
              options={[
                "Resolver o problema de forma prática",
                "Aumentar vendas / rendimento",
                "Reduzir custos",
                "Poupar tempo / aumentar eficiência",
                "Melhorar qualidade ou experiência do cliente",
                "Criar ou lançar algo novo",
                "Ganhar maior controlo / informação",
                "Fazer crescer ou escalar",
                "Encontrar uma oportunidade de negócio",
                "Tomar uma decisão de investimento mais segura",
              ]}
              details="Resultado prioritário ou detalhe adicional"
            />
          </Block>

          <Block number={6} title="O que devemos considerar desde o início?">
            <Multi
              name="conditions"
              options={[
                "Existe orçamento / capital definido",
                "O orçamento ainda precisa de ser definido",
                "Existem recursos ou equipa disponíveis",
                "Existem sistemas / tecnologia a manter",
                "Existem requisitos legais ou regulatórios",
                "Existem requisitos de segurança / confidencialidade",
                "É necessária aprovação de outras pessoas",
                "Pretendo começar pequeno e validar antes de escalar",
                "Preciso de apoio para definir estes pontos",
                "Ainda não existem limitações definidas",
              ]}
              details="Orçamento, recursos, condição ou restrição específica"
            />
          </Block>

          <Block number={7} title="Qual é a prioridade neste momento?">
            <ChoiceGrid
              name="deadline_urgency"
              type="radio"
              options={[
                ["immediate", "Preciso de avançar imediatamente"],
                ["weeks", "Gostaria de avançar nas próximas semanas"],
                ["evaluate", "Quero avaliar primeiro e depois decidir"],
                ["exploring", "Estou a explorar possibilidades"],
                ["undefined", "Ainda não tenho prazo definido"],
              ]}
            />
            <input
              className={fieldClass}
              name="deadline_urgency_details"
              placeholder="Se existir uma data importante, indique-a aqui."
            />
          </Block>

          <Block number={8} title="O que tornaria esta iniciativa valiosa para si?">
            <Multi
              name="success_criteria"
              options={[
                "Resultado financeiro positivo",
                "Uma solução prática e utilizável",
                "Uma decisão mais segura e bem fundamentada",
                "Menor custo ou maior eficiência",
                "Mais vendas / clientes / rendimento",
                "Melhor experiência do cliente",
                "Maior capacidade de crescimento",
                "Maior controlo / visibilidade",
                "Um negócio ou oportunidade viável para avançar",
                "Um plano claro para os próximos passos",
              ]}
              details="Meta, indicador ou resultado específico"
            />
          </Block>

          <div className="flex justify-end pt-1">
            <button className={primaryButtonClass} type="submit">
              Enviar respostas
            </button>
          </div>
        </form>

        <footer className="mt-6 border-t border-[#e0e8e3] py-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#073f36]">
            PCC — Avalie. Decida. Execute.
          </p>
          <p className="mt-1 text-xs text-[#667085]">Da Estratégia à Execução</p>
        </footer>
      </div>
    </main>
  );
}

function AdaptiveContext({ nature }: { nature: Nature }) {
  if (nature === "investment_discovery") {
    return (
      <Block number={3} title="O que procura obter com este investimento?">
        <Multi
          name="context"
          options={[
            "Criar uma nova fonte de rendimento",
            "Construir um negócio próprio",
            "Investir capital disponível",
            "Diversificar investimentos",
            "Criar rendimento recorrente",
            "Encontrar um negócio com potencial de crescimento",
            "Participar activamente num negócio",
            "Preferir menor envolvimento operacional",
            "Ainda estou a explorar possibilidades",
          ]}
          details="Capital disponível, experiência, preferência ou outro detalhe relevante"
        />
      </Block>
    );
  }

  const copy: Record<Exclude<Nature, "investment_discovery">, [string, string]> = {
    problem: ["O que está a acontecer actualmente?", "Explique em poucas linhas o problema ou situação."],
    improve_existing: ["O que já existe e o que gostaria de melhorar?", "Descreva brevemente a situação actual e a melhoria pretendida."],
    idea: ["Qual é a ideia?", "Descreva a ideia em poucas palavras."],
    active_project: ["Em que ponto está o projecto?", "Indique o que já existe e onde precisa de apoio."],
    organization_solution: ["Qual é a principal necessidade?", "Explique de forma breve o que a organização precisa de resolver."],
    commercial_growth: ["Onde está hoje o principal desafio comercial?", "Ex.: vendas, clientes, canais, proposta, conversão ou crescimento."],
    investment_existing: ["Qual é a oportunidade que pretende avaliar?", "Descreva a oportunidade em poucas palavras."],
    explore: ["O que gostaria de perceber ou decidir?", "Explique brevemente o que está a explorar."],
  };
  const [title, placeholder] = copy[nature];

  return (
    <Block number={3} title={title}>
      <textarea className={fieldClass + " min-h-24"} name="context" required placeholder={placeholder} />
    </Block>
  );
}

function AdaptiveFocus({ nature }: { nature: Nature }) {
  if (nature === "investment_discovery") {
    return (
      <Block number={4} title="Que tipo de oportunidades está disposto a considerar?">
        <Multi
          name="focus"
          options={[
            "Sem preferência — quero ver oportunidades",
            "Comércio / distribuição / e-commerce",
            "Serviços profissionais / B2B",
            "Tecnologia / digital",
            "Agricultura / alimentação",
            "Imobiliário / construção",
            "Turismo / hotelaria",
            "Transportes / logística",
            "Saúde / bem-estar",
            "Educação / formação",
            "Beleza / cuidados pessoais",
            "Serviços financeiros / seguros",
          ]}
          details="Sector, geografia ou tipo de negócio que gostaria de privilegiar ou evitar"
        />
      </Block>
    );
  }

  if (nature === "investment_existing") {
    return (
      <Block number={4} title="O que é mais importante avaliar nesta oportunidade?">
        <Multi
          name="focus"
          options={[
            "Potencial de mercado",
            "Modelo de negócio",
            "Investimento necessário",
            "Retorno esperado",
            "Riscos principais",
            "Capacidade de execução",
            "Concorrência / diferenciação",
            "Prazo para validar",
          ]}
          details="Outro ponto que deve pesar na decisão"
        />
      </Block>
    );
  }

  if (nature === "explore") {
    return (
      <Block number={4} title="O que é mais importante perceber primeiro?">
        <Multi
          name="focus"
          options={[
            "Que opções existem",
            "Qual opção tem maior potencial",
            "Custos / investimento necessário",
            "Riscos",
            "Tempo para implementar",
            "Recursos necessários",
            "Impacto esperado",
            "Próximos passos",
          ]}
          details="Outro critério importante para a exploração"
        />
      </Block>
    );
  }

  return (
    <Block number={4} title="Qual é o principal impacto ou desafio hoje?">
      <Multi
        name="focus"
        options={[
          "Perda de tempo / atrasos",
          "Custos elevados",
          "Perda de vendas / oportunidades",
          "Erros / retrabalho",
          "Insatisfação de clientes",
          "Falta de controlo / informação",
          "Baixa produtividade / capacidade",
          "Dificuldade em crescer / escalar",
          "Risco operacional / reputacional",
          "Oportunidade ainda não aproveitada",
        ]}
        details="Impacto mais importante ou outro detalhe"
      />
    </Block>
  );
}

function Block({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#dce5df] bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#d9c38f] bg-[#f8f6f0] text-sm font-semibold leading-none text-[#073f36]"
          aria-hidden="true"
        >
          {number}
        </span>
        <h2 className="min-w-0 text-sm font-semibold leading-5 text-[#073f36] sm:text-[15px]">
          {title}
        </h2>
      </div>
      <div>{children}</div>
    </section>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-medium text-[#142825]">
      {label}
      <input className={fieldClass} name={name} type={type} required={required} />
    </label>
  );
}

function ChoiceGrid({
  name,
  options,
  type,
  value,
  onChange,
}: {
  name: string;
  options: Array<[string, string]>;
  type: "radio";
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map(([optionValue, label]) => (
        <label
          key={optionValue}
          className="flex cursor-pointer items-start gap-2 rounded-xl border border-[#dce5df] bg-[#fbfcfa] px-3 py-3 text-sm transition hover:border-[#a8beb6]"
        >
          <input
            className="mt-0.5 h-4 w-4 accent-[#073f36]"
            type={type}
            name={name}
            value={optionValue}
            checked={value !== undefined ? value === optionValue : undefined}
            onChange={() => onChange?.(optionValue)}
            required={name === "request_nature" || name === "respondent_type"}
          />
          <span>{label}</span>
        </label>
      ))}
    </div>
  );
}

function Multi({ name, options, details }: { name: string; options: string[]; details: string }) {
  return (
    <>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option}
            className="flex cursor-pointer items-start gap-2 rounded-xl border border-[#dce5df] bg-[#fbfcfa] px-3 py-3 text-sm transition hover:border-[#a8beb6]"
          >
            <input className="mt-0.5 h-4 w-4 accent-[#073f36]" type="checkbox" name={name} value={option} />
            <span>{option}</span>
          </label>
        ))}
      </div>
      <textarea
        className={fieldClass + " min-h-20"}
        name={name}
        placeholder={details}
        aria-label={`${details} — detalhes adicionais`}
      />
    </>
  );
}
