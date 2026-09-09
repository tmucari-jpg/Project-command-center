import { PageHeader } from "@/components/page-header";
import { Card, EmptyState } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

function relatedTitle(relation: { title: string } | { title: string }[] | null) {
  return Array.isArray(relation) ? relation[0]?.title : relation?.title;
}

export default async function ActivityPage() {
  const { supabase, user } = await requireUser();

  const [{ data: auditLogs }, { data: sessions }] = await Promise.all([
    supabase
      .from("audit_logs")
      .select("id,action,entity_type,entity_id,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("time_sessions")
      .select("id,started_at,ended_at,duration_seconds,actions(title)")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Auditoria"
        title="Actividade"
        description="Histórico de alterações e sessões de execução registadas pelo sistema."
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <div className="border-b border-slate-200 p-5">
            <h2 className="font-semibold text-slate-950">Alterações</h2>
          </div>
          <div className="p-5">
            {!auditLogs?.length ? (
              <EmptyState>Ainda não existem eventos de auditoria.</EmptyState>
            ) : (
              <div className="divide-y divide-slate-100">
                {auditLogs.map((log) => (
                  <div key={log.id} className="py-3 first:pt-0">
                    <p className="text-sm font-medium text-slate-900">
                      {log.action} · {log.entity_type}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{formatDateTime(log.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className="border-b border-slate-200 p-5">
            <h2 className="font-semibold text-slate-950">Sessões de tempo</h2>
          </div>
          <div className="p-5">
            {!sessions?.length ? (
              <EmptyState>Ainda não existem sessões de tempo.</EmptyState>
            ) : (
              <div className="divide-y divide-slate-100">
                {sessions.map((session) => (
                  <div key={session.id} className="py-3 first:pt-0">
                    <p className="text-sm font-medium text-slate-900">
                      {relatedTitle(session.actions) ?? "Acção"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatDateTime(session.started_at)} · {session.duration_seconds ? Math.round(session.duration_seconds / 60) : 0} min
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
