import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BarChart3, CheckSquare2, PackageCheck, ShieldCheck, TriangleAlert } from "lucide-react";
import { createProjectMemory } from "@/app/(protected)/mutations";
import { Field, Select, TextArea } from "@/components/form-fields";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, EmptyState, primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/format";
import { projectHealth, progressLabel } from "@/lib/project-metrics";

export default async function ProjectHubPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, user } = await requireUser();

  const { data: project } = await supabase
    .from("projects")
    .select("*, objectives(title)")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!project) notFound();

  const [
    { data: actions },
    { data: deliverables },
    { data: blockers },
    { data: evidence },
    { data: metrics },
    { data: memory },
    { data: decisions },
  ] = await Promise.all([
    supabase
      .from("actions")
      .select("id,title,status,priority,due_at,is_next_action,completion_criteria")
      .eq("user_id", user.id)
      .eq("project_id", id)
      .order("is_next_action", { ascending: false })
      .order("due_at", { ascending: true, nullsFirst: false }),
    supabase
      .from("deliverables")
      .select("id,title,status,progress,due_date")
      .eq("user_id", user.id)
      .eq("project_id", id)
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("blockers")
      .select("id,title,status,impact,responsible,resolution_due_at")
      .eq("user_id", user.id)
      .eq("project_id", id)
      .order("identified_at", { ascending: false }),
    supabase
      .from("evidence")
      .select("id,title,evidence_type,description,url,created_at")
      .eq("user_id", user.id)
      .eq("project_id", id)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("metrics")
      .select("id,name,unit,current_value,target_value,measurement_date")
      .eq("user_id", user.id)
      .eq("project_id", id)
      .order("measurement_date", { ascending: false, nullsFirst: false }),
    supabase
      .from("project_memory")
      .select("id,memory_type,title,content,source,created_at")
      .eq("user_id", user.id)
      .eq("project_id", id)
      .eq("is_current", true)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("decisions")
      .select("id,title,decision,rationale,outcome,decided_at")
      .eq("user_id", user.id)
      .eq("project_id", id)
      .order("decided_at", { ascending: false })
      .limit(6),
  ]);

  const openBlockers = (blockers ?? []).filter((item) => item.status !== "resolved" && item.status !== "ignored");
  const health = projectHealth({
    progress: Number(project.progress ?? 0),
    dueDate: project.due_date,
    openBlockers: openBlockers.length,
  });

  const objectiveRelation = Array.isArray(project.objectives) ? project.objectives[0] : project.objectives;

  return (
    <>
      <div className="mb-4">
        <Link className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:underline" href="/projects">
          <ArrowLeft size={16} /> Voltar aos projectos
        </Link>
      </div>

      <PageHeader
        eyebrow="Project Hub"
        title={project.title}
        description={project.description || "Contexto operacional isolado deste projecto."}
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <StatusBadge status={health} />
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
          progresso {progressLabel(project.progress)}
        </span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
          prioridade {project.priority}
        </span>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <h2 className="text-lg font-semibold text-slate-950">Overview</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Objectivo</dt><dd className="mt-1 text-sm text-slate-800">{objectiveRelation?.title ?? "Sem objectivo associado"}</dd></div>
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Prazo</dt><dd className="mt-1 text-sm text-slate-800">{formatDate(project.due_date)}</dd></div>
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resultado esperado</dt><dd className="mt-1 text-sm text-slate-800">{project.expected_result || "DADO EM FALTA"}</dd></div>
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Próximo passo</dt><dd className="mt-1 text-sm text-slate-800">{project.next_action || "DADO EM FALTA"}</dd></div>
          </dl>
        </Card>

        <Card className="p-5">
          <h2 className="text-lg font-semibold text-slate-950">Estado operacional</h2>
          <div className="mt-4 space-y-3 text-sm">
            <p className="flex justify-between gap-4"><span className="text-slate-500">Acções</span><strong>{actions?.length ?? 0}</strong></p>
            <p className="flex justify-between gap-4"><span className="text-slate-500">Entregáveis</span><strong>{deliverables?.length ?? 0}</strong></p>
            <p className="flex justify-between gap-4"><span className="text-slate-500">Bloqueios abertos</span><strong>{openBlockers.length}</strong></p>
            <p className="flex justify-between gap-4"><span className="text-slate-500">Evidências</span><strong>{evidence?.length ?? 0}</strong></p>
            <p className="flex justify-between gap-4"><span className="text-slate-500">Métricas</span><strong>{metrics?.length ?? 0}</strong></p>
            <p className="flex justify-between gap-4"><span className="text-slate-500">Memórias</span><strong>{memory?.length ?? 0}</strong></p>
            <p className="flex justify-between gap-4"><span className="text-slate-500">Decisões</span><strong>{decisions?.length ?? 0}</strong></p>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between border-b border-slate-200 p-5">
            <h2 className="inline-flex items-center gap-2 font-semibold text-slate-950"><CheckSquare2 size={18} /> Acções</h2>
            <Link className={secondaryButtonClass} href="/actions">Gerir</Link>
          </div>
          <div className="p-5">
            {!actions?.length ? <EmptyState>Sem acções neste projecto.</EmptyState> : (
              <div className="space-y-3">
                {actions.slice(0, 8).map((action) => (
                  <div key={action.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{action.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{formatDateTime(action.due_at)} · {action.priority}</p>
                      </div>
                      {action.is_next_action && <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">próxima</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between border-b border-slate-200 p-5">
            <h2 className="inline-flex items-center gap-2 font-semibold text-slate-950"><PackageCheck size={18} /> Entregáveis</h2>
            <Link className={secondaryButtonClass} href="/deliverables">Gerir</Link>
          </div>
          <div className="p-5">
            {!deliverables?.length ? <EmptyState>Sem entregáveis neste projecto.</EmptyState> : (
              <div className="space-y-3">
                {deliverables.slice(0, 8).map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 p-3">
                    <p className="text-sm font-medium text-slate-900">{item.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatDate(item.due_date)} · {progressLabel(item.progress)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between border-b border-slate-200 p-5">
            <h2 className="inline-flex items-center gap-2 font-semibold text-slate-950"><TriangleAlert size={18} /> Bloqueios</h2>
            <Link className={secondaryButtonClass} href="/blockers">Gerir</Link>
          </div>
          <div className="p-5">
            {!openBlockers.length ? <EmptyState>Sem bloqueios activos.</EmptyState> : (
              <div className="space-y-3">
                {openBlockers.slice(0, 8).map((item) => (
                  <div key={item.id} className="rounded-xl border border-amber-200 bg-amber-50/40 p-3">
                    <p className="text-sm font-medium text-slate-900">{item.title}</p>
                    <p className="mt-1 text-xs text-slate-600">{item.responsible || "Responsável não definido"} · {formatDateTime(item.resolution_due_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between border-b border-slate-200 p-5">
            <h2 className="inline-flex items-center gap-2 font-semibold text-slate-950"><BarChart3 size={18} /> Métricas</h2>
            <Link className={secondaryButtonClass} href="/metrics">Gerir</Link>
          </div>
          <div className="p-5">
            {!metrics?.length ? <EmptyState>Sem métricas associadas.</EmptyState> : (
              <div className="space-y-3">
                {metrics.slice(0, 8).map((metric) => (
                  <div key={metric.id} className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-3">
                    <p className="text-sm font-medium text-slate-900">{metric.name}</p>
                    <p className="text-sm text-slate-600">{metric.current_value ?? "—"}{metric.unit ? ` ${metric.unit}` : ""} / {metric.target_value ?? "—"}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-slate-950">Project Memory</h2>
          <p className="mt-1 text-sm text-slate-500">Contexto persistente deste projecto. Não substitui os dados operacionais.</p>
          <form action={createProjectMemory} className="mt-5 space-y-4">
            <input type="hidden" name="project_id" value={project.id} />
            <Select label="Tipo" name="memory_type" defaultValue="context">
              <option value="context">Contexto</option>
              <option value="decision_context">Contexto de decisão</option>
              <option value="constraint">Restrição</option>
              <option value="assumption">Hipótese</option>
              <option value="learning">Aprendizagem</option>
              <option value="reference">Referência</option>
            </Select>
            <Field label="Título" name="title" required />
            <TextArea label="Conteúdo" name="content" />
            <Field label="Fonte / referência" name="source" />
            <button className={primaryButtonClass} type="submit">Guardar memória</button>
          </form>
        </Card>

        <Card>
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-950">Memória actual</h2>
          </div>
          <div className="p-5">
            {!memory?.length ? <EmptyState>Sem memória persistente neste projecto.</EmptyState> : (
              <div className="space-y-3">
                {memory.map((item) => (
                  <article key={item.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-slate-900">{item.title}</p>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">{item.memory_type.replaceAll("_", " ")}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.content}</p>
                    {item.source && <p className="mt-2 text-xs text-slate-500">Fonte: {item.source}</p>}
                  </article>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <h2 className="font-semibold text-slate-950">Decisões recentes</h2>
          <Link className={secondaryButtonClass} href="/decisions">Gerir decisões</Link>
        </div>
        <div className="p-5">
          {!decisions?.length ? <EmptyState>Sem decisões registadas para este projecto.</EmptyState> : (
            <div className="space-y-3">
              {decisions.map((item) => (
                <article key={item.id} className="rounded-xl border border-slate-200 p-3">
                  <p className="text-sm font-medium text-slate-900">{item.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatDateTime(item.decided_at)}</p>
                  <p className="mt-2 text-sm text-slate-700">{item.decision}</p>
                </article>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card className="mt-6">
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <h2 className="inline-flex items-center gap-2 font-semibold text-slate-950"><ShieldCheck size={18} /> Evidência recente</h2>
          <Link className={secondaryButtonClass} href="/evidence">Gerir</Link>
        </div>
        <div className="p-5">
          {!evidence?.length ? <EmptyState>Sem evidência registada.</EmptyState> : (
            <div className="grid gap-3 md:grid-cols-2">
              {evidence.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 p-3">
                  <p className="text-sm font-medium text-slate-900">{item.title || item.evidence_type}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatDateTime(item.created_at)}</p>
                  {item.description && <p className="mt-2 text-sm text-slate-700">{item.description}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </>
  );
}
