import Link from "next/link";
import { ArrowRight, Clock3 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, EmptyState } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

export default async function DashboardPage() {
  const { supabase, user } = await requireUser();

  const [
    objectivesResult,
    projectsResult,
    actionsResult,
    blockersResult,
    ideasResult,
    deliverablesResult,
    metricsResult,
    decisionsResult,
    nextActionResult,
  ] = await Promise.all([
    supabase.from("objectives").select("id,status,progress", { count: "exact" }).eq("user_id", user.id),
    supabase.from("projects").select("id,status,progress", { count: "exact" }).eq("user_id", user.id),
    supabase
      .from("actions")
      .select("id,title,status,due_at,priority,actual_minutes,projects(title)")
      .eq("user_id", user.id)
      .neq("status", "completed")
      .neq("status", "cancelled")
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(6),
    supabase
      .from("blockers")
      .select("id,status,impact,title")
      .eq("user_id", user.id)
      .in("status", ["open", "investigating", "waiting"]),
    supabase.from("ideas").select("id,status", { count: "exact" }).eq("user_id", user.id),
    supabase
      .from("deliverables")
      .select("id,title,status,progress,due_date,projects(title)")
      .eq("user_id", user.id)
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("metrics")
      .select("id,name,current_value,target_value,unit,measurement_date,projects(title),objectives(title)")
      .eq("user_id", user.id)
      .order("measurement_date", { ascending: false, nullsFirst: false })
      .limit(5),
    supabase
      .from("decisions")
      .select("id,title,decision,decided_at,projects(title)")
      .eq("user_id", user.id)
      .order("decided_at", { ascending: false })
      .limit(5),
    supabase
      .from("actions")
      .select("id,title,priority,due_at,completion_criteria,projects(title)")
      .eq("user_id", user.id)
      .eq("is_next_action", true)
      .maybeSingle(),
  ]);

  const objectives = objectivesResult.data ?? [];
  const projects = projectsResult.data ?? [];
  const actions = actionsResult.data ?? [];
  const blockers = blockersResult.data ?? [];
  const ideas = ideasResult.data ?? [];
  const deliverables = deliverablesResult.data ?? [];
  const metrics = metricsResult.data ?? [];
  const decisions = decisionsResult.data ?? [];

  const activeObjectives = objectives.filter((item) =>
    ["active", "on_track", "at_risk", "delayed"].includes(item.status),
  ).length;
  const activeProjects = projects.filter((item) =>
    ["planning", "active", "at_risk", "on_hold"].includes(item.status),
  ).length;
  const atRiskProjects = projects.filter((item) => item.status === "at_risk").length;
  const pendingIdeas = ideas.filter((item) =>
    ["captured", "evaluating", "approved"].includes(item.status),
  ).length;
  const activeDeliverables = deliverables.filter((item) =>
    ["pending", "active", "blocked"].includes(item.status),
  ).length;
  const blockedDeliverables = deliverables.filter((item) => item.status === "blocked").length;
  const completedDeliverables = deliverables.filter((item) => item.status === "completed").length;

  const now = new Date();
  const overdueActions = actions.filter((item) => item.due_at && new Date(item.due_at) < now).length;
  const overdueDeliverables = deliverables.filter(
    (item) => item.due_date && item.status !== "completed" && item.status !== "cancelled" && new Date(item.due_date) < now,
  ).length;

  return (
    <>
      <PageHeader
        eyebrow="Visão geral"
        title="Dashboard"
        description="Resumo operacional vivo do PCC, baseado exclusivamente nos dados registados no sistema."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link href="/objectives" className="group">
          <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:shadow-md sm:p-6">
            <p className="text-sm font-medium text-[var(--cc-secondary)]">Objectivos activos</p>
            <p className="mt-2 text-[2rem] font-semibold leading-none tracking-[-0.03em] text-[var(--cc-foreground)]">{activeObjectives}</p>
            <p className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--cc-accent)]">
              Abrir objectivos <ArrowRight size={13} />
            </p>
          </Card>
        </Link>

        <Link href="/projects" className="group">
          <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:shadow-md sm:p-6">
            <p className="text-sm font-medium text-[var(--cc-secondary)]">Projectos activos</p>
            <p className="mt-2 text-[2rem] font-semibold leading-none tracking-[-0.03em] text-[var(--cc-foreground)]">{activeProjects}</p>
            <p className="mt-3 text-xs text-[var(--cc-secondary)]">{atRiskProjects} em risco</p>
            <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--cc-accent)]">
              Abrir projectos <ArrowRight size={13} />
            </p>
          </Card>
        </Link>

        <Link href="/blockers" className="group">
          <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:shadow-md sm:p-6">
            <p className="text-sm font-medium text-[var(--cc-secondary)]">Bloqueios activos</p>
            <p className="mt-2 text-[2rem] font-semibold leading-none tracking-[-0.03em] text-[var(--cc-foreground)]">{blockers.length}</p>
            <p className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--cc-accent)]">
              Abrir bloqueios <ArrowRight size={13} />
            </p>
          </Card>
        </Link>

        <Link href="/ideas" className="group">
          <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:shadow-md sm:p-6">
            <p className="text-sm font-medium text-[var(--cc-secondary)]">Ideias por decidir</p>
            <p className="mt-2 text-[2rem] font-semibold leading-none tracking-[-0.03em] text-[var(--cc-foreground)]">{pendingIdeas}</p>
            <p className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--cc-accent)]">
              Abrir ideias <ArrowRight size={13} />
            </p>
          </Card>
        </Link>
      </div>

      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link href="/deliverables" className="group">
          <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-sm font-medium text-[var(--cc-secondary)]">Entregáveis activos</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--cc-foreground)]">{activeDeliverables}</p>
            <p className="mt-2 text-xs text-[var(--cc-secondary)]">
              {blockedDeliverables} bloqueados · {completedDeliverables} concluídos
            </p>
          </Card>
        </Link>
        <Link href="/actions" className="group">
          <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-sm font-medium text-[var(--cc-secondary)]">Acções abertas</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--cc-foreground)]">{actions.length}</p>
            <p className="mt-2 text-xs text-[var(--cc-secondary)]">{overdueActions} em atraso</p>
          </Card>
        </Link>
        <Link href="/deliverables" className="group">
          <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-sm font-medium text-[var(--cc-secondary)]">Entregáveis em atraso</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--cc-foreground)]">{overdueDeliverables}</p>
            <p className="mt-2 text-xs text-[var(--cc-secondary)]">Calculado pelos prazos registados no PCC</p>
          </Card>
        </Link>
        <Link href="/metrics" className="group">
          <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-sm font-medium text-[var(--cc-secondary)]">Métricas registadas</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--cc-foreground)]">{metrics.length}</p>
            <p className="mt-2 text-xs text-[var(--cc-secondary)]">Últimos valores medidos</p>
          </Card>
        </Link>
      </div>

      <div className="mt-7 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <div className="border-b border-slate-200 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-950">Execução</h2>
                <p className="mt-1 text-sm text-slate-500">Acções abertas ordenadas por prazo.</p>
              </div>
              <Link className="text-sm font-medium text-blue-700 hover:underline" href="/actions">
                Ver todas
              </Link>
            </div>
          </div>
          <div className="p-5">
            {actions.length === 0 ? (
              <EmptyState>Não existem acções abertas.</EmptyState>
            ) : (
              <div className="divide-y divide-slate-100">
                {actions.map((action) => (
                  <Link
                    key={action.id}
                    href="/actions"
                    className="flex flex-col gap-3 rounded-xl py-4 transition hover:bg-[var(--cc-surface-muted)] first:pt-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">{action.title}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                        <Clock3 size={13} />
                        {formatDateTime(action.due_at)}
                      </p>
                    </div>
                    <StatusBadge status={action.status} />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
              Next best action
            </p>
            {nextActionResult.data ? (
              <div className="mt-3">
                <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                  {nextActionResult.data.title}
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Prazo: {formatDateTime(nextActionResult.data.due_at)}
                </p>
                {nextActionResult.data.completion_criteria && (
                  <p className="mt-3 text-sm leading-6 text-slate-700">
                    Critério: {nextActionResult.data.completion_criteria}
                  </p>
                )}
                <Link
                  href="/focus"
                  className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-700"
                >
                  Entrar em modo foco <ArrowRight size={16} />
                </Link>
              </div>
            ) : (
              <div className="mt-3">
                <p className="text-sm leading-6 text-slate-600">
                  Ainda não definiu uma próxima acção.
                </p>
                <Link
                  href="/actions"
                  className="mt-4 inline-flex text-sm font-semibold text-blue-700"
                >
                  Escolher uma acção
                </Link>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="font-semibold text-slate-950">Bloqueios</h2>
            <div className="mt-3 space-y-3">
              {blockers.length === 0 ? (
                <p className="text-sm text-slate-500">Sem bloqueios activos.</p>
              ) : (
                blockers.slice(0, 4).map((blocker) => (
                  <Link
                    key={blocker.id}
                    href="/blockers"
                    className="block rounded-xl bg-red-50 px-3.5 py-3 transition hover:bg-red-100"
                  >
                    <p className="text-sm font-medium text-red-900">{blocker.title}</p>
                    <p className="mt-1 text-xs text-red-700">{blocker.status}</p>
                  </Link>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-7 grid gap-6 xl:grid-cols-2">
        <Card>
          <div className="border-b border-[var(--cc-border)] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-[var(--cc-foreground)]">Métricas recentes</h2>
                <p className="mt-1 text-sm text-[var(--cc-secondary)]">Últimos valores registados no PCC.</p>
              </div>
              <Link href="/metrics" className="text-sm font-semibold text-[var(--cc-accent)]">Abrir métricas</Link>
            </div>
          </div>
          <div className="p-5">
            {metrics.length === 0 ? (
              <EmptyState>Não existem métricas registadas.</EmptyState>
            ) : (
              <div className="space-y-3">
                {metrics.map((metric) => (
                  <Link key={metric.id} href="/metrics" className="block rounded-xl border border-[var(--cc-border)] p-4 transition hover:bg-[var(--cc-surface-muted)]">
                    <p className="font-medium text-[var(--cc-foreground)]">{metric.name}</p>
                    <p className="mt-1 text-sm text-[var(--cc-secondary)]">
                      Actual: {metric.current_value ?? "—"} {metric.unit ?? ""} · Alvo: {metric.target_value ?? "—"}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className="border-b border-[var(--cc-border)] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-[var(--cc-foreground)]">Decisões recentes</h2>
                <p className="mt-1 text-sm text-[var(--cc-secondary)]">Últimas decisões registadas no sistema.</p>
              </div>
              <Link href="/decisions" className="text-sm font-semibold text-[var(--cc-accent)]">Abrir decisões</Link>
            </div>
          </div>
          <div className="p-5">
            {decisions.length === 0 ? (
              <EmptyState>Não existem decisões registadas.</EmptyState>
            ) : (
              <div className="space-y-3">
                {decisions.map((item) => (
                  <Link key={item.id} href="/decisions" className="block rounded-xl border border-[var(--cc-border)] p-4 transition hover:bg-[var(--cc-surface-muted)]">
                    <p className="font-medium text-[var(--cc-foreground)]">{item.title}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-[var(--cc-secondary)]">{item.decision}</p>
                    <p className="mt-2 text-xs text-[var(--cc-tertiary)]">{formatDateTime(item.decided_at)}</p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
