import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SimpleBarChart } from "@/components/simple-bar-chart";
import { Card, EmptyState } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { executiveProjectHealth } from "@/lib/project-metrics";

export default async function DashboardPage() {
  const { supabase, user } = await requireUser();

  const [
    { data: projects },
    { data: actions },
    { data: blockers },
    { data: nextAction },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id,title,status,progress,due_date,owner_id,next_review_date,governance_gate_status")
      .eq("user_id", user.id),
    supabase
      .from("actions")
      .select("id,project_id,title,status,due_at,is_next_action,projects(title)")
      .eq("user_id", user.id)
      .neq("status", "completed")
      .neq("status", "cancelled"),
    supabase
      .from("blockers")
      .select("id,project_id,status")
      .eq("user_id", user.id)
      .in("status", ["open", "investigating", "waiting"]),
    supabase
      .from("actions")
      .select("id,title,due_at,projects(title)")
      .eq("user_id", user.id)
      .eq("is_next_action", true)
      .maybeSingle(),
  ]);

  const now = new Date();
  const activeProjects = (projects ?? []).filter((item) =>
    ["planning", "active", "at_risk", "on_hold"].includes(item.status),
  );
  const overdueActions = (actions ?? []).filter(
    (item) => item.due_at && new Date(item.due_at) < now,
  );

  const overdueByProject = new Map<string, number>();
  const blockersByProject = new Map<string, number>();
  for (const action of overdueActions) {
    if (!action.project_id) continue;
    overdueByProject.set(action.project_id, (overdueByProject.get(action.project_id) ?? 0) + 1);
  }
  for (const blocker of blockers ?? []) {
    if (!blocker.project_id) continue;
    blockersByProject.set(blocker.project_id, (blockersByProject.get(blocker.project_id) ?? 0) + 1);
  }

  const projectRows = activeProjects
    .map((project) => {
      const overdue = overdueByProject.get(project.id) ?? 0;
      const blocked = blockersByProject.get(project.id) ?? 0;
      const reviewOverdue = Boolean(project.next_review_date && new Date(project.next_review_date) < now);
      const attention = overdue + blocked + (reviewOverdue ? 1 : 0);
      const health = executiveProjectHealth({
        progress: Number(project.progress ?? 0),
        dueDate: project.due_date,
        openBlockers: blocked,
        overdueActions: overdue,
        activeDependencies: 0,
        nextReviewDate: project.next_review_date,
        planStale: false,
        gateStatus: project.governance_gate_status,
        hasOwner: Boolean(project.owner_id),
      });
      return { ...project, overdue, blocked, attention, health };
    })
    .sort((a, b) => b.attention - a.attention || a.title.localeCompare(b.title));

  const projectsToReview = projectRows.filter((project) => project.attention > 0).length;
  const nextActionProject = nextAction
    ? (Array.isArray(nextAction.projects) ? nextAction.projects[0] : nextAction.projects)
    : null;
  const chartItems = projectRows
    .filter((project) => project.attention > 0)
    .map((project) => ({
      label: project.title,
      value: project.attention,
      meta: [project.overdue ? `${project.overdue} em atraso` : "", project.blocked ? `${project.blocked} bloqueio(s)` : ""]
        .filter(Boolean)
        .join(" · "),
    }));

  return (
    <>
      <PageHeader eyebrow="Visão executiva" title="Painel" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link href="/projects" className="group">
          <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-sm font-medium text-[var(--cc-secondary)]">Projectos activos</p>
            <p className="mt-2 text-[2rem] font-semibold leading-none">{activeProjects.length}</p>
          </Card>
        </Link>
        <Link href="/actions?view=attention" className="group">
          <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-sm font-medium text-[var(--cc-secondary)]">Acções em atraso</p>
            <p className="mt-2 text-[2rem] font-semibold leading-none">{overdueActions.length}</p>
          </Card>
        </Link>
        <Link href="/actions?view=blocked" className="group">
          <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-sm font-medium text-[var(--cc-secondary)]">Bloqueios activos</p>
            <p className="mt-2 text-[2rem] font-semibold leading-none">{blockers?.length ?? 0}</p>
          </Card>
        </Link>
        <Link href="/projects" className="group">
          <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-sm font-medium text-[var(--cc-secondary)]">Projectos a rever</p>
            <p className="mt-2 text-[2rem] font-semibold leading-none">{projectsToReview}</p>
          </Card>
        </Link>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <Card className="p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-[var(--cc-foreground)]">Pressão operacional por projecto</h2>
              <p className="mt-1 text-sm text-[var(--cc-secondary)]">Acções em atraso, bloqueios e revisões vencidas.</p>
            </div>
            <Link href="/actions" className="text-sm font-semibold text-[var(--cc-accent)]">Executar</Link>
          </div>
          <SimpleBarChart items={chartItems} emptyLabel="Nenhum projecto exige intervenção imediata." />
        </Card>

        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--cc-accent-soft)]">Próxima acção</p>
          {nextAction ? (
            <>
              <h2 className="mt-3 font-semibold text-[var(--cc-foreground)]">{nextAction.title}</h2>
              <p className="mt-2 text-sm text-[var(--cc-secondary)]">
                {nextActionProject?.title ?? "Sem projecto"}
                {nextAction.due_at ? ` · prazo ${formatDate(nextAction.due_at)}` : " · sem prazo"}
              </p>
              <Link href="/actions" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[var(--cc-accent)]">
                Abrir execução <ArrowRight size={14} />
              </Link>
            </>
          ) : (
            <EmptyState>Defina a próxima acção a partir da área Executar.</EmptyState>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <div className="border-b border-[var(--cc-border)] p-5">
          <h2 className="font-semibold text-[var(--cc-foreground)]">Projectos que exigem atenção</h2>
        </div>
        <div className="divide-y divide-[var(--cc-border)]">
          {!projectRows.length ? (
            <div className="p-5"><EmptyState>Não existem projectos activos.</EmptyState></div>
          ) : (
            projectRows.slice(0, 6).map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`} className="grid gap-3 p-5 transition hover:bg-[var(--cc-surface-muted)] md:grid-cols-[1.4fr_0.7fr_0.7fr_auto] md:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-[var(--cc-foreground)]">{project.title}</h3>
                    <StatusBadge status={project.health.status} />
                  </div>
                </div>
                <p className="text-sm text-[var(--cc-secondary)]">{project.overdue} em atraso</p>
                <p className="text-sm text-[var(--cc-secondary)]">{project.blocked} bloqueio(s)</p>
                <span className="text-sm font-semibold text-[var(--cc-accent)]">Ver projecto →</span>
              </Link>
            ))
          )}
        </div>
      </Card>
    </>
  );
}
