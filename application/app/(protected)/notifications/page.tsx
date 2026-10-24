import Link from "next/link";
import { markAllNotificationsRead, openNotification } from "@/app/(protected)/mutations";
import { PageHeader } from "@/components/page-header";
import { Card, primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";

const TYPE_LABELS: Record<string, string> = {
  client_diagnostic_response: "Diagnóstico",
  project_update: "Projecto",
  approval_required: "Aprovação",
  blocker: "Bloqueio",
  deliverable: "Entregável",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Baixa",
  medium: "Normal",
  high: "Alta",
  critical: "Crítica",
};

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const params = await searchParams;
  const unreadOnly = params.view !== "all";
  const { supabase, user } = await requireUser();

  let query = supabase
    .from("notifications")
    .select("id,type,title,message,priority,read_at,related_entity_type,related_entity_id,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (unreadOnly) query = query.is("read_at", null);

  const [{ data: notifications }, unreadResult] = await Promise.all([
    query,
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null),
  ]);

  const rows = notifications ?? [];
  const unreadCount = unreadResult.count ?? 0;

  return (
    <>
      <PageHeader eyebrow="PCC" title="Centro de Notificações" />

      <div className="max-w-5xl">
        <Card className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <Link
                className={unreadOnly ? primaryButtonClass : secondaryButtonClass}
                href="/notifications"
              >
                Não lidas
              </Link>
              <Link
                className={!unreadOnly ? primaryButtonClass : secondaryButtonClass}
                href="/notifications?view=all"
              >
                Todas
              </Link>
            </div>

            {unreadCount > 0 && (
              <form action={markAllNotificationsRead}>
                <button className={secondaryButtonClass} type="submit">
                  Marcar todas como lidas
                </button>
              </form>
            )}
          </div>
        </Card>

        <div className="mt-4 space-y-3">
          {rows.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-sm font-semibold text-[var(--cc-foreground)]">
                {unreadOnly ? "Sem notificações por ler" : "Sem notificações"}
              </p>
            </Card>
          ) : (
            rows.map((item) => {
              const unread = !item.read_at;
              return (
                <Card
                  key={item.id}
                  className={`p-4 sm:p-5 ${unread ? "border-[#d9c38f]" : ""}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[var(--cc-surface-muted)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--cc-secondary)]">
                          {TYPE_LABELS[item.type] ?? item.type}
                        </span>
                        <span className="text-xs font-medium text-[var(--cc-secondary)]">
                          {PRIORITY_LABELS[item.priority] ?? item.priority}
                        </span>
                        {unread && (
                          <span className="h-2 w-2 rounded-full bg-[#c99439]" aria-label="Não lida" />
                        )}
                      </div>

                      <h2 className="mt-3 text-base font-semibold text-[var(--cc-foreground)]">
                        {item.title}
                      </h2>
                      {item.message && (
                        <p className="mt-1 text-sm leading-6 text-[var(--cc-secondary)]">
                          {item.message}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-[var(--cc-secondary)]">
                        {new Date(item.created_at).toLocaleString("pt-PT")}
                      </p>
                    </div>

                    {unread || item.related_entity_id ? (
                      <form action={openNotification}>
                        <input type="hidden" name="notification_id" value={item.id} />
                        <button className={secondaryButtonClass} type="submit">
                          {item.related_entity_id ? "Abrir" : "Marcar como lida"}
                        </button>
                      </form>
                    ) : null}
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
