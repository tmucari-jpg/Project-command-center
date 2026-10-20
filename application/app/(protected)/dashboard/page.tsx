import Link from "next/link";
import { ArrowRight, CalendarClock, Clock3, UserRoundCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, EmptyState } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { displayLabel } from "@/lib/display-label";
import { formatDate, formatDateTime } from "@/lib/format";
import { executiveProjectHealth, isProjectPlanStale } from "@/lib/project-metrics";
import { GOVERNANCE_GATE_LABELS, GOVERNANCE_STATUS_LABELS } from "@/lib/governance";

export default async function DashboardPage() {
  const { supabase, user } = await requireUser();

  const [
    objectivesResult,
    projectsResult,
    actionsResult,
    actionsSummaryResult,
    blockersResult,
    metricsResult,
    metricsCountResult,
    decisionsResult,
    decisionsCountResult,
    nextActionResult,
    dependenciesResult,
    plansResult,
    economicsResult,
    profilesResult,
    evidenceFreshnessResult,
    decisionFreshnessResult,
  ] = await Promise.all([
    supabase.from("objectives").select("id,status,progress", { count: "exact" }).eq("user_id", user.id),
    supabase.from("projects").select("id,title,status,progress,due_date,updated_at,owner_id,next_review_date,review_cadence_days,governance_gate,governance_gate_status", { count: "exact" }).eq("user_id", user.id),
    supabase
      .from("actions")
      .select("id,title,status,due_at,priority,actual_minutes,projects(title)")
      .eq("user_id", user.id)
      .neq("status", "completed")
      .neq("status", "cancelled")
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(6),
    supabase
      .from("actions")
      .select("id,due_at")
      .eq("user_id", user.id)
      .neq("status", "completed")
      .neq("status", "cancelled"),
    supabase
      .from("blockers")
      .select("id,status,impact,title,project_id")
      .eq("user_id", user.id)
      .in("status", ["open", "investigating", "waiting"]),
    supabase
      .from("metrics")
      .select("id,name,current_value,target_value,unit,measurement_date,projects(title),objectives(title)")
      .eq("user_id", user.id)
      .order("measurement_date", { ascending: false, nullsFirst: false })
      .limit(5),
    supabase
      .from("metrics")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("decisions")
      .select("id,title,decision,decided_at,projects(title)")
      .eq("user_id", user.id)
      .order("decided_at", { ascending: false })
      .limit(5),
    supabase
      .from("decisions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("actions")
      .select("id,title,priority,due_at,completion_criteria,projects(title)")
      .eq("user_id", user.id)
      .eq("is_next_action", true)
      .maybeSingle(),
    supabase
      .from("project_governance_dependencies")
      .select("id,project_id,status,owner_role,kind,blocks_progress")
      .eq("user_id", user.id)
      .in("status", ["pending", "resolving"]),
    supabase
      .from("project_strategy_execution_plans")
      .select("project_id,updated_at,missing_items,status")
      .eq("user_id", user.id),
    supabase
      .from("project_unit_economics")
      .select("project_id,cac,conversion_rate_pct,arpu,gross_margin_pct,payback_months,currency,updated_at")
      .eq("user_id", user.id),
    supabase
      .from("profiles")
      .select("id,full_name"),
    supabase
      .from("evidence")
      .select("project_id,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("decisions")
      .select("project_id,decided_at")
      .eq("user_id", user.id)
      .order("decided_at", { ascending: false }),
  ]);

  const objectives = objectivesResult.data ?? [];
  const projects = projectsResult.data ?? [];
  const actions = actionsResult.data ?? [];
  const openActions = actionsSummaryResult.data ?? [];
  const blockers = blockersResult.data ?? [];
  const metrics = metricsResult.data ?? [];
  const decisions = decisionsResult.data ?? [];
  const dependencies = dependenciesResult.data ?? [];
  const plans = plansResult.data ?? [];
  const economics = economicsResult.data ?? [];
  const profiles = profilesResult.data ?? [];
  const evidenceFreshness = evidenceFreshnessResult.data ?? [];
  const decisionFreshness = decisionFreshnessResult.data ?? [];

  const ownerById = new Map(profiles.map((profile) => [profile.id, profile.full_name || "Utilizador"]));
  const planByProject = new Map(plans.map((plan) => [plan.project_id, plan]));
  const latestEvidenceByProject = new Map<string, string>();
  const latestDecisionByProject = new Map<string, string>();

  for (const item of evidenceFreshness) {
    if (item.project_id && !latestEvidenceByProject.has(item.project_id)) {
      latestEvidenceByProject.set(item.project_id, item.created_at);
    }
  }
  for (const item of decisionFreshness) {
    if (item.project_id && item.decided_at && !latestDecisionByProject.has(item.project_id)) {
      latestDecisionByProject.set(item.project_id, item.decided_at);
    }
  }

  const executiveProjects = projects
    .map((project) => {
      const projectBlockers = blockers.filter((item) => item.project_id === project.id).length;
      const projectDependencies = dependencies.filter((item) => item.project_id === project.id).length;
      const plan = planByProject.get(project.id);
      const planStale = isProjectPlanStale(plan?.updated_at, {
        latestEvidenceAt: latestEvidenceByProject.get(project.id),
        latestDecisionAt: latestDecisionByProject.get(project.id),
      });
      const health = executiveProjectHealth({
        progress: Number(project.progress ?? 0),
        dueDate: project.due_date,
        openBlockers: projectBlockers,
        activeDependencies: projectDependencies,
        nextReviewDate: project.next_review_date,
        planStale,
        gateStatus: project.governance_gate_status,
        hasOwner: Boolean(project.owner_id),
      });
      const attention: string[] = [];
      if (!project.owner_id) attention.push("sem responsável");
      if (health.reviewOverdue) attention.push("revisão vencida");
      if (projectBlockers > 0) attention.push(`${projectBlockers} bloqueio(s)`);
      if (projectDependencies > 0) attention.push(`${projectDependencies} dependência(s)`);
      if (planStale) attention.push("plano desactualizado");
      if (project.governance_gate_status === "blocked") attention.push("Gate bloqueado");

      const attentionScore =
        (health.status === "delayed" ? 40 : health.status === "at_risk" ? 25 : 0) +
        (health.reviewOverdue ? 20 : 0) +
        projectBlockers * 8 +
        projectDependencies * 4 +
        (planStale ? 6 : 0) +
        (project.governance_gate_status === "blocked" ? 15 : 0) +
        (!project.owner_id ? 6 : 0);

      return {
        ...project,
        ownerName: project.owner_id ? ownerById.get(project.owner_id) ?? "Responsável definido" : "Sem responsável",
        planStale,
        health,
        attention,
        attentionScore,
      };
    })
    .sort((a, b) => b.attentionScore - a.attentionScore || a.title.localeCompare(b.title));

  const activeObjectives = objectives.filter((item) =>
    ["active", "on_track", "at_risk", "delayed"].includes(item.status),
  ).length;
  const activeProjects = projects.filter((item) =>
    ["planning", "active", "at_risk", "on_hold"].includes(item.status),
  ).length;
  const atRiskProjects = projects.filter((item) => item.status === "at_risk").length;
  const projectsNeedingAttention = executiveProjects.filter((item) => item.attention.length > 0).length;

  const now = new Date();
  const overdueActions = openActions.filter((item) => item.due_at && new Date(item.due_at) < now).length;

  return (
    <>
      <PageHeader
        eyebrow="Visão executiva"
        title="Painel"
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

        <Link href="/projects" className="group">
          <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:shadow-md sm:p-6">
            <p className="text-sm font-medium text-[var(--cc-secondary)]">Projectos a rever</p>
            <p className="mt-2 text-[2rem] font-semibold leading-none tracking-[-0.03em] text-[var(--cc-foreground)]">{projectsNeedingAttention}</p>
            <p className="mt-3 text-xs text-[var(--cc-secondary)]">Responsabilidade, revisão, risco, dependências ou decisão</p>
            <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--cc-accent)]">
              Rever projectos <ArrowRight size={13} />
            </p>
          </Card>
        </Link>
      </div>

      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link href="/actions" className="group">
          <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-sm font-medium text-[var(--cc-secondary)]">Acções abertas</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--cc-foreground)]">{openActions.length}</p>
            <p className="mt-2 text-xs text-[var(--cc-secondary)]">{overdueActions} em atraso</p>
          </Card>
        </Link>
        <Link href="/actions" className="group">
          <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-sm font-medium text-[var(--cc-secondary)]">Acções em atraso</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--cc-foreground)]">{overdueActions}</p>
          </Card>
        </Link>
        <Link href="/metrics" className="group">
          <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-sm font-medium text-[var(--cc-secondary)]">Métricas registadas</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--cc-foreground)]">{metricsCountResult.count ?? 0}</p>
          </Card>
        </Link>
        <Link href="/decisions" className="group">
          <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-sm font-medium text-[var(--cc-secondary)]">Decisões registadas</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--cc-foreground)]">{decisionsCountResult.count ?? 0}</p>
          </Card>
        </Link>
      </div>

      <Card className="mt-7">
        <div className="border-b border-[var(--cc-border)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-[var(--cc-foreground)]">Controlo dos projectos</h2>
              <p className="mt-1 text-sm text-[var(--cc-secondary)]">
                Ordenado pelo que exige intervenção primeiro.
              </p>
            </div>
            <Link href="/projects" className="text-sm font-semibold text-[var(--cc-accent)]">
              Abrir projectos
            </Link>
          </div>
        </div>
        <div className="divide-y divide-[var(--cc-border)]">
          {executiveProjects.length === 0 ? (
            <div className="p-5"><EmptyState>Não existem projectos registados.</EmptyState></div>
          ) : (
            executiveProjects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="grid gap-3 p-5 transition hover:bg-[var(--cc-surface-muted)] lg:grid-cols-[1.35fr_0.8fr_0.8fr_0.9fr]"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-[var(--cc-foreground)]">{project.title}</p>
                    <StatusBadge status={project.health.status} />
                    {project.planStale && (
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800">
                        plano desactualizado
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-[var(--cc-secondary)]">
                    {project.attention.length ? project.attention.join(" · ") : "Sem intervenção imediata"}
                  </p>
                  <p className="mt-1 text-xs text-[var(--cc-tertiary)]">
                    {GOVERNANCE_GATE_LABELS[project.governance_gate] ?? project.governance_gate} · {GOVERNANCE_STATUS_LABELS[project.governance_gate_status] ?? project.governance_gate_status}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-tertiary)]">Responsável</p>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-[var(--cc-foreground)]">
                    <UserRoundCheck size={14} /> {project.ownerName}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-tertiary)]">Próxima revisão</p>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-[var(--cc-foreground)]">
                    <CalendarClock size={14} /> {project.next_review_date ? formatDate(project.next_review_date) : "Não definida"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-tertiary)]">Etapa de decisão</p>
                  <p className="mt-1 text-sm text-[var(--cc-foreground)]">
                    {displayLabel(project.governance_gate ?? "validate")} · {displayLabel(project.governance_gate_status ?? "pending")}
                  </p>
                  <p className="mt-1 text-xs text-[var(--cc-secondary)]">Saúde {project.health.score}%</p>
                </div>
              </Link>
            ))
          )}
        </div>
      </Card>

      <div className="mt-7 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <div className="border-b border-slate-200 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-950">Execução</h2>
              </div>
              <Link className="text-sm font-medium text-[var(--cc-accent)] hover:underline" href="/actions">
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
          <Card className="cc-brand-pattern overflow-hidden border-[color-mix(in_srgb,var(--cc-gold)_35%,var(--cc-border))] bg-[var(--cc-accent)] p-5 text-white shadow-[var(--cc-shadow-md)]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--cc-gold-soft)]">
              Próxima melhor acção
            </p>
            {nextActionResult.data ? (
              <div className="mt-3">
                <h2 className="text-xl font-semibold tracking-tight text-white">
                  {nextActionResult.data.title}
                </h2>
                <p className="mt-2 text-sm text-white/70">
                  Prazo: {formatDateTime(nextActionResult.data.due_at)}
                </p>
                {nextActionResult.data.completion_criteria && (
                  <p className="mt-3 text-sm leading-6 text-white/82">
                    Critério: {nextActionResult.data.completion_criteria}
                  </p>
                )}
                <Link
                  href="/focus"
                  className="mt-5 inline-flex items-center gap-2 rounded-[12px] bg-[var(--cc-gold)] px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Entrar em modo foco <ArrowRight size={16} />
                </Link>
              </div>
            ) : (
              <div className="mt-3">
                <p className="text-sm leading-6 text-white/75">
                  Ainda não definiu uma próxima acção.
                </p>
                <Link
                  href="/actions"
                  className="mt-4 inline-flex text-sm font-semibold text-[var(--cc-gold-soft)]"
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
                    <p className="mt-1 text-xs text-red-700">{displayLabel(blocker.status)}</p>
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
