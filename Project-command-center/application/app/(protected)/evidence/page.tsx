import { createEvidence } from "@/app/(protected)/mutations";
import { DeleteForm } from "@/components/delete-form";
import { Field, Select, TextArea } from "@/components/form-fields";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { Card, EmptyState, primaryButtonClass } from "@/components/ui";
import { EVIDENCE_TYPES } from "@/lib/constants";
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

export default async function EvidencePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();

  const [
    { data: evidence, error },
    { data: projects },
    { data: deliverables },
    { data: actions },
  ] = await Promise.all([
    supabase
      .from("evidence")
      .select("*, projects(title), deliverables(title), actions(title)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.from("projects").select("id,title").eq("user_id", user.id).order("title"),
    supabase.from("deliverables").select("id,title").eq("user_id", user.id).order("title"),
    supabase.from("actions").select("id,title").eq("user_id", user.id).order("title"),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Comprovação"
        title="Evidências"
        description="Registe links, documentos, números e outras provas do avanço realizado."
      />
      <FlashMessage error={params.error ?? error?.message} created={params.created} />

      <div className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-slate-950">Nova evidência</h2>
          <form action={createEvidence} className="mt-5 space-y-4">
            <Select label="Tipo" name="evidence_type" defaultValue="comment">
              {EVIDENCE_TYPES.map((value) => (
                <option key={value} value={value}>{value.replaceAll("_", " ")}</option>
              ))}
            </Select>
            <Field label="Título" name="title" />
            <TextArea label="Descrição" name="description" />
            <Select label="Projecto" name="project_id" defaultValue="">
              <option value="">Sem projecto</option>
              {(projects ?? []).map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
            </Select>
            <Select label="Entregável" name="deliverable_id" defaultValue="">
              <option value="">Sem entregável</option>
              {(deliverables ?? []).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </Select>
            <Select label="Acção" name="action_id" defaultValue="">
              <option value="">Sem acção</option>
              {(actions ?? []).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </Select>
            <Field label="URL" name="url" type="url" placeholder="https://..." />
            <Field label="Storage path" name="storage_path" />
            <Field label="Valor numérico" name="numeric_value" type="number" step="any" />
            <button className={primaryButtonClass} type="submit">Registar evidência</button>
          </form>
        </Card>

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
                        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-600">
                          {item.evidence_type.replaceAll("_", " ")}
                        </p>
                        <h3 className="mt-1 font-semibold text-slate-950">{item.title || "Evidência"}</h3>
                        <p className="mt-1 text-xs text-slate-500">{formatDateTime(item.created_at)}</p>
                        {item.description && <p className="mt-3 text-sm text-slate-700">{item.description}</p>}
                        {item.url && (
                          <a className="mt-3 block truncate text-sm font-medium text-blue-700 hover:underline" href={item.url} target="_blank" rel="noreferrer">
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
