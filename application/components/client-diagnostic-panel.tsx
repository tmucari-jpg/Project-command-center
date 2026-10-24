import {
  incorporateClientDiagnosticResponse,
  importClientDiagnosticLink,
  reviewClientDiagnosticResponse,
  revokeClientDiagnosticRequest,
  uploadClientDiagnosticFile,
} from "@/app/(protected)/mutations";
import { ClientDiagnosticLinkGenerator } from "@/components/client-diagnostic-link-generator";
import { Card, primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import {
  CLIENT_DIAGNOSTIC_ANSWER_LABELS,
  CLIENT_DIAGNOSTIC_REVIEW_LABELS,
  CLIENT_DIAGNOSTIC_STATUS_LABELS,
  diagnosticAnswerEntries,
  diagnosticMissingInformation,
  diagnosticPointsToConfirm,
} from "@/lib/client-diagnostic";

type RequestRow = {
  id: string;
  client_name: string | null;
  client_organization: string | null;
  public_context: string | null;
  status: string;
  expires_at: string;
  opened_at: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  incorporated_at: string | null;
};

type ResponseRow = {
  respondent_name: string;
  respondent_role: string | null;
  respondent_email: string | null;
  answers: unknown;
  submitted_at: string;
};

type ReviewRow = {
  review_status: string;
  review_notes: string | null;
  missing_information: string | null;
  points_to_confirm: string | null;
};

type ExternalSourceRow = {
  id: string;
  source_type: "file" | "link";
  source_url: string | null;
  file_name: string | null;
  note: string | null;
  created_at: string;
  signed_url?: string | null;
};

export function ClientDiagnosticPanel({
  factoryCaseId,
  request,
  response,
  review,
  externalSources = [],
}: {
  factoryCaseId: string;
  request: RequestRow | null;
  response: ResponseRow | null;
  review: ReviewRow | null;
  externalSources?: ExternalSourceRow[];
}) {
  const entries = diagnosticAnswerEntries(response?.answers);
  const missing = diagnosticMissingInformation(response?.answers);
  const confirm = diagnosticPointsToConfirm(response?.answers);
  const canRevoke = request && ["active", "opened"].includes(request.status);
  const canReview = request && response && ["submitted", "reviewed", "clarification_needed"].includes(request.status);
  const canIncorporate =
    request &&
    response &&
    review &&
    ["accepted", "partially_accepted"].includes(review.review_status) &&
    request.status !== "incorporated";

  return (
    <Card className="mt-6 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--cc-secondary)]">
            Diagnóstico do Cliente
          </p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--cc-foreground)]">
            Informação declarada pelo cliente
          </h2>
        </div>
        {request && (
          <span className="rounded-full bg-[var(--cc-surface-muted)] px-3 py-1.5 text-xs font-semibold text-[var(--cc-foreground)]">
            {CLIENT_DIAGNOSTIC_STATUS_LABELS[request.status] ?? request.status}
          </span>
        )}
      </div>

      {!request ? (
        <div className="mt-5">
          <ClientDiagnosticLinkGenerator factoryCaseId={factoryCaseId} />
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            {request.client_organization && <Meta label="Organização" value={request.client_organization} />}
            {request.client_name && <Meta label="Contacto" value={request.client_name} />}
            <Meta label="Validade" value={new Date(request.expires_at).toLocaleDateString("pt-PT")} />
            {request.opened_at && <Meta label="Aberto em" value={new Date(request.opened_at).toLocaleString("pt-PT")} />}
          </div>

          {canRevoke && (
            <form action={revokeClientDiagnosticRequest}>
              <input type="hidden" name="request_id" value={request.id} />
              <input type="hidden" name="factory_case_id" value={factoryCaseId} />
              <button className={secondaryButtonClass} type="submit">Revogar link</button>
            </form>
          )}

          {response ? (
            <>
              <div className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface-muted)] p-4">
                <p className="text-sm font-semibold text-[var(--cc-foreground)]">
                  {response.respondent_name}
                  {response.respondent_role ? ` · ${response.respondent_role}` : ""}
                </p>
                {response.respondent_email && (
                  <p className="mt-1 text-xs text-[var(--cc-secondary)]">{response.respondent_email}</p>
                )}
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {entries.map(([key, value]) => (
                    <div key={key}>
                      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--cc-secondary)]">
                        {CLIENT_DIAGNOSTIC_ANSWER_LABELS[key] ?? key}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[var(--cc-foreground)]">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <SummaryBox
                  title="Informação ainda em falta"
                  items={missing}
                  empty="Nenhuma lacuna obrigatória detectada."
                />
                <SummaryBox
                  title="Pontos a confirmar"
                  items={confirm}
                  empty="Nenhum ponto marcado como indefinido."
                />
              </div>

              {canReview && (
                <form action={reviewClientDiagnosticResponse} className="space-y-4 rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-4">
                  <input type="hidden" name="request_id" value={request.id} />
                  <input type="hidden" name="factory_case_id" value={factoryCaseId} />

                  <label className="block text-sm font-medium text-[var(--cc-foreground)]">
                    Revisão interna
                    <select
                      className="mt-1 w-full rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface-strong)] px-3 py-2.5 text-sm"
                      name="review_status"
                      defaultValue={review?.review_status ?? "accepted"}
                    >
                      <option value="accepted">Aceitar informação</option>
                      <option value="partially_accepted">Aceitar parcialmente</option>
                      <option value="clarification_needed">Pedir esclarecimento</option>
                    </select>
                  </label>

                  <label className="block text-sm font-medium text-[var(--cc-foreground)]">
                    Notas da revisão
                    <textarea
                      className="mt-1 min-h-20 w-full rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface-strong)] px-3 py-2.5 text-sm"
                      name="review_notes"
                      defaultValue={review?.review_notes ?? ""}
                    />
                  </label>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block text-sm font-medium text-[var(--cc-foreground)]">
                      Informação em falta
                      <textarea
                        className="mt-1 min-h-20 w-full rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface-strong)] px-3 py-2.5 text-sm"
                        name="missing_information"
                        defaultValue={review?.missing_information ?? missing.join("\n")}
                      />
                    </label>
                    <label className="block text-sm font-medium text-[var(--cc-foreground)]">
                      Pontos a confirmar
                      <textarea
                        className="mt-1 min-h-20 w-full rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface-strong)] px-3 py-2.5 text-sm"
                        name="points_to_confirm"
                        defaultValue={review?.points_to_confirm ?? confirm.join("\n")}
                      />
                    </label>
                  </div>

                  <button className={primaryButtonClass} type="submit">Guardar revisão</button>
                </form>
              )}

              {review && (
                <div className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface-muted)] p-4 text-sm">
                  <span className="font-semibold text-[var(--cc-foreground)]">
                    {CLIENT_DIAGNOSTIC_REVIEW_LABELS[review.review_status] ?? review.review_status}
                  </span>
                  {review.review_notes && (
                    <p className="mt-2 whitespace-pre-wrap text-[var(--cc-secondary)]">{review.review_notes}</p>
                  )}
                </div>
              )}

              {canIncorporate && (
                <form action={incorporateClientDiagnosticResponse}>
                  <input type="hidden" name="request_id" value={request.id} />
                  <input type="hidden" name="factory_case_id" value={factoryCaseId} />
                  <button className={primaryButtonClass} type="submit">Incorporar no diagnóstico</button>
                </form>
              )}

              {review?.review_status === "clarification_needed" && (
                <div className="border-t border-[var(--cc-border)] pt-5">
                  <ClientDiagnosticLinkGenerator
                    factoryCaseId={factoryCaseId}
                    defaultClientName={request.client_name ?? ""}
                    defaultOrganization={request.client_organization ?? ""}
                    defaultContext={review.review_notes ?? "Precisamos de alguns esclarecimentos adicionais para concluir o diagnóstico."}
                  />
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-[var(--cc-secondary)]">
              O questionário ainda não foi respondido.
            </p>
          )}

          <div className="border-t border-[var(--cc-border)] pt-5">
            <h3 className="text-base font-semibold text-[var(--cc-foreground)]">
              Nova solicitação
            </h3>
            <p className="mt-1 text-sm text-[var(--cc-secondary)]">
              Pode emitir um novo questionário de 7 dias. Se existir um link anterior ainda activo, será revogado.
            </p>
            <div className="mt-4">
              <ClientDiagnosticLinkGenerator
                factoryCaseId={factoryCaseId}
                defaultClientName={request.client_name ?? ""}
                defaultOrganization={request.client_organization ?? ""}
                defaultContext={request.public_context ?? ""}
                buttonLabel="Gerar nova solicitação"
              />
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 border-t border-[var(--cc-border)] pt-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--cc-secondary)]">
            Resposta recebida por outro canal
          </p>
          <h3 className="mt-1 text-lg font-semibold text-[var(--cc-foreground)]">
            Importar questionário
          </h3>
          <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
            Se o cliente respondeu fora do link PCC, anexe o ficheiro recebido ou registe o link da resposta.
            A fonte fica associada ao caso para revisão e rastreabilidade.
          </p>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <form
            action={uploadClientDiagnosticFile}
            className="space-y-3 rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-4"
          >
            <input type="hidden" name="factory_case_id" value={factoryCaseId} />
            {request && <input type="hidden" name="request_id" value={request.id} />}
            <label className="block text-sm font-medium text-[var(--cc-foreground)]">
              Anexar questionário respondido
              <input
                className="mt-2 block w-full text-sm text-[var(--cc-secondary)]"
                type="file"
                name="questionnaire_file"
                accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                required
              />
            </label>
            <label className="block text-sm font-medium text-[var(--cc-foreground)]">
              Nota
              <input
                className="mt-1 w-full rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface-strong)] px-3 py-2.5 text-sm"
                name="note"
                placeholder="Ex.: Recebido por email."
              />
            </label>
            <button className={secondaryButtonClass} type="submit">Guardar ficheiro</button>
          </form>

          <form
            action={importClientDiagnosticLink}
            className="space-y-3 rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-4"
          >
            <input type="hidden" name="factory_case_id" value={factoryCaseId} />
            {request && <input type="hidden" name="request_id" value={request.id} />}
            <label className="block text-sm font-medium text-[var(--cc-foreground)]">
              Colar link da resposta
              <input
                className="mt-1 w-full rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface-strong)] px-3 py-2.5 text-sm"
                name="source_url"
                type="url"
                placeholder="https://..."
                required
              />
            </label>
            <label className="block text-sm font-medium text-[var(--cc-foreground)]">
              Nota
              <input
                className="mt-1 w-full rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface-strong)] px-3 py-2.5 text-sm"
                name="note"
                placeholder="Ex.: Formulário preenchido pelo cliente."
              />
            </label>
            <button className={secondaryButtonClass} type="submit">Guardar link</button>
          </form>
        </div>

        {externalSources.length > 0 && (
          <div className="mt-5">
            <p className="text-sm font-semibold text-[var(--cc-foreground)]">Fontes externas registadas</p>
            <div className="mt-2 space-y-2">
              {externalSources.map((source) => {
                const href = source.source_type === "link" ? source.source_url : source.signed_url;
                return (
                  <div
                    key={source.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface-muted)] p-3 text-sm"
                  >
                    <div>
                      <p className="font-semibold text-[var(--cc-foreground)]">
                        {source.source_type === "file" ? source.file_name ?? "Ficheiro" : "Link externo"}
                      </p>
                      <p className="mt-1 text-xs text-[var(--cc-secondary)]">
                        {new Date(source.created_at).toLocaleString("pt-PT")}
                        {source.note ? ` · ${source.note}` : ""}
                      </p>
                    </div>
                    {href && (
                      <a
                        className={secondaryButtonClass}
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Abrir
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-[var(--cc-secondary)]">{label}</p>
      <p className="mt-1 text-[var(--cc-foreground)]">{value}</p>
    </div>
  );
}

function SummaryBox({
  title,
  items,
  empty,
}: {
  title: string;
  items: string[];
  empty: string;
}) {
  return (
    <div className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-4">
      <p className="text-sm font-semibold text-[var(--cc-foreground)]">{title}</p>
      {items.length ? (
        <ul className="mt-2 space-y-1 text-sm text-[var(--cc-secondary)]">
          {items.map((item) => <li key={item}>• {item}</li>)}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-[var(--cc-secondary)]">{empty}</p>
      )}
    </div>
  );
}
