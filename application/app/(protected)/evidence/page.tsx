import { createEvidence } from "@/app/(protected)/mutations";
import { DeleteForm } from "@/components/delete-form";
import { Field, Select, TextArea } from "@/components/form-fields";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { ManualEntry } from "@/components/manual-entry";
import { Card, EmptyState, primaryButtonClass } from "@/components/ui";
import { EVIDENCE_TYPES } from "@/lib/constants";
import { requireUser } from "@/lib/auth";
import { displayLabel } from "@/lib/display-label";
import { formatDateTime } from "@/lib/format";

export default async function EvidencePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string; project_id?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();
  const selectedProjectId = params.project_id ?? "";

  let evidenceQuery = supabase
    .from("evidence")
    .select("*, projects(title), deliverables(title), actions(title)")
    .eq("user_id", user.id);

  if (selectedProjectId) {
    evidenceQuery = evidenceQuery.eq("project_id", selectedProjectId);
  }

  const [
    { data: evidence, error },
    { data: projects },
    { data: deliverables },
    { data: actions },
  ] = await Promise.all([
    evidenceQuery.order("created_at", { ascending: false }),
    supabase.from("projects").select("id,title").eq("user_id", user.id).order("title"),
    supabase.from("deliverables").select("id,title,project_id").eq("user_id", user.id).order("title"),
    supabase.from("actions").select("id,title,project_id,deliverable_id").eq("user_id", user.id).order("title"),
  ]);

  const effectiveProjectId = (projects ?? []).some((project) => project.id === selectedProjectId)
    ? selectedProjectId
    : "";
  const effectiveProjectTitle = (projects ?? []).find((project) => project.id === effectiveProjectId)?.title;
  const visibleDeliverables = effectiveProjectId
    ? (deliverables ?? []).filter((item) => item.project_id === effectiveProjectId)
    : (deliverables ?? []);
  const visibleActions = effectiveProjectId
    ? (actions ?? []).filter((item) => item.project_id === effectiveProjectId)
    : (actions ?? []);

  return (
    <>
      <PageHeader
        eyebrow="Comprovação"
        title={effectiveProjectId ? `Evidências · ${effectiveProjectTitle ?? "Projecto"}` : "Evidências"}
      />
      <FlashMessage error={params.error ?? error?.message} created={params.created} />

      <div className="space-y-6">
        <ManualEntry>
          <h2 className="text-lg font-semibold text-slate-950">Nova evidência</h2>
          <form action={createEvidence} className="mt-5 space-y-4">
            <Select label="Tipo" name="evidence_type" defaultValue="comment">
              {EVIDENCE_TYPES.map((value) => (
                <option key={value} value={value}>{displayLabel(value)}</option>
              ))}
            </Select>
            <Field label="Título" name="title" />
            <TextArea label="Descrição" name="description" />
            <Select label="Acção" name="action_id" defaultValue="">
              <option value="">Sem acção</option>
              {visibleActions.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </Select>
            <Select label="Entregável, se não houver acção" name="deliverable_id" defaultValue="">
              <option value="">Sem entregável</option>
              {visibleDeliverables.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </Select>
            <details className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-4">
              <summary className="cursor-pointer text-sm font-semibold text-[var(--cc-foreground)]">Mais detalhes</summary>
              <div className="mt-4 space-y-4">
                <Select label="Projecto, se não houver acção ou entregável" name="project_id" defaultValue={effectiveProjectId}>
                  <option value="">Sem projecto</option>
                  {(projects ?? []).map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
                </Select>
                <Field label="Caminho de armazenamento" name="storage_path" />
                <Field label="Valor numérico" name="numeric_value" type="number" step="any" />
              </div>
            </details>
            <Field label="URL" name="url" type="url" placeholder="https://..." />
            <button className={primaryButtonClass} type="submit">Registar evidência</button>
          </form>
        </ManualEntry>

        <Card>
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-950">Evidências registadas</h2>
          </div>
          <div className="p-5">
            {!evidence?.length ? (
              <EmptyState>Não existem evidências registadas.</EmptyState>
            ) : (
              <div className="space-y-4">
                {evidence.map((item) => (
                  <article key={item.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-col justify-between gap-3 md:flex-row">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--cc-accent-soft)]">
                          {displayLabel(item.evidence_type)}
                        </p>
                        <h3 className="mt-1 font-semibold text-slate-950">{item.title || "Evidência"}</h3>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatDateTime(item.created_at)} · {item.actions?.title ?? item.deliverables?.title ?? item.projects?.title ?? "Sem relação"}
                        </p>
                        {item.description && <p className="mt-3 text-sm text-slate-700">{item.description}</p>}
                        {item.url && (
                          <a className="mt-3 block truncate text-sm font-medium text-[var(--cc-accent)] hover:underline" href={item.url} target="_blank" rel="noreferrer">
                            {item.url}
                          </a>
                        )}
                      </div>
                      <DeleteForm table="evidence" id={item.id} />
                    </div>
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
