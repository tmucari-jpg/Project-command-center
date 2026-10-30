import { createHash } from "node:crypto";
import { ClientDiagnosticQuestionnaire } from "@/components/client-diagnostic-questionnaire";
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

  // A expiração prevalece sobre qualquer estado de resposta ou parâmetro de URL.
  // Este controlo protege a interface; a RPC continua a requerer validação server-side.
  const expiresAt = Date.parse(request.expires_at);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() || request.status === "expired" || request.status === "revoked") {
    return (
      <PublicMessage
        title="Link expirado ou indisponível"
        body="Este questionário já não está disponível. Contacte a equipa responsável para receber uma nova solicitação."
      />
    );
  }

  if (query.submitted || ["submitted", "analyzing", "reviewed", "incorporated", "clarification_needed"].includes(request.status)) {
    return (
      <PublicMessage
        title="Resposta recebida"
        body="Obrigado. A sua resposta foi recebida e será utilizada para preparar o diagnóstico e os próximos passos."
      />
    );
  }

  if (request.status === "expired") {
    return (
      <PublicMessage
        title="Link expirado"
        body="Este questionário tinha validade de 7 dias. Contacte a equipa responsável para receber uma nova solicitação."
      />
    );
  }

  return (
    <>
      {query.error && (
        <div className="fixed left-1/2 top-4 z-50 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 rounded-xl border border-[#e3caca] bg-white p-4 text-sm text-[#7b3131] shadow-lg">
          {query.error}
        </div>
      )}
      <ClientDiagnosticQuestionnaire
        token={token}
        clientName={request.client_name}
        clientOrganization={request.client_organization}
        publicContext={request.public_context}
        expiresAt={request.expires_at}
      />
    </>
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
