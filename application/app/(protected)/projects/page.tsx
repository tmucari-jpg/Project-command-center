import Link from "next/link";
import { DeleteForm } from "@/components/delete-form";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { StatusProgressForm } from "@/components/status-progress-form";
import { Card, EmptyState, primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { projectHealth } from "@/lib/project-metrics";
import { StatusBadge } from "@/components/status-badge";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();

  const [{ data: projects, error }, { data: blockers }] = await Promise.all([
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
  ]);

  const blockerCounts = new Map<string, number>();
  (blockers ?? []).forEach((blocker) => {
    if (!blocker.project_id) return;
    blockerCounts.set(blocker.project_id, (blockerCounts.get(blocker.project_id) ?? 0) + 1);
  });

  return (
    <>
      <PageHeader
        eyebrow="Portfólio"
        title="Projectos"
        description="Acompanhe os projectos já aprovados e em execução. Novos projectos entram pela Project Factory para serem estruturados antes da criação."
      />
      <FlashMessage error={params.error ?? error?.message} created={params.created} />

      <Card className="mb-6 p-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Quer iniciar um novo projecto?</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--cc-secondary)]">
              Diga apenas o que pretende fazer. A Factory organiza a ideia e prepara o projecto para revisão.
            </p>
          </div>
          <Link href="/project-factory" className={primaryButtonClass}>
            Novo projecto
          </Link>
        </div>
      </Card>

      <Card>
        <div className="border-b border-[var(--cc-border)] p-5">
          <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Projectos registados</h2>
        </div>
        <div className="p-5">
          {!projects?.length ? (
            <EmptyState>
              Ainda não existem projectos. Use “Novo projecto” para iniciar pela Project Factory.
            </EmptyState>
          ) : (
            <div className="space-y-4">
              {projects.map((project) => {
                const health = projectHealth({
                  progress: Number(project.progress ?? 0),
                  dueDate: project.due_date,
                  openBlockers: blockerCounts.get(project.id) ?? 0,
                });

                return (
                  <article key={project.id} className="rounded-2xl border border-[var(--cc-border)] p-4">
                    <div className="flex flex-col justify-between gap-3 md:flex-row">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-[var(--cc-foreground)]">{project.title}</h3>
                          <StatusBadge status={health} />
                        </div>
                        <p className="mt-1 text-sm text-[var(--cc-secondary)]">
                          Prazo {formatDate(project.due_date)} · Prioridade {project.priority}
                        </p>
                        {project.objectives?.title && (
                          <p className="mt-1 text-xs text-[var(--cc-accent)]">
                            Objectivo: {project.objectives.title}
                          </p>
                        )}
                        {project.next_action && (
                          <p className="mt-3 text-sm leading-6 text-[var(--cc-foreground)]">
                            <span className="font-medium">Próximo passo:</span> {project.next_action}
                          </p>
                        )}
                      </div>
                      <div className="flex items-start gap-2">
                        <Link className={secondaryButtonClass} href={`/projects/${project.id}`}>
                          Abrir projecto
                        </Link>
                        <DeleteForm table="projects" id={project.id} />
                      </div>
                    </div>
                    <div className="mt-4 border-t border-[var(--cc-border)] pt-4">
                      <StatusProgressForm
                        entity="projects"
                        id={project.id}
                        status={project.status}
                        progress={project.progress}
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </Card>
    </>
  );
}
