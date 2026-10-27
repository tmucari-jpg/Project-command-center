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
    { data: deliverables, error: deliverablesError },
  ] = await Promise.all([
    supabase.from("projects").select("id,title,status,progress,due_date,next_action,next_review_date,objectives(title)").eq("user_id", user.id).order("title"),
    supabase.from("actions").select("id,title,project_id,status,due_at,is_next_action").eq("user_id", user.id).neq("status", "cancelled"),
    supabase.from("blockers").select("id,project_id,status").eq("user_id", user.id).in("status", ["open", "investigating", "waiting"]),
    supabase.from("deliverables").select("id,project_id,title,status,progress,due_date,artifact_type,artifact_url,artifact_reference,qa_status,acceptance_status").eq("user_id", user.id),
  ]);

  const error = projectError ?? actionsError ?? blockersError ?? deliverablesError;
  const activeProjects = (projects ?? []).filter((project) => !["completed", "cancelled"].includes(project.status));
  const openActions = (actions ?? []).filter((action) => !["completed", "cancelled"].includes(action.status));
  const overdueActions = openActions.filter((action) => action.due_at && new Date(action.due_at) < now);

  const deliverableRows = (deliverables ?? []).filter((item) =>
    activeProjects.some((project) => project.id === item.project_id),
  );
  const acceptedDeliverables = deliverableRows.filter((item) => item.acceptance_status === "accepted");
  const deliverablesInValidation = deliverableRows.filter((item) =>
    item.acceptance_status !== "accepted" && ["passed", "not_required"].includes(item.qa_status ?? ""),
  );
  const deliverablesWithoutEvidence = deliverableRows.filter((item) => !item.artifact_url && !item.artifact_reference);
  const overdueDeliverables = deliverableRows.filter((item) =>
    item.acceptance_status !== "accepted" &&
    Boolean(item.due_date) &&
    new Date(`${item.due_date}T23:59:59`) < now,
  );

  const projectRows = activeProjects.map((project) => {
    const projectActions = openActions.filter((action) => action.project_id === project.id);
    const projectBlockers = (blockers ?? []).filter((blocker) => blocker.project_id === project.id);
    const projectDeliverables = deliverableRows.filter((item) => item.project_id === project.id);
    const projectMissingEvidence = projectDeliverables.filter((item) => !item.artifact_url && !item.artifact_reference);
    const projectUnaccepted = projectDeliverables.filter((item) => item.acceptance_status !== "accepted");
    const projectOverdueDeliverables = projectUnaccepted.filter((item) =>
      Boolean(item.due_date) && new Date(`${item.due_date}T23:59:59`) < now,
    );
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
    const deliverableAttention =
      projectMissingEvidence.length +
      projectOverdueDeliverables.length * 2 +
      projectUnaccepted.filter((item) => item.qa_status === "failed" || item.acceptance_status === "correction_required").length * 2;
    const operationalAttention = overdue.length + projectBlockers.length + dueSoon.length + (reviewOverdue ? 1 : 0);
    const attention = deliverableAttention + operationalAttention;
    const health = projectHealth({
      progress: Number(project.progress ?? 0),
      dueDate: project.due_date,
      openBlockers: projectBlockers.length + projectOverdueDeliverables.length,
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
      deliverables: projectDeliverables.length,
      accepted: projectDeliverables.filter((item) => item.acceptance_status === "accepted").length,
      missingEvidence: projectMissingEvidence.length,
      overdueDeliverables: projectOverdueDeliverables.length,
    };
  }).sort((a, b) => b.attention - a.attention || a.project.title.localeCompare(b.project.title));

  const projectsToReview = projectRows.filter((row) => row.attention > 0 || row.project.status === "at_risk").length;
  const maxAttention = Math.max(1, ...projectRows.map((row) => row.attention));
  const healthItems = [
    { label: "No caminho", value: projectRows.filter((row) => row.health === "on_track").length, color: "var(--cc-success)" },
    { label: "Em risco", value: projectRows.filter((row) => row.health === "at_risk").length, color: "var(--cc-due-soon)" },
    { label: "Em atraso", value: projectRows.filter((row) => row.health === "delayed").length, color: "var(--cc-overdue)" },
  ];

  return (
    <>
      <PageHeader eyebrow="Visão executiva" title="Painel" />

      {error && <Card className="mb-5 p-4 text-sm text-[var(--cc-danger)]">{error.message}</Card>}

      <section aria-label="Estado dos entregáveis">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--cc-gold)]">Resultados primeiro</p>
            <h2 className="mt-1 text-base font-semibold text-[var(--cc-foreground)]">Entregáveis e evidência</h2>
          </div>
          <Link href="/deliverables" className="text-xs font-semibold text-[var(--cc-accent)]">Abrir entregáveis</Link>
        </div>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Link href="/deliverables"><Card className="h-full p-4 sm:p-5">
            <p className="text-xs font-medium text-[var(--cc-secondary)] sm:text-sm">Entregáveis aceites</p>
            <p className="mt-2 text-[1.75rem] font-semibold leading-none text-[var(--cc-success)]">{acceptedDeliverables.length}</p>
            <p className="mt-2 text-[11px] text-[var(--cc-secondary)]">de {deliverableRows.length} definidos</p>
          </Card></Link>
          <Link href="/deliverables"><Card className="h-full p-4 sm:p-5">
            <p className="text-xs font-medium text-[var(--cc-secondary)] sm:text-sm">Em validação</p>
            <p className="mt-2 text-[1.75rem] font-semibold leading-none text-[var(--cc-foreground)]">{deliverablesInValidation.length}</p>
            <p className="mt-2 text-[11px] text-[var(--cc-secondary)]">QA concluído, aceitação pendente</p>
          </Card></Link>
          <Link href="/deliverables"><Card className="h-full p-4 sm:p-5">
            <p className="text-xs font-medium text-[var(--cc-secondary)] sm:text-sm">Sem evidência</p>
            <p className="mt-2 text-[1.75rem] font-semibold leading-none text-[var(--cc-overdue)]">{deliverablesWithoutEvidence.length}</p>
            <p className="mt-2 text-[11px] text-[var(--cc-secondary)]">objecto ou referência em falta</p>
          </Card></Link>
          <Link href="/deliverables"><Card className="h-full p-4 sm:p-5">
            <p className="text-xs font-medium text-[var(--cc-secondary)] sm:text-sm">Entregáveis em atraso</p>
            <p className="mt-2 text-[1.75rem] font-semibold leading-none text-[var(--cc-blocked)]">{overdueDeliverables.length}</p>
            <p className="mt-2 text-[11px] text-[var(--cc-secondary)]">prazo vencido sem aceitação</p>
          </Card></Link>
        </div>
      </section>

      <section className="mt-5" aria-label="Contexto operacional">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Link href="/projects"><Card className="h-full p-4">
            <p className="text-xs font-medium text-[var(--cc-secondary)]">Projectos activos</p>
            <p className="mt-2 text-xl font-semibold leading-none text-[var(--cc-foreground)]">{activeProjects.length}</p>
          </Card></Link>
          <Link href="/actions?view=attention"><Card className="h-full p-4">
            <p className="text-xs font-medium text-[var(--cc-secondary)]">Acções em atraso</p>
            <p className="mt-2 text-xl font-semibold leading-none text-[var(--cc-overdue)]">{overdueActions.length}</p>
          </Card></Link>
          <Link href="/actions?view=blocked"><Card className="h-full p-4">
            <p className="text-xs font-medium text-[var(--cc-secondary)]">Bloqueios activos</p>
            <p className="mt-2 text-xl font-semibold leading-none text-[var(--cc-blocked)]">{blockers?.length ?? 0}</p>
          </Card></Link>
          <Link href="/projects"><Card className="h-full p-4">
            <p className="text-xs font-medium text-[var(--cc-secondary)]">Projectos a rever</p>
            <p className="mt-2 text-xl font-semibold leading-none text-[var(--cc-foreground)]">{projectsToReview}</p>
          </Card></Link>
        </div>
      </section>

      <Card className="mt-6 p-5">
        <div className="grid gap-7 xl:grid-cols-[320px_1fr]">
          <section>
            <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Saúde dos projectos</h2>
            <p className="mt-1 text-sm text-[var(--cc-secondary)]">Estado combinado de resultados, evidência, prazos, bloqueios e execução.</p>
            <div className="mt-5"><DonutChart items={healthItems} centerLabel="Projectos" /></div>
          </section>
          <section className="min-w-0">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Pressão por projecto</h2>
                <p className="mt-1 text-sm text-[var(--cc-secondary)]">Prioriza lacunas de entregáveis e acrescenta pressão operacional como sinal secundário.</p>
              </div>
              <Link href="/deliverables" className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--cc-accent)]">
                Abrir resultados <ArrowRight size={14} />
              </Link>
            </div>
            <div className="mt-3"><PressureLegend /></div>
            <div className="mt-5 space-y-4">
              {projectRows.length === 0 ? (
                <EmptyState>Não existem projectos activos.</EmptyState>
              ) : projectRows.map((row) => (
                <div key={row.project.id} className="grid gap-2 sm:grid-cols-[190px_1fr_48px] sm:items-center">
                  <Link href={`/projects/${row.project.id}`} className="truncate text-sm font-medium text-[var(--cc-foreground)] hover:underline">{row.project.title}</Link>
                  <PressureBar blocked={row.blockers + row.overdueDeliverables} overdue={row.overdue} dueSoon={row.dueSoon + row.missingEvidence} reviewOverdue={row.reviewOverdue} max={maxAttention} />
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
                    <span className="font-medium">Entregáveis:</span> {row.accepted}/{row.deliverables} aceites
                    {row.missingEvidence ? ` · ${row.missingEvidence} sem evidência` : ""}
                    {row.overdueDeliverables ? ` · ${row.overdueDeliverables} em atraso` : ""}
                  </p>
                  <p className="mt-1 text-xs text-[var(--cc-secondary)]">
                    {row.next?.title || row.project.next_action ? <>Próxima acção: {row.next?.title ?? row.project.next_action}</> : "Próxima acção por definir"}
                    {row.overdue ? ` · ${row.overdue} acção(ões) em atraso` : ""}
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
