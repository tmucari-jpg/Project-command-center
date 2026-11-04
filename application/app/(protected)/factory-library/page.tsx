import Link from "next/link";
import { approveFactoryLibraryItem, createFactoryLibraryItem } from "@/app/(protected)/mutations";
import { Field, Select, TextArea } from "@/components/form-fields";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { Card, EmptyState, primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { displayLabel } from "@/lib/display-label";

const TYPE_LABELS: Record<string, string> = {
  component: "Componente",
  workflow: "Fluxo",
  template: "Modelo",
  prompt: "Instrução",
  strategy: "Estratégia",
  lesson: "Aprendizagem",
};

export default async function FactoryLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string; approved?: string; saved?: string; project_id?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireAdmin();

  const { data: items, error } = await supabase
    .from("factory_library_items")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const [{ data: projects, error: projectError }, { data: deliverables, error: deliverablesError }] = await Promise.all([
    supabase.from("projects").select("id,title").eq("user_id", user.id).order("title", { ascending: true }),
    supabase.from("deliverables").select("id,project_id,title,status,acceptance_status,artifact_url,working_edit_url,artifact_reference,artifact_version")
      .eq("user_id", user.id).order("created_at", { ascending: true }),
  ]);
  const selectedProjects = params.project_id
    ? (projects ?? []).filter(project => project.id === params.project_id)
    : (projects ?? []);
  const documentCount = (deliverables ?? []).filter(item => Boolean(item.working_edit_url || item.artifact_url)).length;

  return (
    <>
      <PageHeader
        eyebrow="Fábrica de Projectos"
        title="Biblioteca"
      />
      <FlashMessage
        error={params.error ?? error?.message}
        created={params.created ?? params.approved}
        message={params.approved ? "Activo aprovado para reutilização." : "Activo adicionado à biblioteca."}
      />

      <Card className="mb-6 p-5">
        <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Documentos por projecto</h2>
        <p className="mt-2 text-sm text-[var(--cc-secondary)]">
          Os entregáveis são geridos nos projectos. Aqui ficam apenas os seus documentos e ligações,
          organizados por projecto, sem repetir critérios, estados de execução ou guardar cópias.
        </p>
        <p className="mt-2 text-sm text-[var(--cc-secondary)]">{documentCount} documentos ligados aos entregáveis.</p>
        {params.project_id && <Link href="/factory-library" className={secondaryButtonClass}>Ver todos os projectos</Link>}
        {params.saved && <p role="status" className="mt-3 text-sm">Ligação documental guardada no entregável.</p>}
        {(projectError || deliverablesError) && <p role="alert" className="mt-3 text-sm text-[var(--cc-danger)]">Não foi possível carregar o índice documental.</p>}
        {!projectError && !deliverablesError && !selectedProjects.length && <p className="mt-3 text-sm">Ainda não existem projectos com documentos disponíveis.</p>}
        <div className="mt-4 space-y-3">
          {selectedProjects.map(project => {
            const documents = (deliverables ?? []).filter(item => item.project_id === project.id && Boolean(item.working_edit_url || item.artifact_url));
            return <details key={project.id} open={params.project_id === project.id} className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-4">
              <summary className="cursor-pointer font-semibold">{project.title} · {documents.length} documento(s)</summary>
              <div className="mt-3 space-y-3">
                {!documents.length && <p className="text-sm text-[var(--cc-secondary)]">Sem documentos associados. Os entregáveis continuam disponíveis no projecto.</p>}
                {documents.map(item => {
                  const locked = item.status === "completed" || ["accepted", "accepted_with_reservations"].includes(item.acceptance_status ?? "");
                  return <div key={item.id} className="rounded-lg border border-[var(--cc-border)] p-3">
                    <p className="text-sm font-semibold">{item.title} {item.artifact_version ? `· v${item.artifact_version}` : ""}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.working_edit_url && <a className={secondaryButtonClass} href={item.working_edit_url} target="_blank" rel="noopener noreferrer">Editar documento (gestor)</a>}
                      {item.artifact_url && <a className={secondaryButtonClass} href={item.artifact_url} target="_blank" rel="noopener noreferrer">Abrir link de entrega</a>}
                    </div>
                    {locked && <p className="mt-2 text-xs text-[var(--cc-secondary)]">Versão protegida após aceitação.</p>}
                  </div>;
                })}
                <Link className={secondaryButtonClass} href={`/deliverables?project_id=${project.id}`}>Gerir entregáveis no projecto</Link>
              </div>
            </details>;
          })}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Adicionar activo</h2>
          <form action={createFactoryLibraryItem} className="mt-5 space-y-4">
            <Select label="Tipo" name="asset_type" defaultValue="lesson">
              <option value="lesson">Aprendizagem</option>
              <option value="component">Componente</option>
              <option value="workflow">Fluxo</option>
              <option value="template">Modelo</option>
              <option value="prompt">Instrução</option>
              <option value="strategy">Estratégia</option>
            </Select>
            <Field label="Título" name="title" required />
            <TextArea label="Resumo" name="summary" />
            <TextArea
              label="Conteúdo / aprendizagem"
              name="content_text"
              required
              placeholder="Contexto, regra reutilizável, resultado observado ou conteúdo do activo."
            />
            <button className={primaryButtonClass} type="submit">Adicionar à biblioteca</button>
          </form>
        </Card>

        <Card>
          <div className="border-b border-[var(--cc-border)] p-5">
            <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Conhecimento consolidado</h2>
          </div>
          <div className="p-5">
            {!items?.length ? (
              <EmptyState>A biblioteca ainda está vazia.</EmptyState>
            ) : (
              <div className="space-y-4">
                {items.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface-strong)] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-[var(--cc-foreground)]">{item.title}</h3>
                        <p className="mt-1 text-xs text-[var(--cc-secondary)]">
                          {TYPE_LABELS[item.asset_type] ?? item.asset_type}
                          {item.source_type ? ` · origem ${displayLabel(item.source_type)}` : ""}
                        </p>
                      </div>
                      <span className="rounded-full bg-[var(--cc-surface-muted)] px-3 py-1 text-xs font-semibold text-[var(--cc-secondary)]">
                        {displayLabel(item.status)}
                      </span>
                    </div>

                    {item.summary && (
                      <p className="mt-3 text-sm leading-6 text-[var(--cc-foreground)]">{item.summary}</p>
                    )}

                    <p className="mt-3 text-xs text-[var(--cc-secondary)]">
                      {item.behavior_changing
                        ? "Altera comportamento: aprovação obrigatória."
                        : "Aprendizagem operacional reutilizável."}
                    </p>

                    {item.status === "candidate" && (
                      <form action={approveFactoryLibraryItem} className="mt-3">
                        <input type="hidden" name="item_id" value={item.id} />
                        <button className={secondaryButtonClass} type="submit">Aprovar para reutilização</button>
                      </form>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
