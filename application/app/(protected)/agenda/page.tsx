import Link from "next/link";
import { CalendarCheck2, Clock3, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, EmptyState, secondaryButtonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { buildProjectAgenda, isActionOverdue } from "@/lib/daily-agenda";
import { formatDateTime } from "@/lib/format";

export default async function AgendaPage() {
  const { supabase, user } = await requireUser();

  const [{ data: actions, error }, { data: blockers }] = await Promise.all([
    supabase
      .from("actions")
      .select("id,title,status,priority,due_at,is_next_action,estimated_minutes,project_id,projects(title)")
      .eq("user_id", user.id)
      .neq("status", "completed")
      .neq("status", "cancelled"),
    supabase
      .from("blockers")
      .select("id,project_id")
      .eq("user_id", user.id)
      .in("status", ["open", "investigating", "waiting"]),
  ]);

  const agenda = buildProjectAgenda(actions ?? []);
  const blockedProjects = new Set((blockers ?? []).map((item) => item.project_id).filter(Boolean));
  const now = new Date();

  return (
    <>
      <PageHeader
        eyebrow="Planeamento"
        title="Agenda diária"
      />

      {error ? (
        <Card className="p-5 text-sm text-red-700">{error.message}</Card>
      ) : agenda.length === 0 ? (
        <Card className="p-6">
          <EmptyState>Não existem acções abertas para colocar na agenda.</EmptyState>
        </Card>
      ) : (
        <div className="space-y-4">
          {agenda.map((group) => {
            const isBlocked = group.project_id ? blockedProjects.has(group.project_id) : false;

            return (
              <details
                key={group.project_id ?? "sem-projecto"}
                open={group.today_count > 0 || group.overdue_count > 0}
                className={`rounded-2xl border bg-white ${group.overdue_count > 0 ? "border-red-200" : "border-slate-200"}`}
              >
                <summary className="cursor-pointer list-none p-5">
                  <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-slate-950">{group.title}</h2>
                        {group.overdue_count > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800">
                            <TriangleAlert size={13} /> {group.overdue_count} em atraso
                          </span>
                        )}
                        {isBlocked && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                            <TriangleAlert size={13} /> projecto com bloqueio
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        {group.today_count} para hoje
                        {group.yesterday_pending_count > 0 ? ` · ${group.yesterday_pending_count} pendente(s) de ontem` : ""}
                        {group.overdue_count > group.yesterday_pending_count
                          ? ` · ${group.overdue_count - group.yesterday_pending_count} atraso(s) anterior(es)`
                          : ""}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      {group.actions.length} acção(ões)
                    </span>
                  </div>
                </summary>

                <div className="space-y-3 border-t border-slate-200 p-5">
                  {group.actions.map((action, index) => {
                    const overdue = isActionOverdue(action, now);

                    return (
                      <article
                        key={action.id}
                        className={`rounded-xl border p-4 ${overdue ? "border-red-300 bg-red-50" : "border-slate-200"}`}
                      >
                        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                                {index + 1}
                              </span>
                              {overdue && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-800">
                                  <TriangleAlert size={13} /> tratamento necessário
                                </span>
                              )}
                              {action.is_next_action && (
                                <span className="rounded-full bg-[color-mix(in_srgb,var(--cc-accent)_10%,white)] px-2 py-1 text-xs font-semibold text-[var(--cc-accent)]">
                                  próxima acção
                                </span>
                              )}
                            </div>

                            <h3 className="mt-3 font-semibold text-slate-950">{action.title}</h3>
                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                              <span className={`inline-flex items-center gap-1.5 ${overdue ? "font-semibold text-red-700" : "text-slate-500"}`}>
                                <CalendarCheck2 size={15} />{formatDateTime(action.due_at)}
                              </span>
                              <span className="inline-flex items-center gap-1.5 text-slate-500">
                                <Clock3 size={15} />{action.estimated_minutes ?? "—"} min
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {group.project_id && (
                              <>
                                <Link className={secondaryButtonClass} href={`/projects/${group.project_id}`}>
                                  Abrir projecto
                                </Link>
                                <Link className={secondaryButtonClass} href={`/actions?project_id=${group.project_id}`}>
                                  Ver todas as acções
                                </Link>
                              </>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </details>
            );
          })}
        </div>
      )}

      <Card className="mt-6 p-5">
        <p className="text-sm text-slate-600">
          Esta agenda não cria uma segunda fonte de verdade. É calculada directamente a partir das acções já registadas no Command Center.
        </p>
      </Card>
    </>
  );
}
