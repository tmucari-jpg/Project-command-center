import Image from "next/image";
import { hashProjectClientStatusToken } from "@/lib/project-client-status";
import { createPublicClient } from "@/lib/supabase/public";
import { submitProjectClientStatusDecision } from "./actions";

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

type DeliverableSnapshot = {
  id: string;
  title: string;
  status: string;
  due_date?: string | null;
  completion_criteria?: string | null;
  acceptance_status?: string | null;
  accepted_at?: string | null;
  artifact_version?: number | null;
  artifact_url?: string | null;
  artifact_reference?: string | null;
};

type MetricSnapshot = {
  name: string;
  unit?: string | null;
  current_value?: number | string | null;
  target_value?: number | string | null;
  measurement_date?: string | null;
};

export default async function ProjectStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ submitted?: string; error?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;

  if (!/^[A-Za-z0-9_-]{43,200}$/.test(token)) {
    return <PublicMessage title="Acompanhamento indisponível" body="O link não é válido ou deixou de estar disponível." />;
  }

  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("project_client_status_lookup", {
    p_token_hash: hashProjectClientStatusToken(token),
  });
  const snapshot = Array.isArray(data) ? data[0] : null;

  if (error || !snapshot) {
    return <PublicMessage title="Acompanhamento indisponível" body="O link não é válido ou deixou de estar disponível." />;
  }

  if (new Date(snapshot.expires_at).getTime() <= Date.now()) {
    return <PublicMessage title="Link expirado" body="Solicite à equipa responsável um novo link de acompanhamento." />;
  }

  const deliverables = Array.isArray(snapshot.deliverables)
    ? (snapshot.deliverables as DeliverableSnapshot[])
    : [];
  const kpis = Array.isArray(snapshot.kpis) ? (snapshot.kpis as MetricSnapshot[]) : [];

  if (query.submitted) {
    return (
      <PublicMessage
        title="Resposta registada"
        body="A sua decisão foi associada ao projecto e a equipa responsável foi notificada."
      />
    );
  }

  return (
    <main className="min-h-screen bg-[#f8f6f0] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-4xl space-y-5">
        <header className="rounded-2xl border border-[#dce5df] bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-center gap-3">
            <Image src="/brand/pcc-logo-transparent.svg" alt="PCC" width={48} height={48} priority />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c99439]">PCC · Status & Next Actions</p>
              <h1 className="mt-1 text-2xl font-semibold text-[#073f36]">{snapshot.project_title}</h1>
            </div>
          </div>
          {snapshot.public_note && <p className="mt-5 text-sm leading-6 text-[#667085]">{snapshot.public_note}</p>}
        </header>

        {query.error && (
          <div className="rounded-xl border border-[#e3caca] bg-white p-4 text-sm text-[#7b3131]">{query.error}</div>
        )}

        <section className="grid gap-4 md:grid-cols-3">
          <InfoCard label="Estado actual" value={humanize(snapshot.project_status)} />
          <InfoCard label="Resultado esperado" value={snapshot.expected_result || "Por definir"} />
          <InfoCard label="Próxima acção" value={snapshot.next_action || "A definir"} />
        </section>

        <section className="rounded-2xl border border-[#dce5df] bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-lg font-semibold text-[#073f36]">Entregáveis</h2>
          <div className="mt-4 space-y-3">
            {deliverables.length ? deliverables.map((item) => (
              <article key={item.id} className="rounded-xl border border-[#e5e7eb] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-[#073f36]">{item.title}</h3>
                    {item.completion_criteria && (
                      <p className="mt-2 text-sm leading-6 text-[#667085]">
                        Critério de aceitação: {item.completion_criteria}
                      </p>
                    )}
                  </div>
                  <span className="rounded-full bg-[#f3f5f4] px-2.5 py-1 text-xs font-semibold text-[#073f36]">
                    {humanize(item.acceptance_status && item.acceptance_status !== "pending" ? item.acceptance_status : item.status)}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#667085]">
                  {item.due_date && <span>Prazo: {formatDate(item.due_date)}</span>}
                  {item.artifact_version ? <span>Versão: v{item.artifact_version}</span> : null}
                  {item.accepted_at && <span>Validado: {formatDate(item.accepted_at)}</span>}
                </div>
                {item.artifact_url && (
                  <a
                    href={item.artifact_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex rounded-lg border border-[#dce5df] px-3 py-2 text-sm font-semibold text-[#073f36]"
                  >
                    Abrir entregável
                  </a>
                )}
              </article>
            )) : <p className="text-sm text-[#667085]">Ainda não existem entregáveis publicados.</p>}
          </div>
        </section>

        {kpis.length > 0 && (
          <section className="rounded-2xl border border-[#dce5df] bg-white p-5 shadow-sm sm:p-7">
            <h2 className="text-lg font-semibold text-[#073f36]">KPI / Resultado</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {kpis.map((metric) => (
                <div key={metric.name} className="rounded-xl bg-[#f7f8f7] p-4">
                  <p className="text-xs font-semibold text-[#667085]">{metric.name}</p>
                  <p className="mt-1 text-lg font-semibold text-[#073f36]">
                    {metric.current_value ?? "—"}{metric.unit ? ` ${metric.unit}` : ""}
                  </p>
                  {metric.target_value != null && (
                    <p className="mt-1 text-xs text-[#667085]">Meta: {metric.target_value}{metric.unit ? ` ${metric.unit}` : ""}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-[#dce5df] bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-lg font-semibold text-[#073f36]">Validação do cliente</h2>
          <form action={submitProjectClientStatusDecision} className="mt-4 space-y-4">
            <input type="hidden" name="token" value={token} />
            <label className="block text-sm font-medium text-[#073f36]">
              Nome
              <input
                className="mt-1 w-full rounded-xl border border-[#dce5df] px-3 py-2.5 text-sm"
                name="respondent_name"
                required
              />
            </label>
            <label className="block text-sm font-medium text-[#073f36]">
              Comentário, se necessário
              <textarea className="mt-1 min-h-24 w-full rounded-xl border border-[#dce5df] px-3 py-2.5 text-sm" name="comment" />
            </label>
            <div className="flex flex-wrap gap-2">
              <button className="rounded-xl bg-[#073f36] px-4 py-2.5 text-sm font-semibold text-white" name="decision" value="approve" type="submit">
                Aprovar próximos passos
              </button>
              <button className="rounded-xl border border-[#dce5df] bg-white px-4 py-2.5 text-sm font-semibold text-[#073f36]" name="decision" value="change" type="submit">
                Solicitar alteração
              </button>
              <button className="rounded-xl border border-[#dce5df] bg-white px-4 py-2.5 text-sm font-semibold text-[#073f36]" name="decision" value="clarification" type="submit">
                Pedir esclarecimento
              </button>
            </div>
          </form>
        </section>

        <p className="text-center text-xs text-[#84908b]">
          Publicado em {formatDate(snapshot.published_at)} · acesso válido até {formatDate(snapshot.expires_at)}
        </p>
      </div>
    </main>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#dce5df] bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#667085]">{label}</p>
      <p className="mt-2 text-sm font-semibold leading-6 text-[#073f36]">{value}</p>
    </div>
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

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "medium" }).format(new Date(value));
}
