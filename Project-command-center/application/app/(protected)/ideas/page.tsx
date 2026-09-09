import { createIdea } from "@/app/(protected)/mutations";
import { DeleteForm } from "@/components/delete-form";
import { Field, Select, TextArea } from "@/components/form-fields";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { StatusProgressForm } from "@/components/status-progress-form";
import { Card, EmptyState, primaryButtonClass } from "@/components/ui";
import { PRIORITIES, STATUS_OPTIONS } from "@/lib/constants";
import { requireUser } from "@/lib/auth";

export default async function IdeasPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();
  const [{ data: ideas, error }, { data: projects }] = await Promise.all([
    supabase
      .from("ideas")
      .select("*, projects(title)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.from("projects").select("id,title").eq("user_id", user.id).order("title"),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Captura"
        title="Ideias"
        description="Capture ideias sem as transformar automaticamente em trabalho activo."
      />
      <FlashMessage error={params.error ?? error?.message} created={params.created} />

      <div className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-slate-950">Nova ideia</h2>
          <form action={createIdea} className="mt-5 space-y-4">
            <Field label="Título" name="title" required />
            <TextArea label="Descrição" name="description" />
            <Field label="Origem" name="source" />
            <TextArea label="Potencial" name="potential" />
            <Select label="Projecto relacionado" name="project_id" defaultValue="">
              <option value="">Sem projecto</option>
              {(projects ?? []).map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
            </Select>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Prioridade" name="priority" defaultValue="medium">
                {PRIORITIES.map((value) => <option key={value} value={value}>{value}</option>)}
              </Select>
              <Select label="Estado" name="status" defaultValue="captured">
                {STATUS_OPTIONS.ideas.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
              </Select>
            </div>
            <TextArea label="Próxima decisão" name="next_decision" />
            <button className={primaryButtonClass} type="submit">Capturar ideia</button>
          </form>
        </Card>

        <Card>
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-950">Ideias capturadas</h2>
          </div>
          <div className="p-5">
            {!ideas?.length ? (
              <EmptyState>Não existem ideias capturadas.</EmptyState>
            ) : (
              <div className="space-y-4">
                {ideas.map((idea) => (
                  <article key={idea.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-col justify-between gap-3 md:flex-row">
                      <div>
                        <h3 className="font-semibold text-slate-950">{idea.title}</h3>
                        <p className="mt-1 text-sm text-slate-500">
                          Prioridade {idea.priority} · {idea.projects?.title ?? "Sem projecto"}
                        </p>
                        {idea.next_decision && (
                          <p className="mt-3 text-sm text-slate-700">
                            <span className="font-medium">Próxima decisão:</span> {idea.next_decision}
                          </p>
                        )}
                      </div>
                      <DeleteForm table="ideas" id={idea.id} />
                    </div>
                    <div className="mt-4 border-t border-slate-100 pt-4">
                      <StatusProgressForm entity="ideas" id={idea.id} status={idea.status} />
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
