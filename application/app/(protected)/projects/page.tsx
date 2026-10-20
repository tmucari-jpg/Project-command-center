import Link from "next/link";
import { DeleteForm } from "@/components/delete-form";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { StatusProgressForm } from "@/components/status-progress-form";
import { Card, EmptyState, secondaryButtonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { displayLabel } from "@/lib/display-label";
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
      />
      <FlashMessage error={params.error ?? error?.message} created={params.created} />

      <Card>
        <div className="border-b border-[var(--cc-border)] p-5">
          <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Projectos registados</h2>
        </div>
        <div className="p-5">
          {!projects?.length ? (
            <EmptyState>
              Ainda não existem projectos registados.
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
                  <article key={project.id} className="rounded-[var(--cc-radius-lg)] border border-[var(--cc-border)] p-4">
                    <div className="flex flex-col justify-between gap-3 md:flex-row">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-[var(--cc-foreground)]">{project.title}</h3>
                          <StatusBadge status={health} />
                        </div>
                        <p className="mt-1 text-sm text-[var(--cc-secondary)]">
                          Prazo {formatDate(project.due_date)} · Prioridade {displayLabel(project.priority)}
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
