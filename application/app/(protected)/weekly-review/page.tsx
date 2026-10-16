import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, EmptyState, secondaryButtonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { buildWeeklyReview } from "@/lib/weekly-review";

export default async function WeeklyReviewPage() {
  const { supabase, user } = await requireUser();

  const [
    { data: projects, error },
    { data: actions },
    { data: blockers },
    { data: evidence },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id,title,status,progress")
      .eq("user_id", user.id)
      .order("priority", { ascending: false }),
    supabase
      .from("actions")
      .select("project_id,status,due_at")
      .eq("user_id", user.id),
    supabase
      .from("blockers")
      .select("project_id,status")
      .eq("user_id", user.id),
    supabase
      .from("evidence")
      .select("project_id,created_at")
      .eq("user_id", user.id),
  ]);

  const review = buildWeeklyReview({
    projects: projects ?? [],
    actions: actions ?? [],
    blockers: blockers ?? [],
    evidence: evidence ?? [],
  });

  return (
    <>
      <PageHeader
        eyebrow="Revisão"
        title="Revisão semanal"
      />

      {error ? (
        <Card className="p-5 text-sm text-red-700">{error.message}</Card>
      ) : review.length === 0 ? (
        <Card className="p-6">
          <EmptyState>Não existem projectos para rever.</EmptyState>
        </Card>
      ) : (
        <div className="space-y-4">
          {review.map((item) => (
            <details
              key={item.project_id}
              open={item.overdue_actions > 0 || item.open_blockers > 0}
              className={`rounded-2xl border bg-white ${item.overdue_actions > 0 ? "border-red-200" : "border-slate-200"}`}
            >
              <summary className="cursor-pointer list-none p-5">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">{item.title}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Estado {item.status} · Progresso {item.progress}%
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      {item.due_this_week} acção(ões) para esta semana
                      {item.overdue_actions > 0 ? ` · ${item.overdue_actions} em atraso` : ""}
                      {item.open_blockers > 0 ? ` · ${item.open_blockers} bloqueio(s) aberto(s)` : ""}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    abrir resumo
                  </span>
                </div>
              </summary>

              <div className="border-t border-slate-200 p-5">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                  <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Acções abertas</p><p className="mt-1 text-xl font-semibold">{item.open_actions}</p></div>
                  <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Concluídas</p><p className="mt-1 text-xl font-semibold">{item.completed_actions}</p></div>
                  <div className={`rounded-xl p-3 ${item.overdue_actions > 0 ? "bg-red-50" : "bg-slate-50"}`}>
                    <p className={`text-xs ${item.overdue_actions > 0 ? "font-semibold text-red-700" : "text-slate-500"}`}>Em atraso</p>
                    <p className={`mt-1 text-xl font-semibold ${item.overdue_actions > 0 ? "text-red-800" : ""}`}>{item.overdue_actions}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Esta semana</p><p className="mt-1 text-xl font-semibold">{item.due_this_week}</p></div>
                  <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Bloqueios</p><p className="mt-1 text-xl font-semibold">{item.open_blockers}</p></div>
                  <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Evidências</p><p className="mt-1 text-xl font-semibold">{item.evidence_count}</p></div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link className={secondaryButtonClass} href={`/projects/${item.project_id}`}>
                    Abrir projecto
                  </Link>
                  <Link className={secondaryButtonClass} href={`/actions?project_id=${item.project_id}`}>
                    Acções do projecto
                  </Link>
                  <Link className={secondaryButtonClass} href={`/blockers?project_id=${item.project_id}`}>
                    Bloqueios do projecto
                  </Link>
                </div>
              </div>
            </details>
          ))}
        </div>
      )}
    </>
  );
}
