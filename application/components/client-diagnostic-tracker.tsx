import Link from "next/link";
import { Card, secondaryButtonClass } from "@/components/ui";
import { CLIENT_DIAGNOSTIC_STATUS_LABELS } from "@/lib/client-diagnostic";

export type ClientDiagnosticTrackingRow = {
  factory_case_id: string;
  title: string;
  client_name: string | null;
  client_organization: string | null;
  status: string;
  expires_at: string;
  created_at: string;
  request_count: number;
};

function effectiveStatus(row: ClientDiagnosticTrackingRow) {
  if (
    ["active", "opened"].includes(row.status) &&
    new Date(row.expires_at).getTime() <= Date.now()
  ) {
    return "expired";
  }
  return row.status;
}

export function ClientDiagnosticTracker({
  rows,
}: {
  rows: ClientDiagnosticTrackingRow[];
}) {
  if (!rows.length) return null;

  return (
    <Card className="mb-6 p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--cc-secondary)]">
            Acompanhamento
          </p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--cc-foreground)]">
            Questionários de diagnóstico
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
            Projectos com solicitações enviadas, respostas pendentes ou informação recebida.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {rows.map((row) => {
          const status = effectiveStatus(row);
          return (
            <div
              key={row.factory_case_id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface-muted)] p-4"
            >
              <div className="min-w-0">
                <p className="font-semibold text-[var(--cc-foreground)]">{row.title}</p>
                <p className="mt-1 text-sm text-[var(--cc-secondary)]">
                  {row.client_organization || row.client_name || "Destinatário não identificado"}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--cc-secondary)]">
                  <span>{CLIENT_DIAGNOSTIC_STATUS_LABELS[status] ?? status}</span>
                  <span>Validade: {new Date(row.expires_at).toLocaleDateString("pt-PT")}</span>
                  <span>{row.request_count} solicitação{row.request_count === 1 ? "" : "ões"}</span>
                </div>
              </div>
              <Link className={secondaryButtonClass} href={`/project-factory/${row.factory_case_id}`}>
                Acompanhar
              </Link>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
