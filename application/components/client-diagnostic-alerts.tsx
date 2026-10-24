import { openClientDiagnosticNotification } from "@/app/(protected)/mutations";
import { Card, primaryButtonClass } from "@/components/ui";

export type ClientDiagnosticAlertRow = {
  id: string;
  title: string;
  message: string | null;
  related_entity_id: string | null;
  created_at: string;
};

export function ClientDiagnosticAlerts({
  alerts,
}: {
  alerts: ClientDiagnosticAlertRow[];
}) {
  const validAlerts = alerts.filter((alert) => Boolean(alert.related_entity_id));
  if (!validAlerts.length) return null;

  return (
    <Card className="mb-6 border-[#d9c38f] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[var(--cc-foreground)]">
          Novas respostas de diagnóstico
        </h2>
        <span className="rounded-full bg-[#f8f6f0] px-2.5 py-1 text-xs font-semibold text-[#8b6a25]">
          {validAlerts.length}
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {validAlerts.map((alert) => (
          <div
            key={alert.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-muted)] p-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--cc-foreground)]">{alert.title}</p>
              {alert.message && (
                <p className="mt-1 text-sm text-[var(--cc-secondary)]">{alert.message}</p>
              )}
              <p className="mt-1 text-xs text-[var(--cc-secondary)]">
                {new Date(alert.created_at).toLocaleString("pt-PT")}
              </p>
            </div>

            <form action={openClientDiagnosticNotification}>
              <input type="hidden" name="notification_id" value={alert.id} />
              <input type="hidden" name="factory_case_id" value={alert.related_entity_id ?? ""} />
              <button className={primaryButtonClass} type="submit">
                Abrir resposta
              </button>
            </form>
          </div>
        ))}
      </div>
    </Card>
  );
}
