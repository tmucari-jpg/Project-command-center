import { createAutomationJob, createAutomationWorkflow } from "@/app/(protected)/mutations";
import { Field, Select, TextArea } from "@/components/form-fields";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { Card, EmptyState, primaryButtonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { n8nConfigured } from "@/lib/n8n";

export default async function AutomationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string; workflow?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();

  const [
    { data: workflows },
    { data: routes },
    { data: factoryCases },
    { data: projects },
    { data: jobs, error },
  ] = await Promise.all([
    supabase
      .from("automation_workflows")
      .select("*")
      .eq("user_id", user.id)
      .order("name"),
    supabase
      .from("orchestrator_routes")
      .select("id,objective,selected_agent,strategy")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("project_factory_cases")
      .select("id,title")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("projects")
      .select("id,title")
      .eq("user_id", user.id)
      .order("title"),
    supabase
      .from("automation_jobs")
      .select("*,automation_workflows(name,code)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Automation"
        title="n8n Execution Engine"
        description="O Command Center decide e coordena; o n8n executa workflows externos. Credenciais permanecem em variáveis de ambiente, nunca na base de dados."
      />
      <FlashMessage
        error={params.error ?? error?.message}
        created={params.created ?? params.workflow}
        message={params.workflow ? "Workflow registado." : params.created ? "Job colocado na fila de execução." : undefined}
      />

      <Card className="mb-6 p-4">
        <p className="text-sm text-[var(--cc-secondary)]">
          Estado do adapter:{" "}
          <strong className="text-[var(--cc-foreground)]">
            {n8nConfigured() ? "configurado" : "aguarda N8N_WEBHOOK_URL"}
          </strong>
          . Criar jobs é seguro mesmo sem endpoint; a execução externa só ocorre quando o adapter estiver configurado e for accionada.
        </p>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Registar workflow</h2>
          <form action={createAutomationWorkflow} className="mt-5 space-y-4">
            <Field label="Código" name="code" required placeholder="Ex.: briefing_daily_publish" />
            <Field label="Nome" name="name" required placeholder="Ex.: Publicar Briefing Diário" />
            <TextArea label="Descrição" name="description" />
            <Select label="Modo de trigger" name="trigger_mode" defaultValue="webhook">
              <option value="webhook">Webhook</option>
              <option value="poll">Polling</option>
            </Select>
            <Select label="Aprovação humana" name="requires_approval" defaultValue="false">
              <option value="false">Não obrigatória</option>
              <option value="true">Obrigatória</option>
            </Select>
            <button className={primaryButtonClass} type="submit">Registar workflow</button>
          </form>
        </Card>

        <Card className="p-5">
          <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Criar execution job</h2>
          <form action={createAutomationJob} className="mt-5 space-y-4">
            <Select label="Workflow" name="workflow_id" defaultValue="">
              <option value="">Sem workflow específico</option>
              {(workflows ?? []).map((workflow) => (
                <option key={workflow.id} value={workflow.id}>{workflow.name} · {workflow.code}</option>
              ))}
            </Select>

            <Select label="Rota do Orchestrator" name="orchestrator_route_id" defaultValue="">
              <option value="">Sem rota associada</option>
              {(routes ?? []).map((route) => (
                <option key={route.id} value={route.id}>
                  {route.objective} · {route.selected_agent} · {route.strategy}
                </option>
              ))}
            </Select>

            <Select label="Caso da Factory" name="factory_case_id" defaultValue="">
              <option value="">Sem caso associado</option>
              {(factoryCases ?? []).map((item) => (
                <option key={item.id} value={item.id}>{item.title}</option>
              ))}
            </Select>

            <Select label="Projecto" name="project_id" defaultValue="">
              <option value="">Sem projecto associado</option>
              {(projects ?? []).map((project) => (
                <option key={project.id} value={project.id}>{project.title}</option>
              ))}
            </Select>

            <TextArea label="Objectivo da execução" name="objective" required />
            <TextArea
              label="Payload JSON"
              name="payload_json"
              placeholder='{"channel":"email","mode":"draft"}'
            />
            <Select label="Prioridade" name="priority" defaultValue="normal">
              <option value="low">Baixa</option>
              <option value="normal">Normal</option>
              <option value="high">Alta</option>
            </Select>
            <button className={primaryButtonClass} type="submit">Colocar na fila</button>
          </form>
        </Card>
      </div>

      <Card className="mt-6">
        <div className="border-b border-[var(--cc-border)] p-5">
          <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Execution Queue</h2>
        </div>
        <div className="p-5">
          {!jobs?.length ? (
            <EmptyState>Ainda não existem automation jobs.</EmptyState>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => {
                const relation = Array.isArray(job.automation_workflows)
                  ? job.automation_workflows[0]
                  : job.automation_workflows;
                return (
                  <article key={job.id} className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[var(--cc-foreground)]">{job.objective}</p>
                        <p className="mt-1 text-xs text-[var(--cc-secondary)]">
                          {relation?.name ?? "Workflow não definido"} · prioridade {job.priority}
                        </p>
                      </div>
                      <span className="rounded-full bg-[var(--cc-surface-muted)] px-3 py-1 text-xs font-semibold text-[var(--cc-secondary)]">
                        {job.status}
                      </span>
                    </div>
                    {job.last_error && (
                      <p className="mt-3 text-xs leading-5 text-red-700">{job.last_error}</p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </Card>
    </>
  );
}
