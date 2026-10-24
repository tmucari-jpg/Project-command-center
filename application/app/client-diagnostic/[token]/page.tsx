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
          {request.client_organization && (
            <p className="mt-2 text-sm font-semibold text-[#142825]">{request.client_organization}</p>
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

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="1. Nome de quem responde" name="respondent_name" required />
            <Field label="2. Função / cargo" name="respondent_role" />
            <Field label="3. Email" name="respondent_email" type="email" />
            <Field label="4. Organização" name="organization" />
          </div>

          <Area
            label="5. Qual é o principal problema, necessidade ou oportunidade que motivou este pedido?"
            name="problem_need"
            required
          />
          <Area
            label="6. Como esta situação funciona hoje?"
            name="current_situation"
            required
          />
          <Area
            label="7. Qual é o impacto actual desta situação?"
            name="impact"
            required
          />
          <Area
            label="8. Que resultado pretende alcançar?"
            name="desired_result"
            required
          />
          <Area
            label="9. Quem será afectado, beneficiado ou utilizará a solução?"
            name="affected_people"
          />
          <Area
            label="10. O que já foi tentado até agora?"
            name="previous_attempts"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Area label="11. Existe prazo ou urgência?" name="deadline_urgency" compact />
            <Area label="12. Existe orçamento ou intervalo disponível?" name="budget_range" compact />
          </div>

          <Area
            label="13. Quem decide, aprova ou valida este projecto?"
            name="decision_process"
          />
          <Area
            label="14. Que informação, documentos, sistemas ou activos já estão disponíveis?"
            name="available_inputs"
          />
          <Area
            label="15. Existem restrições ou condições que devem ser respeitadas?"
            name="constraints"
          />
          <Area
            label="16. Como saberá que o projecto foi bem-sucedido?"
            name="success_criteria"
            required
          />
          <Area label="17. Há mais alguma informação importante?" name="additional_comments" />

          <button className={primaryButtonClass} type="submit">
            Enviar respostas
          </button>
        </form>
      </div>
    </main>
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
  label,
  name,
  required = false,
  compact = false,
}: {
  label: string;
  name: string;
  required?: boolean;
  compact?: boolean;
}) {
  return (
    <label className="block text-sm font-medium text-[#142825]">
      {label}
      <textarea
        className={fieldClass + (compact ? " min-h-24" : " min-h-28")}
        name={name}
        required={required}
        placeholder="Se ainda não estiver definido, pode escrever “a confirmar”."
      />
    </label>
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
