import { createBlocker } from "@/app/(protected)/mutations";
import { DeleteForm } from "@/components/delete-form";
import { Field, Select, TextArea } from "@/components/form-fields";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { StatusProgressForm } from "@/components/status-progress-form";
import { Card, EmptyState, primaryButtonClass } from "@/components/ui";
import { STATUS_OPTIONS } from "@/lib/constants";
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

export default async function BlockersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();
  const [{ data: blockers, error }, { data: projects }, { data: deliverables }, { data: actions }] =
    await Promise.all([
      supabase
        .from("blockers")
        .select("*, projects(title), deliverables(title), actions(title)")
        .eq("user_id", user.id)
        .order("identified_at", { ascending: false }),
      supabase.from("projects").select("id,title").eq("user_id", user.id).order("title"),
      supabase.from("deliverables").select("id,title").eq("user_id", user.id).order("title"),
      supabase.from("actions").select("id,title").eq("user_id", user.id).order("title"),
    ]);

  return (
    <>
      <PageHeader
        eyebrow="Risco"
        title="Bloqueios"
        description="Registe o que impede o avanço, o impacto, responsável e prazo de resolução."
      />
      <FlashMessage error={params.error ?? error?.message} created={params.created} />

      <div className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-slate-950">Novo bloqueio</h2>
          <form action={createBlocker} className="mt-5 space-y-4">
            <Field label="Título" name="title" required />
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
            <TextArea label="Descrição" name="description" />
            <TextArea label="Impacto" name="impact" />
            <Field label="Responsável" name="responsible" />
            <Field label="Prazo de resolução" name="resolution_due_at" type="datetime-local" />
            <Select label="Estado" name="status" defaultValue="open">
              {STATUS_OPTIONS.blockers.map((value) => <option key={value} value={value}>{value}</option>)}
            </Select>
            <TextArea label="Solução" name="solution" />
            <button className={primaryButtonClass} type="submit">Criar bloqueio</button>
          </form>
        </Card>

        <Card>
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-950">Bloqueios registados</h2>
          </div>
          <div className="p-5">
            {!blockers?.length ? (
              <EmptyState>Não existem bloqueios registados.</EmptyState>
            ) : (
              <div className="space-y-4">
                {blockers.map((item) => (
                  <article key={item.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-col justify-between gap-3 md:flex-row">
                      <div>
                        <h3 className="font-semibold text-slate-950">{item.title}</h3>
                        <p className="mt-1 text-sm text-slate-500">
                          {item.projects?.title ?? "Sem projecto"} · Resolver até {formatDateTime(item.resolution_due_at)}
                        </p>
                        {item.impact && <p className="mt-3 text-sm text-slate-700">{item.impact}</p>}
                      </div>
                      <DeleteForm table="blockers" id={item.id} />
                    </div>
                    <div className="mt-4 border-t border-slate-100 pt-4">
                      <StatusProgressForm entity="blockers" id={item.id} status={item.status} />
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
