import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, EmptyState, secondaryButtonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";

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
        .select("id,project_id,title,description,status,progress,created_at,updated_at")
        .eq("user_id", user.id)
        .eq("workstream", "general")
        .ilike("title", "Diagnóstico do Cliente%")
        .order("created_at", { ascending: false }),
    ]);

  const error = projectError?.message ?? deliverableError?.message;
  const visibleProjects = params.project_id
    ? (projects ?? []).filter((project) => project.id === params.project_id)
    : projects ?? [];

  return (
    <>
      <PageHeader eyebrow="Biblioteca do Projecto" title="Entregável de Diagnóstico" />

      {error && <Card className="mb-6 p-5 text-sm text-[var(--cc-danger)]">{error}</Card>}

      <Card className="mb-6 p-5">
        <h2 className="font-semibold text-[var(--cc-foreground)]">O que fica aqui</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
          Cada projecto tem um único entregável: o diagnóstico produzido a partir do questionário do cliente e dos inputs efectivamente recolhidos. O conteúdo, título e descrição são gerados automaticamente pelo PCC; não existe criação manual de entregáveis nesta área.
        </p>
        <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
          O fecho do projecto é um processo separado e está em <strong>Fecho do Projecto</strong>. O Repositório Oficial PCC também é separado e guarda apenas documentos e builds oficiais da plataforma.
        </p>
      </Card>

      <div className="space-y-4">
        {visibleProjects.map((project) => {
          const item = (deliverables ?? []).find((deliverable) => deliverable.project_id === project.id);
          return (
            <Card key={project.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-secondary)]">Projecto</p>
                  <h2 className="mt-1 text-lg font-semibold text-[var(--cc-foreground)]">{project.title}</h2>
                </div>
                <span className="rounded-full bg-[var(--cc-surface-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--cc-foreground)]">
                  {item ? "Diagnóstico disponível" : "A aguardar diagnóstico"}
                </span>
              </div>

              {item ? (
                <div className="mt-4 rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-4">
                  <p className="font-semibold text-[var(--cc-foreground)]">{item.title}</p>
                  {item.description && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--cc-secondary)]">{item.description}</p>}
                  <p className="mt-3 text-xs text-[var(--cc-tertiary)]">
                    Gerado automaticamente · {formatDate(item.created_at)} · estado {item.status}
                  </p>
                </div>
              ) : (
                <EmptyState>
                  O entregável será criado automaticamente quando o diagnóstico do cliente for incorporado no projecto.
                </EmptyState>
              )}

              <div className="mt-4">
                <Link className={secondaryButtonClass} href={"/projects/" + project.id}>Abrir projecto</Link>
              </div>
            </Card>
          );
        })}
        {!visibleProjects.length && <EmptyState>Sem projectos para apresentar.</EmptyState>}
      </div>
    </>
  );
}
