import { createHash } from "node:crypto";
import { submitClientDiagnostic } from "@/app/client-diagnostic/[token]/actions";
import { primaryButtonClass } from "@/components/ui";
import { createPublicClient } from "@/lib/supabase/public";

function hashToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = {
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nocache: true,
  },
};

const fieldClass =
  "mt-1 w-full rounded-xl border border-[#dce5df] bg-white px-3 py-2.5 text-sm text-[#142825] outline-none focus:border-[#146453]";

export default async function ClientDiagnosticPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ submitted?: string; error?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;

  if (!/^[A-Za-z0-9_-]{43,200}$/.test(token)) {
    return <PublicMessage title="Questionário indisponível" body="O link não é válido ou deixou de estar disponível." />;
  }

  const supabase = createPublicClient();

  const { data, error } = await supabase.rpc("client_diagnostic_lookup", {
    p_token_hash: hashToken(token),
  });

  const request = Array.isArray(data) ? data[0] : null;

  if (error || !request) {
    return <PublicMessage title="Questionário indisponível" body="O link não é válido ou deixou de estar disponível." />;
  }

  if (query.submitted || ["submitted", "reviewed", "incorporated", "clarification_needed"].includes(request.status)) {
    return (
      <PublicMessage
        title="Resposta recebida"
        body="Obrigado. As suas respostas foram enviadas para a equipa responsável pelo diagnóstico."
      />
    );
  }

  if (request.status === "expired") {
    return (
      <PublicMessage
        title="Link expirado"
        body="Este questionário expirou. Contacte a pessoa que lhe enviou o link para receber um novo."
      />
    );
  }

  return (
    <main className="min-h-screen bg-[#f8f6f0] px-4 py-8 text-[#142825] sm:py-12">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 rounded-2xl border border-[#dce5df] bg-white p-5 shadow-sm sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c99439]">PCC</p>
          <h1 className="mt-2 text-2xl font-semibold text-[#073f36] sm:text-3xl">
            Questionário de Diagnóstico
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#667085]">
            Um questionário breve para recolher a informação essencial antes de iniciar o diagnóstico.
          </p>
          {request.client_organization && (
            <p className="mt-3 text-sm font-semibold text-[#142825]">{request.client_organization}</p>
          )}
          {request.client_name && (
            <p className="mt-1 text-sm text-[#667085]">Contacto: {request.client_name}</p>
          )}
          {request.public_context && (
            <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[#667085]">{request.public_context}</p>
          )}
        </header>

        {query.error && (
          <div className="mb-5 rounded-xl border border-[#e3caca] bg-white p-4 text-sm text-[#7b3131]">
            {query.error}
          </div>
        )}

        <form action={submitClientDiagnostic} className="space-y-5 rounded-2xl border border-[#dce5df] bg-white p-5 shadow-sm sm:p-7">
          <input type="hidden" name="token" value={token} />

          <QuestionBlock number={1} title="Quem está a responder?">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome" name="respondent_name" required />
              <Field label="Função / cargo" name="respondent_role" />
              <Field label="Organização" name="organization" />
              <Field label="Email" name="respondent_email" type="email" />
            </div>
          </QuestionBlock>

          <QuestionBlock number={2} title="Qual é o principal problema, necessidade ou oportunidade?">
            <Area name="problem_need" required placeholder="Explique em poucas linhas o que motivou este pedido." />
          </QuestionBlock>

          <QuestionBlock number={3} title="Como esta situação funciona hoje?">
            <Area name="current_situation" required placeholder="Descreva de forma simples o processo ou situação actual." />
          </QuestionBlock>

          <MultiQuestion
            number={4}
            title="Que impacto esta situação tem hoje?"
            name="impact"
            options={[
              "Perda de tempo / atrasos",
              "Custos elevados",
              "Perda de vendas / receita",
              "Erros ou retrabalho",
              "Insatisfação de clientes",
              "Falta de controlo / visibilidade",
              "Risco operacional ou reputacional",
              "Limita crescimento / capacidade",
            ]}
            detailsPlaceholder="Se necessário, explique o impacto mais importante."
            required
          />

          <MultiQuestion
            number={5}
            title="Que resultado pretende alcançar?"
            name="desired_result"
            options={[
              "Aumentar vendas / receita",
              "Reduzir custos",
              "Poupar tempo",
              "Melhorar qualidade / reduzir erros",
              "Melhorar experiência do cliente",
              "Ganhar controlo / informação",
              "Lançar ou melhorar um produto / serviço",
              "Aumentar capacidade / escalar",
            ]}
            detailsPlaceholder="Acrescente o resultado específico que considera mais importante."
            required
          />

          <MultiQuestion
            number={6}
            title="Quem é afectado, beneficiado ou utilizará a solução?"
            name="affected_people"
            options={[
              "Clientes",
              "Equipa comercial",
              "Operações",
              "Gestão / direcção",
              "Finanças / administração",
              "Fornecedores / parceiros",
              "Colaboradores em geral",
              "Utilizadores externos",
            ]}
            detailsPlaceholder="Indique outro grupo ou detalhe relevante."
          />

          <SingleQuestion
            number={7}
            title="Qual é a prioridade ou prazo?"
            name="deadline_urgency"
            options={[
              "Urgente — precisa de acção imediata",
              "Até 30 dias",
              "1 a 3 meses",
              "3 a 6 meses",
              "Sem prazo definido",
            ]}
            detailsPlaceholder="Se existir uma data concreta, indique aqui."
          />

          <SingleQuestion
            number={8}
            title="Existe orçamento ou investimento disponível?"
            name="budget_range"
            options={[
              "Sim — orçamento já definido",
              "Existe um intervalo aproximado",
              "Depende da solução proposta",
              "Ainda não foi definido",
              "Prefiro discutir numa fase seguinte",
            ]}
            detailsPlaceholder="Se quiser, indique o valor ou intervalo."
          />

          <MultiQuestion
            number={9}
            title="Que condições ou restrições devem ser respeitadas?"
            name="constraints"
            options={[
              "Limite de orçamento",
              "Prazo obrigatório",
              "Tecnologia / sistema existente",
              "Segurança / confidencialidade",
              "Requisitos legais / regulatórios",
              "Equipa ou recursos limitados",
              "Aprovação de direcção / cliente",
              "Fornecedor / parceiro obrigatório",
            ]}
            detailsPlaceholder="Acrescente uma condição específica, se existir."
          />

          <MultiQuestion
            number={10}
            title="Como saberá que o projecto foi bem-sucedido?"
            name="success_criteria"
            options={[
              "Mais vendas / receita",
              "Menor custo",
              "Menor tempo de execução",
              "Menos erros / retrabalho",
              "Melhor satisfação do cliente",
              "Maior produtividade / capacidade",
              "Maior controlo / visibilidade",
              "Entrega concluída dentro do prazo",
            ]}
            detailsPlaceholder="Acrescente uma meta, indicador ou resultado específico."
            required
          />

          <button className={primaryButtonClass} type="submit">
            Enviar respostas
          </button>
        </form>
      </div>
    </main>
  );
}

function QuestionBlock({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="rounded-xl border border-[#dce5df] bg-[#fbfcfa] p-4 sm:p-5">
      <legend className="px-1 text-sm font-semibold text-[#073f36]">
        {number}. {title}
      </legend>
      <div className="mt-2">{children}</div>
    </fieldset>
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

function Area({
  name,
  required = false,
  placeholder,
}: {
  name: string;
  required?: boolean;
  placeholder: string;
}) {
  return (
    <textarea
      className={fieldClass + " min-h-24"}
      name={name}
      required={required}
      placeholder={placeholder}
    />
  );
}

function MultiQuestion({
  number,
  title,
  name,
  options,
  detailsPlaceholder,
  required = false,
}: {
  number: number;
  title: string;
  name: string;
  options: string[];
  detailsPlaceholder: string;
  required?: boolean;
}) {
  return (
    <QuestionBlock number={number} title={title}>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option}
            className="flex cursor-pointer items-start gap-2 rounded-lg border border-[#dce5df] bg-white px-3 py-2.5 text-sm"
          >
            <input className="mt-0.5 h-4 w-4 accent-[#073f36]" type="checkbox" name={name} value={option} />
            <span>{option}</span>
          </label>
        ))}
      </div>
      <textarea
        className={fieldClass + " min-h-20"}
        name={name}
        placeholder={detailsPlaceholder}
        aria-label={`${title} — detalhes adicionais`}
      />
      {required && (
        <p className="mt-2 text-xs text-[#667085]">
          Seleccione pelo menos uma opção ou escreva um detalhe.
        </p>
      )}
    </QuestionBlock>
  );
}

function SingleQuestion({
  number,
  title,
  name,
  options,
  detailsPlaceholder,
}: {
  number: number;
  title: string;
  name: string;
  options: string[];
  detailsPlaceholder: string;
}) {
  return (
    <QuestionBlock number={number} title={title}>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option}
            className="flex cursor-pointer items-start gap-2 rounded-lg border border-[#dce5df] bg-white px-3 py-2.5 text-sm"
          >
            <input className="mt-0.5 h-4 w-4 accent-[#073f36]" type="radio" name={name} value={option} />
            <span>{option}</span>
          </label>
        ))}
      </div>
      <input className={fieldClass} name={`${name}_details`} placeholder={detailsPlaceholder} />
    </QuestionBlock>
  );
}

function PublicMessage({ title, body }: { title: string; body: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f8f6f0] px-4">
      <div className="w-full max-w-lg rounded-2xl border border-[#dce5df] bg-white p-7 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c99439]">PCC</p>
        <h1 className="mt-2 text-2xl font-semibold text-[#073f36]">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-[#667085]">{body}</p>
      </div>
    </main>
  );
}
