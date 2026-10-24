import { markNotificationRead } from "@/app/(protected)/mutations";
import { Card, secondaryButtonClass } from "@/components/ui";

export type CaseDiagnosticAlert = {
  id: string;
  title: string;
  message: string | null;
  created_at: string;
};

export function ClientDiagnosticCaseAlert({
  alert,
  factoryCaseId,
}: {
  alert: CaseDiagnosticAlert | null;
  factoryCaseId: string;
}) {
  if (!alert) return null;

  return (
    <Card className="mb-6 border-[#d9c38f] bg-[#fffdf7] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#c99439]" />
            <p className="text-sm font-semibold text-[var(--cc-foreground)]">
              {alert.title}
            </p>
          </div>
          {alert.message && (
            <p className="mt-1 text-sm text-[var(--cc-secondary)]">{alert.message}</p>
          )}
          <p className="mt-1 text-xs text-[var(--cc-secondary)]">
            {new Date(alert.created_at).toLocaleString("pt-PT")}
          </p>
        </div>

        <form action={markNotificationRead}>
          <input type="hidden" name="notification_id" value={alert.id} />
          <input type="hidden" name="return_path" value={`/project-factory/${factoryCaseId}`} />
          <button className={secondaryButtonClass} type="submit">
            Marcar como lida
          </button>
        </form>
      </div>
    </Card>
  );
}
