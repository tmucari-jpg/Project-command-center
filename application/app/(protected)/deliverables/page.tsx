import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, EmptyState, secondaryButtonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { displayLabel } from "@/lib/display-label";

export default async function DeliverablesPage({
  searchParams,
}: {
  searchParams: Promise<{ project_id?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();

  const [{ data: projects, error: projectError }, { data: deliverables, error: deliverableError }] =
    await Promise.all([
      supabase
        .from("projects")
        .select("id,title,status")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("deliverables")
        .select("id,project_id,title,description,status,progress,due_date,completion_criteria,artifact_type,artifact_url,artifact_reference,artifact_version,qa_status,acceptance_status,accepted_at,created_at,updated_at")
        .eq("user_id", user.id)
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true }),
    ]);

  const error = projectError?.message ?? deliverableError?.message;
  const visibleProjects = params.project_id
    ? (projects ?? []).filter((project) => project.id === params.project_id)
    : projects ?? [];

  return (
    <>
      <PageHeader eyebrow="Resultados do Projecto" title="Entregáveis" />

      {error && <Card className="mb-6 p-5 text-sm text-[var(--cc-danger)]">{error}</Card>}

      <div className="space-y-5">
        {visibleProjects.map((project) => {
          const projectDeliverables = (deliverables ?? []).filter((item) => item.project_id === project.id);
          const accepted = projectDeliverables.filter((item) => item.acceptance_status === "accepted").length;
          const evidenced = projectDeliverables.filter((item) => Boolean(item.artifact_url || item.artifact_reference)).length;

          return (
            <Card key={project.id} className="p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--cc-secondary)]">Projecto</p>
                  <h2 className="mt-1 text-xl font-semibold text-[var(--cc-foreground)]">{project.title}</h2>
                  <p className="mt-2 text-sm text-[var(--cc-secondary)]">
                    {projectDeliverables.length
                      ? `${accepted}/${projectDeliverables.length} aceite(s) · ${evidenced} com evidência`
                      : "Ainda sem entregáveis definidos."}
                  </p>
                </div>
                <Link className={secondaryButtonClass} href={"/projects/" + project.id}>Abrir projecto</Link>
              </div>

              {projectDeliverables.length ? (
                <div className="mt-5 space-y-3">
                  {projectDeliverables.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface-strong)] p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-[var(--cc-foreground)]">{item.title}</h3>
                          {item.description && (
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--cc-secondary)]">
                              {item.description}
                            </p>
                          )}
                        </div>
                        <span className="rounded-full bg-[var(--cc-surface-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--cc-foreground)]">
                          {item.acceptance_status === "accepted"
                            ? "Aceite"
                            : item.qa_status && item.qa_status !== "pending"
                              ? displayLabel(item.qa_status)
                              : displayLabel(item.status)}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
                        <Info label="Critério de aceitação" value={item.completion_criteria || "Por definir"} />
                        <Info
                          label="Evidência"
                          value={item.artifact_reference || item.artifact_type || (item.artifact_url ? "Link disponível" : "Em falta")}
                        />
                        <Info label="Prazo" value={item.due_date ? formatDate(item.due_date) : "Sem prazo"} />
                        <Info
                          label="Validação"
                          value={item.acceptance_status === "accepted"
                            ? `Aceite${item.accepted_at ? ` · ${formatDate(item.accepted_at)}` : ""}`
                            : displayLabel(item.acceptance_status || "pending")}
                        />
                      </div>

                      {item.artifact_url && (
                        <div className="mt-4">
                          <a className={secondaryButtonClass} href={item.artifact_url} target="_blank" rel="noreferrer">
                            Abrir entregável{item.artifact_version ? ` · v${item.artifact_version}` : ""}
                          </a>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="mt-5">
                  <EmptyState>
                    Os entregáveis devem representar resultados concretos do projecto e ter critério de aceitação, evidência e validação quando aplicável.
                  </EmptyState>
                </div>
              )}
            </Card>
          );
        })}
        {!visibleProjects.length && <EmptyState>Sem projectos para apresentar.</EmptyState>}
      </div>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-[var(--cc-secondary)]">{label}</p>
      <p className="mt-1 text-[var(--cc-foreground)]">{value}</p>
    </div>
  );
}
