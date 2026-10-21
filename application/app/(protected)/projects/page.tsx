import Link from "next/link";
import { DeleteForm } from "@/components/delete-form";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { StatusProgressForm } from "@/components/status-progress-form";
import { Card, EmptyState, primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { displayLabel } from "@/lib/display-label";
import { formatDate } from "@/lib/format";
import { projectHealth } from "@/lib/project-metrics";
import { StatusBadge } from "@/components/status-badge";

type PortfolioView = "all" | "open" | "analysis" | "stopped";

const FACTORY_STAGE_LABELS: Record<string, string> = {
  new_idea: "Ideia recebida",
  viability: "Em análise",
  competitive_intelligence: "Análise de mercado",
  validation: "Validação",
  execution_arena: "Teste",
  factory_report: "Preparação da decisão",
  decision: "Decisão",
  on_hold: "Em espera",
  killed: "Não seguiu",
};

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string; view?: string }>;
}) {
  const params = await searchParams;
  const view: PortfolioView =
    params.view === "open" || params.view === "analysis" || params.view === "stopped"
      ? params.view
      : "all";

  const { supabase, user } = await requireUser();
  const [
    { data: projects, error },
    { data: blockers },
    { data: actions },
    { data: factoryCases, error: factoryError },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("*, objectives(title,expected_result)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("blockers")
      .select("project_id,status")
      .eq("user_id", user.id)
      .in("status", ["open", "investigating", "waiting"]),
    supabase
      .from("actions")
      .select("project_id,status,due_at,is_next_action,title")
      .eq("user_id", user.id)
      .neq("status", "cancelled"),
    supabase
      .from("project_factory_cases")
      .select("id,title,problem,stage,project_type,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const now = new Date();
  const blockerCounts = new Map<string, number>();
  for (const blocker of blockers ?? []) {
    if (!blocker.project_id) continue;
    blockerCounts.set(blocker.project_id, (blockerCounts.get(blocker.project_id) ?? 0) + 1);
  }

  const overdueActionCounts = new Map<string, number>();
  const nextActionByProject = new Map<string, string>();
  for (const action of actions ?? []) {
    if (!action.project_id) continue;
    if (action.is_next_action && !["completed", "cancelled"].includes(action.status)) {
      nextActionByProject.set(action.project_id, action.title);
    }
    if (
      action.due_at &&
      new Date(action.due_at) < now &&
      !["completed", "cancelled"].includes(action.status)
    ) {
      overdueActionCounts.set(action.project_id, (overdueActionCounts.get(action.project_id) ?? 0) + 1);
    }
  }

  const analysisCases = (factoryCases ?? []).filter(
    (item) => !["converted_to_project", "killed"].includes(item.stage),
  );
  const stoppedCases = (factoryCases ?? []).filter((item) => item.stage === "killed");
  const openProjects = (projects ?? []).filter((project) => !["completed", "cancelled"].includes(project.status));
  const stoppedProjects = (projects ?? []).filter((project) => project.status === "cancelled");

  const showOpen = view === "all" || view === "open";
  const showAnalysis = view === "all" || view === "analysis";
  const showStopped = view === "all" || view === "stopped";

  const tabClass = (current: PortfolioView) => view === current ? primaryButtonClass : secondaryButtonClass;

  return (
    <>
      <PageHeader eyebrow="Portfólio" title="Projectos" />
      <FlashMessage error={params.error ?? error?.message ?? factoryError?.message} created={params.created} />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Link className={tabClass("all")} href="/projects">Todos</Link>
          <Link className={tabClass("open")} href="/projects?view=open">Em aberto</Link>
          <Link className={tabClass("analysis")} href="/projects?view=analysis">Em análise</Link>
          <Link className={tabClass("stopped")} href="/projects?view=stopped">Não seguiram</Link>
        </div>
        <Link className={primaryButtonClass} href="/project-factory">Novo projecto</Link>
      </div>

      <div className="space-y-6">
        {showAnalysis && (
          <Card>
            <div className="border-b border-[var(--cc-border)] p-5">
              <h2 className="font-semibold text-[var(--cc-foreground)]">Em análise</h2>
            </div>
            <div className="p-5">
              {!analysisCases.length ? (
                <EmptyState>Não existem projectos em análise.</EmptyState>
              ) : (
                <div className="space-y-2">
                  {analysisCases.map((item) => (
                    <details key={item.id} className="rounded-[var(--cc-radius-lg)] border border-[var(--cc-border)]">
                      <summary className="cursor-pointer list-none p-4">
                        <div className="grid gap-2 md:grid-cols-[1.3fr_0.7fr_auto] md:items-center">
                          <div>
                            <h3 className="font-semibold">{item.title}</h3>
                            <p className="mt-1 text-xs text-[var(--cc-secondary)]">{FACTORY_STAGE_LABELS[item.stage] ?? item.stage}</p>
                          </div>
                          <span className="text-sm text-[var(--cc-secondary)]">{item.project_type === "commercial" ? "Comercial" : "Interno"}</span>
                          <span className="text-sm font-semibold text-[var(--cc-accent)]">Ver detalhes</span>
                        </div>
                      </summary>
                      <div className="border-t border-[var(--cc-border)] p-4">
                        {item.problem && <p className="text-sm leading-6 text-[var(--cc-foreground)]">{item.problem}</p>}
                        <Link className="mt-4 inline-flex font-semibold text-[var(--cc-accent)]" href={`/project-factory/${item.id}`}>
                          Continuar avaliação →
                        </Link>
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </div>
          </Card>
        )}

        {showOpen && (
          <Card>
            <div className="border-b border-[var(--cc-border)] p-5">
              <h2 className="font-semibold text-[var(--cc-foreground)]">Em aberto</h2>
            </div>
            <div className="p-5">
              {!openProjects.length ? (
                <EmptyState>Não existem projectos em aberto.</EmptyState>
              ) : (
                <div className="space-y-2">
                  {openProjects.map((project) => {
                    const blockersCount = blockerCounts.get(project.id) ?? 0;
                    const overdue = overdueActionCounts.get(project.id) ?? 0;
                    const health = projectHealth({
                      progress: Number(project.progress ?? 0),
                      dueDate: project.due_date,
                      openBlockers: blockersCount,
                      overdueActions: overdue,
                    });
                    const objective = Array.isArray(project.objectives) ? project.objectives[0] : project.objectives;
                    const nextAction = nextActionByProject.get(project.id) ?? project.next_action;

                    return (
                      <details key={project.id} className="rounded-[var(--cc-radius-lg)] border border-[var(--cc-border)]">
                        <summary className="cursor-pointer list-none p-4">
                          <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr_1fr_auto] md:items-center">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold">{project.title}</h3>
                              {(project.due_date || blockersCount || overdue) && <StatusBadge status={health} />}
                            </div>
                            <p className="text-sm text-[var(--cc-secondary)]">{displayLabel(project.status)}</p>
                            <p className="text-sm text-[var(--cc-foreground)]"><span className="font-medium">Próxima:</span> {nextAction || "por definir"}</p>
                            <span className="text-sm font-semibold text-[var(--cc-accent)]">Ver detalhes</span>
                          </div>
                        </summary>
                        <div className="space-y-4 border-t border-[var(--cc-border)] p-4">
                          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <div><p className="text-xs font-semibold uppercase text-[var(--cc-secondary)]">Objectivo Central</p><p className="mt-1 text-sm">{objective?.title ?? "Por definir"}</p></div>
                            <div><p className="text-xs font-semibold uppercase text-[var(--cc-secondary)]">Prazo</p><p className="mt-1 text-sm">{project.due_date ? formatDate(project.due_date) : "Sem prazo"}</p></div>
                            <div><p className="text-xs font-semibold uppercase text-[var(--cc-secondary)]">Em atraso</p><p className="mt-1 text-sm">{overdue}</p></div>
                            <div><p className="text-xs font-semibold uppercase text-[var(--cc-secondary)]">Bloqueios</p><p className="mt-1 text-sm">{blockersCount}</p></div>
                          </div>
                          {objective?.expected_result && <p className="text-sm text-[var(--cc-secondary)]">{objective.expected_result}</p>}
                          <div className="flex flex-wrap items-center gap-3">
                            <Link className={primaryButtonClass} href={`/projects/${project.id}`}>Abrir projecto</Link>
                            <div className="min-w-[260px] flex-1">
                              <StatusProgressForm entity="projects" id={project.id} status={project.status} progress={project.progress} />
                            </div>
                            <DeleteForm table="projects" id={project.id} />
                          </div>
                        </div>
                      </details>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>
        )}

        {showStopped && (
          <Card>
            <div className="border-b border-[var(--cc-border)] p-5">
              <h2 className="font-semibold text-[var(--cc-foreground)]">Não seguiram</h2>
            </div>
            <div className="p-5">
              {!stoppedCases.length && !stoppedProjects.length ? (
                <EmptyState>Não existem iniciativas encerradas ou não aprovadas.</EmptyState>
              ) : (
                <div className="space-y-2">
                  {stoppedCases.map((item) => (
                    <details key={item.id} className="rounded-[var(--cc-radius-lg)] border border-[var(--cc-border)]">
                      <summary className="cursor-pointer list-none p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div><h3 className="font-semibold">{item.title}</h3><p className="mt-1 text-xs text-[var(--cc-secondary)]">Não aprovado na avaliação</p></div>
                          <span className="text-sm font-semibold text-[var(--cc-accent)]">Histórico</span>
                        </div>
                      </summary>
                      <div className="border-t border-[var(--cc-border)] p-4">
                        <p className="text-sm">{item.problem || "Sem resumo disponível."}</p>
                        <Link className="mt-3 inline-flex text-sm font-semibold text-[var(--cc-accent)]" href={`/project-factory/${item.id}`}>Ver avaliação →</Link>
                      </div>
                    </details>
                  ))}
                  {stoppedProjects.map((project) => (
                    <Link key={project.id} href={`/projects/${project.id}`} className="block rounded-[var(--cc-radius-lg)] border border-[var(--cc-border)] p-4">
                      <h3 className="font-semibold">{project.title}</h3>
                      <p className="mt-1 text-xs text-[var(--cc-secondary)]">Projecto cancelado · histórico preservado</p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
