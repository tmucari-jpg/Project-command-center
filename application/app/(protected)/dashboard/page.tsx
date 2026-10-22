import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { DonutChart, PressureBar, PressureLegend } from "@/components/operational-charts";
import { Card, EmptyState } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { projectHealth } from "@/lib/project-metrics";

export default async function DashboardPage() {
  const { supabase, user } = await requireUser();
  const now = new Date();
  const dueSoonLimit = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    { data: projects, error: projectError },
    { data: actions, error: actionsError },
    { data: blockers, error: blockersError },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id,title,status,progress,due_date,next_action,next_review_date,objectives(title)")
      .eq("user_id", user.id)
      .order("title"),
    supabase
      .from("actions")
      .select("id,title,project_id,status,due_at,is_next_action")
      .eq("user_id", user.id)
      .neq("status", "cancelled"),
    supabase
      .from("blockers")
      .select("id,project_id,status")
      .eq("user_id", user.id)
      .in("status", ["open", "investigating", "waiting"]),
  ]);

  const error = projectError ?? actionsError ?? blockersError;
  const activeProjects = (projects ?? []).filter((project) => !["completed", "cancelled"].includes(project.status));
  const openActions = (actions ?? []).filter((action) => !["completed", "cancelled"].includes(action.status));
  const overdueActions = openActions.filter((action) => action.due_at && new Date(action.due_at) < now);

  const projectRows = activeProjects.map((project) => {
    const projectActions = openActions.filter((action) => action.project_id === project.id);
    const projectBlockers = (blockers ?? []).filter((blocker) => blocker.project_id === project.id);
    const overdue = projectActions.filter((action) => action.due_at && new Date(action.due_at) < now);
    const dueSoon = projectActions.filter((action) => {
      if (!action.due_at) return false;
      const due = new Date(action.due_at);
      return due >= now && due <= dueSoonLimit;
    });
    const next = projectActions.find((action) => action.is_next_action) ??
      [...projectActions].sort((a, b) => {
        const aDue = a.due_at ? new Date(a.due_at).getTime() : Number.POSITIVE_INFINITY;
        const bDue = b.due_at ? new Date(b.due_at).getTime() : Number.POSITIVE_INFINITY;
        return aDue - bDue;
      })[0];

    const reviewOverdue = Boolean(project.next_review_date && new Date(project.next_review_date) < now);
    const attention = overdue.length + projectBlockers.length + dueSoon.length + (reviewOverdue ? 1 : 0);
    const health = projectHealth({
      progress: Number(project.progress ?? 0),
      dueDate: project.due_date,
      openBlockers: projectBlockers.length,
      overdueActions: overdue.length,
    });

    return {
      project,
      open: projectActions.length,
      overdue: overdue.length,
      blockers: projectBlockers.length,
      dueSoon: dueSoon.length,
      next,
      reviewOverdue,
      attention,
      health,
    };
  }).sort((a, b) => b.attention - a.attention || a.project.title.localeCompare(b.project.title));

  const projectsToReview = projectRows.filter((row) => row.attention > 0 || row.project.status === "at_risk").length;
  const maxAttention = Math.max(1, ...projectRows.map((row) => row.attention));
  const healthItems = [
    {
      label: "No caminho",
      value: projectRows.filter((row) => row.health === "on_track").length,
      color: "var(--cc-success)",
    },
    {
      label: "Em risco",
      value: projectRows.filter((row) => row.health === "at_risk").length,
      color: "var(--cc-due-soon)",
    },
    {
      label: "Em atraso",
      value: projectRows.filter((row) => row.health === "delayed").length,
      color: "var(--cc-overdue)",
    },
  ];

  return (
    <>
      <PageHeader eyebrow="Visão executiva" title="Painel" />

      {error && <Card className="mb-5 p-4 text-sm text-[var(--cc-danger)]">{error.message}</Card>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link href="/projects"><Card className="h-full p-5">
          <p className="text-sm font-medium text-[var(--cc-secondary)]">Projectos activos</p>
          <p className="mt-2 text-[2rem] font-semibold leading-none text-[var(--cc-foreground)]">{activeProjects.length}</p>
        </Card></Link>
        <Link href="/actions?view=attention"><Card className="h-full p-5">
          <p className="text-sm font-medium text-[var(--cc-secondary)]">Acções em atraso</p>
          <p className="mt-2 text-[2rem] font-semibold leading-none text-[var(--cc-overdue)]">{overdueActions.length}</p>
        </Card></Link>
        <Link href="/actions?view=blocked"><Card className="h-full p-5">
          <p className="text-sm font-medium text-[var(--cc-secondary)]">Bloqueios activos</p>
          <p className="mt-2 text-[2rem] font-semibold leading-none text-[var(--cc-blocked)]">{blockers?.length ?? 0}</p>
        </Card></Link>
        <Link href="/projects"><Card className="h-full p-5">
          <p className="text-sm font-medium text-[var(--cc-secondary)]">Projectos a rever</p>
          <p className="mt-2 text-[2rem] font-semibold leading-none text-[var(--cc-foreground)]">{projectsToReview}</p>
        </Card></Link>
      </div>

      <Card className="mt-6 p-5">
        <div className="grid gap-7 xl:grid-cols-[320px_1fr]">
          <section>
            <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Saúde dos projectos</h2>
            <p className="mt-1 text-sm text-[var(--cc-secondary)]">
              Distribuição dos projectos activos pelo estado operacional actual.
            </p>
            <div className="mt-5">
              <DonutChart items={healthItems} centerLabel="Projectos" />
            </div>
          </section>

          <section className="min-w-0">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Pressão operacional por projecto</h2>
                <p className="mt-1 text-sm text-[var(--cc-secondary)]">
                  A barra mostra a composição da pressão: bloqueios, atrasos, prazos próximos e revisão vencida.
                </p>
              </div>
              <Link href="/actions" className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--cc-accent)]">
                Abrir Executar <ArrowRight size={14} />
              </Link>
            </div>
            <div className="mt-3">
              <PressureLegend />
            </div>
            <div className="mt-5 space-y-4">
              {projectRows.length === 0 ? (
                <EmptyState>Não existem projectos activos.</EmptyState>
              ) : projectRows.map((row) => (
                <div key={row.project.id} className="grid gap-2 sm:grid-cols-[190px_1fr_48px] sm:items-center">
                  <Link href={`/projects/${row.project.id}`} className="truncate text-sm font-medium text-[var(--cc-foreground)] hover:underline">
                    {row.project.title}
                  </Link>
                  <PressureBar
                    blocked={row.blockers}
                    overdue={row.overdue}
                    dueSoon={row.dueSoon}
                    reviewOverdue={row.reviewOverdue}
                    max={maxAttention}
                  />
                  <span className="text-right text-sm font-semibold text-[var(--cc-foreground)]">{row.attention}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </Card>

      <Card className="mt-6">
        <div className="border-b border-[var(--cc-border)] p-5">
          <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Projectos que exigem acompanhamento</h2>
        </div>
        <div className="divide-y divide-[var(--cc-border)]">
          {projectRows.length === 0 ? (
            <div className="p-5"><EmptyState>Não existem projectos registados.</EmptyState></div>
          ) : projectRows.map((row) => (
            <Link key={row.project.id} href={`/projects/${row.project.id}`} className="block p-5 transition hover:bg-[var(--cc-surface-muted)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-[var(--cc-foreground)]">{row.project.title}</h3>
                    <StatusBadge status={row.health} />
                  </div>
                  <p className="mt-2 text-sm text-[var(--cc-foreground)]">
                    {row.next?.title || row.project.next_action
                      ? <><span className="font-medium">Próxima:</span> {row.next?.title ?? row.project.next_action}</>
                      : "Próxima acção por definir"}
                  </p>
                  <p className="mt-1 text-xs text-[var(--cc-secondary)]">
                    {row.open} aberta(s)
                    {row.overdue ? ` · ${row.overdue} em atraso` : ""}
                    {row.blockers ? ` · ${row.blockers} bloqueio(s)` : ""}
                    {row.project.next_review_date ? ` · revisão ${formatDate(row.project.next_review_date)}` : ""}
                  </p>
                </div>
                <span className="text-xs font-semibold text-[var(--cc-accent)]">Abrir projecto</span>
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </>
  );
}
