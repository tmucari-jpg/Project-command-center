import Link from "next/link";
import { CalendarCheck2, Clock3, FolderKanban, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, EmptyState, secondaryButtonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { buildDailyAgenda } from "@/lib/daily-agenda";
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

  const agenda = buildDailyAgenda(actions ?? []);
  const blockedProjects = new Set((blockers ?? []).map((item) => item.project_id).filter(Boolean));

  return (
    <>
      <PageHeader
        eyebrow="Planeamento"
        title="Agenda diária"
        description="Até 5 acções abertas, ordenadas pelos dados já existentes: próxima acção, prioridade e prazo."
      />

      {error ? (
        <Card className="p-5 text-sm text-red-700">{error.message}</Card>
      ) : agenda.length === 0 ? (
        <Card className="p-6">
          <EmptyState>Não existem acções abertas para colocar na agenda.</EmptyState>
        </Card>
      ) : (
        <div className="space-y-4">
          {agenda.map((action, index) => {
            const relation = Array.isArray(action.projects) ? action.projects[0] : action.projects;
            const projectTitle = relation?.title ?? "Sem projecto";
            const isBlocked = action.project_id ? blockedProjects.has(action.project_id) : false;

            return (
              <Card key={action.id} className="p-5">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                        {index + 1}
                      </span>
                      {action.is_next_action && (
                        <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">
                          próxima acção
                        </span>
                      )}
                      {isBlocked && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                          <TriangleAlert size={13} /> projecto com bloqueio
                        </span>
                      )}
                    </div>

                    <h2 className="mt-3 text-lg font-semibold text-slate-950">{action.title}</h2>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-500">
                      <span className="inline-flex items-center gap-1.5"><FolderKanban size={15} />{projectTitle}</span>
                      <span className="inline-flex items-center gap-1.5"><CalendarCheck2 size={15} />{formatDateTime(action.due_at)}</span>
                      <span className="inline-flex items-center gap-1.5"><Clock3 size={15} />{action.estimated_minutes ?? "—"} min</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {action.project_id && (
                      <Link className={secondaryButtonClass} href={`/projects/${action.project_id}`}>
                        Abrir Hub
                      </Link>
                    )}
                    <Link className={secondaryButtonClass} href="/actions">
                      Ver acções
                    </Link>
                  </div>
                </div>
              </Card>
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
