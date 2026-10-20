import Link from "next/link";
import { Bot, BrainCircuit, HardDrive } from "lucide-react";
import { BotIAOperator } from "@/components/bot-ia-operator";
import { PageHeader } from "@/components/page-header";
import { Card, EmptyState, secondaryButtonClass } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { displayLabel } from "@/lib/display-label";
import { formatDateTime } from "@/lib/format";

export default async function BotIAPage() {
  const { supabase, user } = await requireAdmin();

  const [
    { data: projects, error: projectsError },
    { data: blockers, error: blockersError },
    { data: runs, error: runsError },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id,title")
      .eq("user_id", user.id)
      .order("title"),
    supabase
      .from("blockers")
      .select("id,project_id,title,status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("agent_runs")
      .select("id,project_id,objective,status,qa_status,created_at,input_context,projects(title)")
      .eq("user_id", user.id)
      .eq("prompt_code", "BOTIA")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const error = projectsError?.message ?? blockersError?.message ?? runsError?.message;

  const projectOptions = (projects ?? []).map((project) => ({
    id: project.id,
    title: project.title,
  }));

  const blockerOptions = (blockers ?? []).map((blocker) => ({
    id: blocker.id,
    project_id: blocker.project_id,
    title: blocker.title,
    status: blocker.status,
  }));

  return (
    <>
      <PageHeader eyebrow="Administração" title="BotIA" />

      <Card className="mb-6 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <h2 className="inline-flex items-center gap-2 font-semibold text-[var(--cc-foreground)]">
              <Bot size={19} /> IA operacional dentro do PCC
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
              O BotIA serve para melhorar projectos e tratar bloqueios reais sem sair do Project Command Center.
              Lê apenas o contexto necessário, prepara alterações permitidas e mantém registo de cada execução.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/ai-providers" className={secondaryButtonClass}>
              <HardDrive size={15} /> Configuração IA
            </Link>
            <Link href="/agents" className={secondaryButtonClass}>
              <BrainCircuit size={15} /> Execuções avançadas
            </Link>
          </div>
        </div>
      </Card>

      {error && (
        <Card className="mb-6 p-5 text-sm text-[var(--cc-danger)]">
          {error}
        </Card>
      )}

      {!projectOptions.length ? (
        <Card className="p-5">
          <EmptyState>Não existem projectos disponíveis para o BotIA.</EmptyState>
        </Card>
      ) : (
        <BotIAOperator projects={projectOptions} blockers={blockerOptions} />
      )}

      <Card className="mt-6">
        <div className="border-b border-[var(--cc-border)] p-5">
          <h2 className="font-semibold text-[var(--cc-foreground)]">Histórico BotIA</h2>
          <p className="mt-1 text-sm text-[var(--cc-secondary)]">
            Diagnósticos e alterações ficam ligados ao projecto para auditoria e continuidade.
          </p>
        </div>
        <div className="p-5">
          {!runs?.length ? (
            <EmptyState>Ainda não existem execuções BotIA.</EmptyState>
          ) : (
            <div className="space-y-3">
              {runs.map((run) => {
                const relation = Array.isArray(run.projects) ? run.projects[0] : run.projects;
                const context =
                  run.input_context && typeof run.input_context === "object" && !Array.isArray(run.input_context)
                    ? run.input_context as Record<string, unknown>
                    : {};
                const summary = typeof context.summary === "string" ? context.summary : null;

                return (
                  <article
                    key={run.id}
                    className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-[var(--cc-foreground)]">
                          {relation?.title ?? "Projecto"}
                        </p>
                        <p className="mt-1 text-sm text-[var(--cc-secondary)]">{run.objective}</p>
                      </div>
                      <span className="rounded-full bg-[var(--cc-surface-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--cc-secondary)]">
                        {displayLabel(run.status)}
                      </span>
                    </div>
                    {summary && (
                      <p className="mt-3 text-sm leading-6 text-[var(--cc-foreground)]">{summary}</p>
                    )}
                    <p className="mt-2 text-xs text-[var(--cc-secondary)]">
                      {formatDateTime(run.created_at)} · QA {displayLabel(run.qa_status)}
                    </p>
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
