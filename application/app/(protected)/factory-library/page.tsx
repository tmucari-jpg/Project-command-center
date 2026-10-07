import { approveFactoryLibraryItem, createFactoryLibraryItem } from "@/app/(protected)/mutations";
import { Field, Select, TextArea } from "@/components/form-fields";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { Card, EmptyState, primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";

const TYPE_LABELS: Record<string, string> = {
  component: "Component",
  workflow: "Workflow",
  template: "Template",
  prompt: "Prompt",
  strategy: "Strategy",
  lesson: "Lesson Learned",
};

export default async function FactoryLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string; approved?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();

  const { data: items, error } = await supabase
    .from("factory_library_items")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <>
      <PageHeader
        eyebrow="Project Factory"
        title="Factory Library"
        description="Biblioteca reutilizável de componentes, workflows, templates, prompts, estratégias e lições aprendidas. Lições operacionais de projectos concluídos entram automaticamente; activos que alteram comportamento exigem aprovação."
      />
      <FlashMessage
        error={params.error ?? error?.message}
        created={params.created ?? params.approved}
        message={params.approved ? "Activo aprovado para reutilização." : "Activo adicionado à Factory Library."}
      />

      <div className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Adicionar activo</h2>
          <form action={createFactoryLibraryItem} className="mt-5 space-y-4">
            <Select label="Tipo" name="asset_type" defaultValue="lesson">
              <option value="lesson">Lesson Learned</option>
              <option value="component">Component</option>
              <option value="workflow">Workflow</option>
              <option value="template">Template</option>
              <option value="prompt">Prompt</option>
              <option value="strategy">Strategy</option>
            </Select>
            <Field label="Título" name="title" required />
            <TextArea label="Resumo" name="summary" />
            <TextArea
              label="Conteúdo / aprendizagem"
              name="content_text"
              required
              placeholder="Contexto, regra reutilizável, resultado observado ou conteúdo do activo."
            />
            <button className={primaryButtonClass} type="submit">Adicionar à Library</button>
          </form>
        </Card>

        <Card>
          <div className="border-b border-[var(--cc-border)] p-5">
            <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Conhecimento consolidado</h2>
          </div>
          <div className="p-5">
            {!items?.length ? (
              <EmptyState>A Factory Library ainda está vazia.</EmptyState>
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
                          {item.source_type ? ` · origem ${item.source_type}` : ""}
                        </p>
                      </div>
                      <span className="rounded-full bg-[var(--cc-surface-muted)] px-3 py-1 text-xs font-semibold text-[var(--cc-secondary)]">
                        {item.status}
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
