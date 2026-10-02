import { createDecision } from "@/app/(protected)/mutations";
import { Field, Select, TextArea } from "@/components/form-fields";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { Card, EmptyState, primaryButtonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

export default async function DecisionsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();

  const [{ data: decisions, error }, { data: projects }] = await Promise.all([
    supabase
      .from("decisions")
      .select("*, projects(title)")
      .eq("user_id", user.id)
      .order("decided_at", { ascending: false }),
    supabase
      .from("projects")
      .select("id,title")
      .eq("user_id", user.id)
      .order("title"),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Memória"
        title="Decisões"
        description="Registe decisões relevantes com contexto, opções, racional e resultado posterior."
      />
      <FlashMessage error={params.error ?? error?.message} created={params.created} />

      <div className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-slate-950">Nova decisão</h2>
          <form action={createDecision} className="mt-5 space-y-4">
            <Field label="Título" name="title" required />
            <Select label="Projecto" name="project_id" defaultValue="">
              <option value="">Sem projecto específico</option>
              {(projects ?? []).map((project) => (
                <option key={project.id} value={project.id}>{project.title}</option>
              ))}
            </Select>
            <TextArea label="Contexto" name="context" />
            <TextArea label="Opções consideradas" name="options_considered" />
            <TextArea label="Decisão tomada" name="decision" />
            <TextArea label="Racional" name="rationale" />
            <TextArea label="Resultado / aprendizagem" name="outcome" />
            <button className={primaryButtonClass} type="submit">Registar decisão</button>
          </form>
        </Card>

        <Card>
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-950">Histórico de decisões</h2>
          </div>
          <div className="p-5">
            {!decisions?.length ? (
              <EmptyState>Ainda não existem decisões registadas.</EmptyState>
            ) : (
              <div className="space-y-4">
                {decisions.map((item) => {
                  const relation = Array.isArray(item.projects) ? item.projects[0] : item.projects;
                  return (
                    <article key={item.id} className="rounded-2xl border border-slate-200 p-4">
                      <h3 className="font-semibold text-slate-950">{item.title}</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        {relation?.title ?? "Sem projecto"} · {formatDateTime(item.decided_at)}
                      </p>
                      <p className="mt-3 text-sm leading-6 text-slate-800">
                        <span className="font-medium">Decisão:</span> {item.decision}
                      </p>
                      {item.rationale && (
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          <span className="font-medium">Racional:</span> {item.rationale}
                        </p>
                      )}
                      {item.outcome && (
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          <span className="font-medium">Resultado:</span> {item.outcome}
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
