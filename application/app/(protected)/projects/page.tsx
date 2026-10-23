import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, EmptyState, secondaryButtonClass } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { displayLabel } from "@/lib/display-label";
import { formatDate } from "@/lib/format";
import { projectHealth } from "@/lib/project-metrics";

const FACTORY_STAGE_LABELS: Record<string, string> = {
  new_idea: "Ideia recebida",
  viability: "Em avaliação",
  competitive_intelligence: "Análise de mercado",
  validation: "Avaliação de viabilidade",
  execution_arena: "Teste",
  factory_report: "Síntese para decisão",
  decision: "Decisão",
  converted_to_project: "Aprovado",
  on_hold: "Adiado",
  killed: "Não aprovado",
};

function relationTitle(relation: { title?: string | null } | { title?: string | null }[] | null | undefined) {
  return Array.isArray(relation) ? relation[0]?.title : relation?.title;
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string; view?: string }>;
}) {
  const params = await searchParams;
  const view = ["all", "active", "analysis", "closed"].includes(params.view ?? "")
    ? params.view!
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
      .select("*, objectives(title)")
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
      .neq("status", "completed")
      .neq("status", "cancelled"),
    supabase
      .from("project_factory_cases")
      .select("id,title,problem,stage,project_type,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const now = new Date();
  const blockerCounts = new Map<string, number>();
  const openActionCounts = new Map<string, number>();
  const overdueActionCounts = new Map<string, number>();
  const nextActionByProject = new Map<string, string>();

  for (const blocker of blockers ?? []) {
    if (!blocker.project_id) continue;
    blockerCounts.set(blocker.project_id, (blockerCounts.get(blocker.project_id) ?? 0) + 1);
  }

  for (const action of actions ?? []) {
    if (!action.project_id) continue;
    openActionCounts.set(action.project_id, (openActionCounts.get(action.project_id) ?? 0) + 1);
    if (action.due_at && new Date(action.due_at) < now) {
      overdueActionCounts.set(action.project_id, (overdueActionCounts.get(action.project_id) ?? 0) + 1);
    }
    if (action.is_next_action && !nextActionByProject.has(action.project_id)) {
      nextActionByProject.set(action.project_id, action.title);
    }
  }

  const analysisCases = (factoryCases ?? []).filter(
    (item) => !["converted_to_project", "killed"].includes(item.stage),
  );
  const closedCases = (factoryCases ?? []).filter((item) => item.stage === "killed");
  const activeProjects = (projects ?? []).filter(
    (project) => !["completed", "cancelled"].includes(project.status),
  );
  const closedProjects = (projects ?? []).filter(
    (project) => ["completed", "cancelled"].includes(project.status),
  );

  const tabs = [
    { value: "all", label: "Todos", count: (projects?.length ?? 0) + (factoryCases?.length ?? 0) },
    { value: "active", label: "Em aberto", count: activeProjects.length },
    { value: "analysis", label: "Em análise", count: analysisCases.length },
    { value: "closed", label: "Não seguiram / fechados", count: closedCases.length + closedProjects.length },
  ];

  const showActive = view === "all" || view === "active";
  const showAnalysis = view === "all" || view === "analysis";
  const showClosed = view === "all" || view === "closed";

  return (
    <>
      <PageHeader eyebrow="Portfólio" title="Projectos" />

      {(error || factoryError) && (
        <Card className="mb-5 p-4 text-sm text-[var(--cc-danger)]">
          {error?.message ?? factoryError?.message}
        </Card>
      )}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <Link
              key={tab.value}
              href={`/projects?view=${tab.value}`}
              className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
                view === tab.value
                  ? "bg-[var(--cc-accent)] text-white"
                  : "border border-[var(--cc-border)] bg-[var(--cc-surface)] text-[var(--cc-foreground)]"
              }`}
            >
              {tab.label} · {tab.count}
            </Link>
          ))}
        </div>
        <Link className={secondaryButtonClass} href="/project-factory">Novo projecto</Link>
      </div>

      <div className="space-y-5">
        {showAnalysis && (
          <Card>
            <div className="border-b border-[var(--cc-border)] p-5">
              <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Em análise</h2>
              <p className="mt-1 text-sm text-[var(--cc-secondary)]">
                Iniciativas ainda sem aprovação para planeamento ou execução.
              </p>
            </div>
            <div className="p-5">
              {!analysisCases.length ? (
                <EmptyState>Não existem projectos em avaliação.</EmptyState>
              ) : (
                <div className="space-y-2">
                  {analysisCases.map((item) => (
                    <details key={item.id} className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)]">
                      <summary className="cursor-pointer list-none p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h3 className="font-semibold text-[var(--cc-foreground)]">{item.title}</h3>
                            <p className="mt-1 text-xs text-[var(--cc-secondary)]">
                              {FACTORY_STAGE_LABELS[item.stage] ?? item.stage}
                            </p>
                          </div>
                          <span className="rounded-full bg-[var(--cc-surface-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--cc-secondary)]">
                            {item.project_type === "commercial" ? "Comercial" : "Interno"}
                          </span>
                        </div>
                      </summary>
                      <div className="border-t border-[var(--cc-border)] p-4">
                        {item.problem && (
                          <p className="text-sm leading-6 text-[var(--cc-foreground)]">{item.problem}</p>
                        )}
                        <Link className={secondaryButtonClass + " mt-4"} href={`/project-factory/${item.id}`}>
                          Continuar avaliação
                        </Link>
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </div>
          </Card>
        )}

        {showActive && (
          <Card>
            <div className="border-b border-[var(--cc-border)] p-5">
              <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Em aberto</h2>
              <p className="mt-1 text-sm text-[var(--cc-secondary)]">
                Projectos aprovados em planeamento, execução ou acompanhamento.
              </p>
            </div>
            <div className="p-5">
              {!activeProjects.length ? (
                <EmptyState>Não existem projectos em aberto.</EmptyState>
              ) : (
                <div className="space-y-2">
                  {activeProjects.map((project) => {
                    const blockerCount = blockerCounts.get(project.id) ?? 0;
                    const overdueCount = overdueActionCounts.get(project.id) ?? 0;
                    const openCount = openActionCounts.get(project.id) ?? 0;
                    const health = projectHealth({
                      progress: Number(project.progress ?? 0),
                      dueDate: project.due_date,
                      openBlockers: blockerCount,
                      overdueActions: overdueCount,
                    });
                    const nextAction = nextActionByProject.get(project.id) ?? project.next_action;

                    return (
                      <details key={project.id} className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)]">
                        <summary className="cursor-pointer list-none p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <Link
                                  href={`/projects/${project.id}`}
                                  className="font-semibold text-[var(--cc-foreground)] hover:underline"
                                >
                                  {project.title}
                                </Link>
                                <StatusBadge status={health} />
                              </div>
                              <p className="mt-1 text-xs text-[var(--cc-secondary)]">
                                {displayLabel(project.status)}
                                {openCount > 0 ? ` · ${openCount} aberta(s)` : ""}
                                {overdueCount > 0 ? ` · ${overdueCount} em atraso` : ""}
                                {blockerCount > 0 ? ` · ${blockerCount} bloqueio(s)` : ""}
                              </p>
                              {nextAction && (
                                <p className="mt-2 text-sm text-[var(--cc-foreground)]">
                                  <span className="font-medium">Próxima:</span> {nextAction}
                                </p>
                              )}
                            </div>
                            <span className="text-xs font-semibold text-[var(--cc-accent)]">Ver detalhes</span>
                          </div>
                        </summary>
                        <div className="grid gap-3 border-t border-[var(--cc-border)] p-4 sm:grid-cols-2">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-secondary)]">Prazo</p>
                            <p className="mt-1 text-sm text-[var(--cc-foreground)]">{project.due_date ? formatDate(project.due_date) : "Sem prazo"}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-secondary)]">Progresso</p>
                            <p className="mt-1 text-sm text-[var(--cc-foreground)]">{Number(project.progress ?? 0)}%</p>
                          </div>
                          <div className="flex items-end justify-end sm:col-span-2">
                            <Link className={secondaryButtonClass} href={`/projects/${project.id}`}>Abrir projecto</Link>
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

        {showClosed && (
          <Card>
            <div className="border-b border-[var(--cc-border)] p-5">
              <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Não seguiram / fechados</h2>
              <p className="mt-1 text-sm text-[var(--cc-secondary)]">
                Histórico preservado para manter a decisão e a aprendizagem do portfólio.
              </p>
            </div>
            <div className="p-5">
              {!closedCases.length && !closedProjects.length ? (
                <EmptyState>Não existem projectos nesta categoria.</EmptyState>
              ) : (
                <div className="space-y-2">
                  {closedCases.map((item) => (
                    <div key={item.id} className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-4">
                      <h3 className="font-semibold text-[var(--cc-foreground)]">{item.title}</h3>
                      <p className="mt-1 text-xs text-[var(--cc-secondary)]">{FACTORY_STAGE_LABELS[item.stage] ?? item.stage}</p>
                      {item.problem && <p className="mt-2 text-sm text-[var(--cc-secondary)]">{item.problem}</p>}
                    </div>
                  ))}
                  {closedProjects.map((project) => (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      className="block rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-4 hover:bg-[var(--cc-surface-muted)]"
                    >
                      <h3 className="font-semibold text-[var(--cc-foreground)]">{project.title}</h3>
                      <p className="mt-1 text-xs text-[var(--cc-secondary)]">{displayLabel(project.status)} · histórico disponível</p>
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
