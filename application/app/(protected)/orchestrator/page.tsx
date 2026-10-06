import { createOrchestratorRoute } from "@/app/(protected)/mutations";
import { Field, Select, TextArea } from "@/components/form-fields";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { Card, EmptyState, primaryButtonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export default async function OrchestratorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();

  const [{ data: projects }, { data: factoryCases }, { data: routes, error }] = await Promise.all([
    supabase.from("projects").select("id,title").eq("user_id", user.id).order("title"),
    supabase.from("project_factory_cases").select("id,title").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase
      .from("orchestrator_routes")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="AI Layer"
        title="Orchestrator"
        description="Selecciona agente, Dots, política de provider e estratégia de execução por tarefa. Não usa rankings estáticos de modelos."
      />
      <FlashMessage error={params.error ?? error?.message} created={params.created} message="Rota de execução criada." />

      <div className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Nova rota</h2>
          <form action={createOrchestratorRoute} className="mt-5 space-y-4">
            <Select label="Projecto" name="project_id" defaultValue="">
              <option value="">Sem projecto</option>
              {(projects ?? []).map((project) => (
                <option key={project.id} value={project.id}>{project.title}</option>
              ))}
            </Select>
            <Select label="Caso da Project Factory" name="factory_case_id" defaultValue="">
              <option value="">Sem caso da Factory</option>
              {(factoryCases ?? []).map((item) => (
                <option key={item.id} value={item.id}>{item.title}</option>
              ))}
            </Select>
            <Select label="Tipo de tarefa" name="task_type" defaultValue="command">
              <option value="command">Command</option>
              <option value="research">Research</option>
              <option value="competitive_intelligence">Competitive Intelligence</option>
              <option value="business">Business</option>
              <option value="marketing">Marketing</option>
              <option value="product">Product</option>
              <option value="qa">QA</option>
              <option value="analytics">Analytics</option>
            </Select>
            <TextArea label="Objectivo" name="objective" required />
            <Select label="Risco" name="risk_level" defaultValue="medium">
              <option value="low">Baixo</option>
              <option value="medium">Médio</option>
              <option value="high">Alto</option>
              <option value="critical">Crítico</option>
            </Select>
            <Select label="Factualidade necessária" name="factuality" defaultValue="standard">
              <option value="standard">Standard</option>
              <option value="high">Alta</option>
            </Select>
            <Select label="Sensibilidade a custo" name="cost_sensitivity" defaultValue="medium">
              <option value="low">Baixa</option>
              <option value="medium">Média</option>
              <option value="high">Alta</option>
            </Select>
            <button className={primaryButtonClass} type="submit">Seleccionar rota</button>
          </form>
        </Card>

        <Card>
          <div className="border-b border-[var(--cc-border)] p-5">
            <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Rotas recentes</h2>
          </div>
          <div className="p-5">
            {!routes?.length ? (
              <EmptyState>Ainda não existem decisões do Orchestrator.</EmptyState>
            ) : (
              <div className="space-y-4">
                {routes.map((route) => (
                  <article key={route.id} className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[var(--cc-foreground)]">{route.objective}</p>
                        <p className="mt-1 text-sm text-[var(--cc-secondary)]">
                          {route.selected_agent} · {route.strategy} · {route.provider_policy}
                        </p>
                      </div>
                      <span className="rounded-full bg-[var(--cc-surface-muted)] px-3 py-1 text-xs font-semibold text-[var(--cc-secondary)]">
                        {route.status}
                      </span>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-[var(--cc-secondary)]">
                      Dots: {(route.selected_dots ?? []).join(", ") || "nenhum"}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-[var(--cc-secondary)]">{route.rationale}</p>
                    {route.approval_required && (
                      <p className="mt-3 text-xs font-semibold text-amber-700">Human approval gate obrigatório.</p>
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
