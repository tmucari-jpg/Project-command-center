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
      .select("project_id,status")
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
        eyebrow="P03"
        title="Revisão semanal"
        description="Síntese factual do progresso por projecto. O módulo usa apenas dados já registados."
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
            <Card key={item.project_id} className="p-5">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">{item.title}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Estado {item.status} · Progresso {item.progress}%
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Acções abertas</p><p className="mt-1 text-xl font-semibold">{item.open_actions}</p></div>
                    <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Concluídas</p><p className="mt-1 text-xl font-semibold">{item.completed_actions}</p></div>
                    <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Bloqueios</p><p className="mt-1 text-xl font-semibold">{item.open_blockers}</p></div>
                    <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Evidências</p><p className="mt-1 text-xl font-semibold">{item.evidence_count}</p></div>
                  </div>
                </div>
                <Link className={secondaryButtonClass} href={`/projects/${item.project_id}`}>
                  Abrir Hub
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card className="mt-6 p-5">
        <p className="text-sm text-slate-600">
          Integração P03: esta revisão não altera prioridades automaticamente e não substitui decisões humanas.
        </p>
      </Card>
    </>
  );
}
