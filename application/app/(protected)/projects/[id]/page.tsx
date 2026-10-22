import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BarChart3, CalendarCheck2, CheckSquare2, CircleDollarSign, GitBranch, Home, PackageCheck, ShieldCheck, TriangleAlert, UserRoundCheck } from "lucide-react";
import {
  completeProjectReview,
  createProjectMemory,
  prepareProjectOperationalStructure,
  resolveGovernanceDependency,
  updateProjectGovernance,
  updateProjectNextAction,
} from "@/app/(protected)/mutations";
import { Field, Select, TextArea } from "@/components/form-fields";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, EmptyState, primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/format";
import { executiveProjectHealth, isProjectPlanStale, progressLabel } from "@/lib/project-metrics";
import { displayLabel } from "@/lib/display-label";
import { GOVERNANCE_GATE_LABELS, GOVERNANCE_STATUS_LABELS } from "@/lib/governance";
import { deriveProjectEconomics } from "@/lib/project-economics";

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
    { data: dependencies },
    { data: profiles },
    { data: economics },
    { data: strategyPlan },
    { data: leads },
    { data: financialEntries },
    { data: commercialProfile },
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
    supabase
      .from("project_governance_dependencies")
      .select("id,gate,kind,owner_role,required_item,description,status,source_reference,evidence,missing_key,blocks_progress,created_at")
      .eq("user_id", user.id)
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id,full_name")
      .order("full_name"),
    supabase
      .from("project_unit_economics")
      .select("*")
      .eq("user_id", user.id)
      .eq("project_id", id)
      .maybeSingle(),
    supabase
      .from("project_strategy_execution_plans")
      .select("updated_at")
      .eq("user_id", user.id)
      .eq("project_id", id)
      .maybeSingle(),
    supabase
      .from("commercial_leads")
      .select("stage,value,currency")
      .eq("user_id", user.id)
      .eq("project_id", id),
    supabase
      .from("financial_entries")
      .select("entry_type,category,amount,currency,status")
      .eq("user_id", user.id)
      .eq("project_id", id),
    supabase
      .from("project_commercial_profiles")
      .select("currency")
      .eq("user_id", user.id)
      .eq("project_id", id)
      .maybeSingle(),
  ]);

  const openBlockers = (blockers ?? []).filter((item) => item.status !== "resolved" && item.status !== "ignored");
  const activeDependencies = (dependencies ?? []).filter((item) =>
    ["pending", "resolving"].includes(item.status),
  );
  const now = new Date();
  const overdueActions = (actions ?? []).filter(
    (item) =>
      item.due_at &&
      new Date(item.due_at) < now &&
      !["completed", "cancelled"].includes(item.status),
  );
  const planStale = isProjectPlanStale(strategyPlan?.updated_at, {
    latestEvidenceAt: evidence?.[0]?.created_at,
    latestDecisionAt: decisions?.[0]?.decided_at,
  });
  const health = executiveProjectHealth({
    progress: Number(project.progress ?? 0),
    dueDate: project.due_date,
    openBlockers: openBlockers.length,
    overdueActions: overdueActions.length,
    activeDependencies: activeDependencies.length,
    nextReviewDate: project.next_review_date,
    planStale,
    gateStatus: project.governance_gate_status,
    hasOwner: Boolean(project.owner_id),
  });

  const objectiveRelation = Array.isArray(project.objectives) ? project.objectives[0] : project.objectives;
  const projectOwner = (profiles ?? []).find((profile) => profile.id === project.owner_id);
  const economicsSnapshot = deriveProjectEconomics({
    leads: leads ?? [],
    financialEntries: financialEntries ?? [],
    existing: economics,
    projectCurrency: project.currency,
    commercialCurrency: commercialProfile?.currency,
  });
  const autofillStateLabel: Record<string, string> = {
    calculated: "Calculado",
    inferred: "Inferido",
    estimated: "Estimado",
    missing: "Em falta",
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link className={secondaryButtonClass} href="/projects">
          <ArrowLeft size={16} /> Voltar
        </Link>
        <Link className={secondaryButtonClass} href="/dashboard">
          <Home size={16} /> Painel
        </Link>
      </div>

      <PageHeader
        eyebrow="Projecto"
        title={project.title}
      />

      <div className="mb-4">
        <form action={prepareProjectOperationalStructure}>
          <input type="hidden" name="project_id" value={project.id} />
          <button className={primaryButtonClass} type="submit">
            Preparar estrutura operacional
          </button>
        </form>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <StatusBadge status={health.status} />
        <span className="rounded-full bg-[var(--cc-surface-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--cc-foreground)]">
          estado {displayLabel(project.status)}
        </span>
        <span className="rounded-full bg-[var(--cc-surface-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--cc-foreground)]">
          progresso {progressLabel(project.progress)}
        </span>
        <span className="rounded-full bg-[var(--cc-surface-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--cc-foreground)]">
          prioridade {displayLabel(project.priority)}
        </span>
        <span className="rounded-full bg-[var(--cc-surface-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--cc-foreground)]">
          saúde {health.score}%
        </span>
        {planStale && (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
            plano desactualizado
          </span>
        )}
        <Link className={primaryButtonClass} href={`/projects/${project.id}/plan`}>
          Plano Estratégia → Execução
        </Link>
        <Link className={secondaryButtonClass} href={`/objectives?project_id=${project.id}`}>
          Objectivo
        </Link>
        <Link className={secondaryButtonClass} href={`/deliverables?project_id=${project.id}`}>
          Entregáveis
        </Link>
        <Link className={secondaryButtonClass} href={`/actions?project_id=${project.id}`}>
          Acções
        </Link>
        <Link className={secondaryButtonClass} href={`/blockers?project_id=${project.id}`}>
          Bloqueios
        </Link>
        <Link className={secondaryButtonClass} href={`/metrics?project_id=${project.id}`}>
          Métricas
        </Link>
        <Link className={secondaryButtonClass} href={`/decisions?project_id=${project.id}`}>
          Decisões
        </Link>
        <Link className={secondaryButtonClass} href={`/evidence?project_id=${project.id}`}>
          Evidências
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Resumo</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-secondary)]">Objectivo</dt><dd className="mt-1 text-sm text-[var(--cc-foreground)]">{objectiveRelation?.title ?? "Ainda não definido"}</dd></div>
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-secondary)]">Estado</dt><dd className="mt-1 text-sm text-[var(--cc-foreground)]">{displayLabel(project.status)}</dd></div>
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-secondary)]">Data inicial</dt><dd className="mt-1 text-sm text-[var(--cc-foreground)]">{project.start_date ? formatDate(project.start_date) : "Ainda não definida"}</dd></div>
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-secondary)]">Prazo</dt><dd className="mt-1 text-sm text-[var(--cc-foreground)]">{project.due_date ? formatDate(project.due_date) : "Ainda não definido"}</dd></div>
            <div className="sm:col-span-2"><dt className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-secondary)]">Descrição</dt><dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[var(--cc-foreground)]">{project.description || "Ainda não definida"}</dd></div>
            <div className="sm:col-span-2"><dt className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-secondary)]">Resultado esperado</dt><dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[var(--cc-foreground)]">{project.expected_result || "Ainda não definido"}</dd></div>
            {(project.budget != null || project.currency) && (
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-secondary)]">Orçamento</dt><dd className="mt-1 text-sm text-[var(--cc-foreground)]">{project.budget ?? "—"} {project.currency ?? ""}</dd></div>
            )}
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-secondary)]">Próximo passo</dt>
              <dd className="mt-2">
                <form action={updateProjectNextAction} className="flex flex-col gap-2 sm:flex-row">
                  <input type="hidden" name="project_id" value={project.id} />
                  <input
                    className="min-w-0 flex-1 rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] px-3 py-2 text-sm text-[var(--cc-foreground)]"
                    name="next_action"
                    defaultValue={project.next_action ?? ""}
                    placeholder="Definir próximo passo"
                    maxLength={500}
                  />
                  <button className={secondaryButtonClass} type="submit">Guardar</button>
                </form>
              </dd>
            </div>
            <div className="sm:col-span-2"><dt className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-secondary)]">Notas</dt><dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[var(--cc-foreground)]">{project.notes || "Ainda não definidas"}</dd></div>
          </dl>
        </Card>

        <Card className="p-5">
          <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Estado operacional</h2>
          <div className="mt-4 space-y-3 text-sm">
            <p className="flex justify-between gap-4"><span className="text-[var(--cc-secondary)]">Acções</span><strong>{actions?.length ?? 0}</strong></p>
            <p className="flex justify-between gap-4"><span className="text-[var(--cc-secondary)]">Entregáveis</span><strong>{deliverables?.length ?? 0}</strong></p>
            <p className="flex justify-between gap-4"><span className="text-[var(--cc-secondary)]">Bloqueios abertos</span><strong>{openBlockers.length}</strong></p>
            <p className="flex justify-between gap-4"><span className="text-[var(--cc-secondary)]">Acções em atraso</span><strong>{overdueActions.length}</strong></p>
            <p className="flex justify-between gap-4"><span className="text-[var(--cc-secondary)]">Evidências</span><strong>{evidence?.length ?? 0}</strong></p>
            <p className="flex justify-between gap-4"><span className="text-[var(--cc-secondary)]">Métricas</span><strong>{metrics?.length ?? 0}</strong></p>
            <p className="flex justify-between gap-4"><span className="text-[var(--cc-secondary)]">Memórias</span><strong>{memory?.length ?? 0}</strong></p>
            <p className="flex justify-between gap-4"><span className="text-[var(--cc-secondary)]">Decisões</span><strong>{decisions?.length ?? 0}</strong></p>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="p-5">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-[var(--cc-foreground)]">
            <UserRoundCheck size={18} /> Responsabilidade e revisão
          </h2>
          <form action={updateProjectGovernance} className="mt-5 space-y-4">
            <input type="hidden" name="project_id" value={project.id} />
            <Select label="Responsável" name="owner_id" defaultValue={project.owner_id ?? ""}>
              <option value="">Sem responsável definido</option>
              {(profiles ?? []).map((profile) => (
                <option key={profile.id} value={profile.id}>{profile.full_name || "Utilizador"}</option>
              ))}
            </Select>
            <Field
              label="Cadência de revisão (dias)"
              name="review_cadence_days"
              type="number"
              min={1}
              max={365}
              defaultValue={project.review_cadence_days ?? undefined}
              placeholder="Definir apenas quando existir uma regra"
            />
            <div className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface-muted)] p-3 text-sm text-[var(--cc-foreground)]">
              <p><span className="font-semibold">Próxima revisão:</span> {project.next_review_date ? formatDate(project.next_review_date) : "por definir"}</p>
              <p className="mt-1"><span className="font-semibold">Gate:</span> {GOVERNANCE_GATE_LABELS[project.governance_gate] ?? project.governance_gate}</p>
              <p className="mt-1"><span className="font-semibold">Estado do Gate:</span> {GOVERNANCE_STATUS_LABELS[project.governance_gate_status] ?? project.governance_gate_status}</p>
            </div>
            <button className={primaryButtonClass} type="submit">Guardar acompanhamento</button>
          </form>
          {project.review_cadence_days && (
            <form action={completeProjectReview} className="mt-3">
              <input type="hidden" name="project_id" value={project.id} />
              <button className={secondaryButtonClass} type="submit">Concluir revisão e agendar próxima</button>
            </form>
          )}
          <p className="mt-3 text-xs text-[var(--cc-secondary)]">
            Responsável actual: {projectOwner?.full_name || "não definido"}. O PCC não cria datas de revisão sem uma cadência explícita.
          </p>
        </Card>

        <Card className="p-5">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-[var(--cc-foreground)]">
            <GitBranch size={18} /> Dependências de governança
          </h2>
          <p className="mt-2 text-sm text-[var(--cc-secondary)]">
            O PCC resolve primeiro o que conseguir automaticamente. Só transfere para o Dono do Projecto informação, confirmação ou decisão que exija intervenção humana.
          </p>
          <div className="mt-5 space-y-3">
            {!activeDependencies.length ? (
              <p className="text-sm text-[var(--cc-secondary)]">Sem dependências de governança pendentes.</p>
            ) : activeDependencies.map((item) => (
              <div key={item.id} className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--cc-foreground)]">{item.required_item}</p>
                  <span className="rounded-full bg-[var(--cc-surface-muted)] px-2 py-1 text-[11px] font-semibold text-[var(--cc-foreground)]">
                    {item.owner_role === "pcc" ? "PCC" : "Dono do Projecto"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--cc-secondary)]">
                  {displayLabel(item.kind)} · {GOVERNANCE_GATE_LABELS[item.gate] ?? item.gate}
                  {item.blocks_progress ? " · bloqueia avanço" : ""}
                </p>
                {item.description && <p className="mt-2 text-sm text-[var(--cc-secondary)]">{item.description}</p>}
                {item.owner_role === "project_owner" && (
                  <form action={resolveGovernanceDependency} className="mt-3">
                    <input type="hidden" name="dependency_id" value={item.id} />
                    <input type="hidden" name="project_id" value={project.id} />
                    <button type="submit" className="text-xs font-semibold text-[var(--cc-accent)] hover:underline">
                      Marcar como resolvida
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-[var(--cc-foreground)]">
            <CircleDollarSign size={18} /> Indicadores económicos
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
            Calculados apenas quando existem dados reais suficientes. Em projectos cujo retorno principal não é financeiro, a ausência destes indicadores não é tratada como falha.
          </p>
          <div className="mt-5 space-y-3">
              <div className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-[var(--cc-foreground)]">Custo de aquisição de cliente (CAC)</p>
                  <span className="rounded-full bg-[var(--cc-surface-muted)] px-2 py-1 text-[11px] font-semibold text-[var(--cc-foreground)]">
                    {autofillStateLabel[economicsSnapshot.cac.state] ?? economicsSnapshot.cac.state}
                  </span>
                </div>
                <p className="mt-2 text-lg font-semibold text-[var(--cc-foreground)]">
                  {economicsSnapshot.cac.value == null ? "—" : `${Number(economicsSnapshot.cac.value).toFixed(2)}`}
                </p>
                {economicsSnapshot.cac.value == null && economicsSnapshot.cac.missing.length > 0 && (
                  <p className="mt-1 text-xs text-[var(--cc-secondary)]">Em falta: {economicsSnapshot.cac.missing.join(", ")}</p>
                )}
                {economicsSnapshot.cac.source.length > 0 && (
                  <p className="mt-1 text-xs text-[var(--cc-secondary)]">Fonte: {economicsSnapshot.cac.source.join(" + ")}</p>
                )}
              </div>
              <div className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-[var(--cc-foreground)]">Taxa de conversão</p>
                  <span className="rounded-full bg-[var(--cc-surface-muted)] px-2 py-1 text-[11px] font-semibold text-[var(--cc-foreground)]">
                    {autofillStateLabel[economicsSnapshot.conversionRate.state] ?? economicsSnapshot.conversionRate.state}
                  </span>
                </div>
                <p className="mt-2 text-lg font-semibold text-[var(--cc-foreground)]">
                  {economicsSnapshot.conversionRate.value == null ? "—" : `${Number(economicsSnapshot.conversionRate.value).toFixed(2)}%`}
                </p>
                {economicsSnapshot.conversionRate.value == null && economicsSnapshot.conversionRate.missing.length > 0 && (
                  <p className="mt-1 text-xs text-[var(--cc-secondary)]">Em falta: {economicsSnapshot.conversionRate.missing.join(", ")}</p>
                )}
                {economicsSnapshot.conversionRate.source.length > 0 && (
                  <p className="mt-1 text-xs text-[var(--cc-secondary)]">Fonte: {economicsSnapshot.conversionRate.source.join(" + ")}</p>
                )}
              </div>
              <div className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-[var(--cc-foreground)]">Receita média por cliente</p>
                  <span className="rounded-full bg-[var(--cc-surface-muted)] px-2 py-1 text-[11px] font-semibold text-[var(--cc-foreground)]">
                    {autofillStateLabel[economicsSnapshot.arpu.state] ?? economicsSnapshot.arpu.state}
                  </span>
                </div>
                <p className="mt-2 text-lg font-semibold text-[var(--cc-foreground)]">
                  {economicsSnapshot.arpu.value == null ? "—" : `${Number(economicsSnapshot.arpu.value).toFixed(2)}`}
                </p>
                {economicsSnapshot.arpu.value == null && economicsSnapshot.arpu.missing.length > 0 && (
                  <p className="mt-1 text-xs text-[var(--cc-secondary)]">Em falta: {economicsSnapshot.arpu.missing.join(", ")}</p>
                )}
                {economicsSnapshot.arpu.source.length > 0 && (
                  <p className="mt-1 text-xs text-[var(--cc-secondary)]">Fonte: {economicsSnapshot.arpu.source.join(" + ")}</p>
                )}
              </div>
              <div className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-[var(--cc-foreground)]">Margem bruta</p>
                  <span className="rounded-full bg-[var(--cc-surface-muted)] px-2 py-1 text-[11px] font-semibold text-[var(--cc-foreground)]">
                    {autofillStateLabel[economicsSnapshot.grossMargin.state] ?? economicsSnapshot.grossMargin.state}
                  </span>
                </div>
                <p className="mt-2 text-lg font-semibold text-[var(--cc-foreground)]">
                  {economicsSnapshot.grossMargin.value == null ? "—" : `${Number(economicsSnapshot.grossMargin.value).toFixed(2)}%`}
                </p>
                {economicsSnapshot.grossMargin.value == null && economicsSnapshot.grossMargin.missing.length > 0 && (
                  <p className="mt-1 text-xs text-[var(--cc-secondary)]">Em falta: {economicsSnapshot.grossMargin.missing.join(", ")}</p>
                )}
                {economicsSnapshot.grossMargin.source.length > 0 && (
                  <p className="mt-1 text-xs text-[var(--cc-secondary)]">Fonte: {economicsSnapshot.grossMargin.source.join(" + ")}</p>
                )}
              </div>
              <div className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-[var(--cc-foreground)]">Prazo de retorno (meses)</p>
                  <span className="rounded-full bg-[var(--cc-surface-muted)] px-2 py-1 text-[11px] font-semibold text-[var(--cc-foreground)]">
                    {autofillStateLabel[economicsSnapshot.paybackMonths.state] ?? economicsSnapshot.paybackMonths.state}
                  </span>
                </div>
                <p className="mt-2 text-lg font-semibold text-[var(--cc-foreground)]">
                  {economicsSnapshot.paybackMonths.value == null ? "—" : `${Number(economicsSnapshot.paybackMonths.value).toFixed(2)}`}
                </p>
                {economicsSnapshot.paybackMonths.value == null && economicsSnapshot.paybackMonths.missing.length > 0 && (
                  <p className="mt-1 text-xs text-[var(--cc-secondary)]">Em falta: {economicsSnapshot.paybackMonths.missing.join(", ")}</p>
                )}
                {economicsSnapshot.paybackMonths.source.length > 0 && (
                  <p className="mt-1 text-xs text-[var(--cc-secondary)]">Fonte: {economicsSnapshot.paybackMonths.source.join(" + ")}</p>
                )}
              </div>
          </div>
          <p className="mt-3 text-xs text-[var(--cc-secondary)]">
            Moeda: {economicsSnapshot.currency.value ?? "Em falta"} · sem preenchimento financeiro artificial.
          </p>
        </Card>
      </div>

      <Card className="mt-6 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="inline-flex items-center gap-2 font-semibold text-[var(--cc-foreground)]">
              <CalendarCheck2 size={18} /> Controlo executivo
            </h2>
            <p className="mt-2 text-sm text-[var(--cc-secondary)]">
              Responsável: {projectOwner?.full_name || "não definido"} · próxima revisão: {project.next_review_date ? formatDate(project.next_review_date) : "não definida"} · Gate: {GOVERNANCE_GATE_LABELS[project.governance_gate] ?? project.governance_gate}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-[var(--cc-surface-muted)] px-2.5 py-1 text-[var(--cc-foreground)]">saúde {health.score}%</span>
            <span className="rounded-full bg-[var(--cc-surface-muted)] px-2.5 py-1 text-[var(--cc-foreground)]">{activeDependencies.length} dependência(s)</span>
            <span className="rounded-full bg-[var(--cc-surface-muted)] px-2.5 py-1 text-[var(--cc-foreground)]">{GOVERNANCE_STATUS_LABELS[project.governance_gate_status] ?? project.governance_gate_status}</span>
          </div>
        </div>
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between border-b border-[var(--cc-border)] p-5">
            <h2 className="inline-flex items-center gap-2 font-semibold text-[var(--cc-foreground)]"><CheckSquare2 size={18} /> Acções</h2>
            <Link className={secondaryButtonClass} href={`/actions?project_id=${project.id}`}>Gerir</Link>
          </div>
          <div className="p-5">
            {!actions?.length ? <EmptyState>Sem acções neste projecto.</EmptyState> : (
              <div className="space-y-3">
                {actions.slice(0, 8).map((action) => (
                  <div key={action.id} className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-[var(--cc-foreground)]">{action.title}</p>
                        <p className="mt-1 text-xs text-[var(--cc-secondary)]">{formatDateTime(action.due_at)} · {action.priority}</p>
                      </div>
                      {action.is_next_action && <span className="rounded-full bg-[color-mix(in_srgb,var(--cc-accent)_10%,white)] px-2 py-1 text-xs font-semibold text-[var(--cc-accent)]">próxima</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between border-b border-[var(--cc-border)] p-5">
            <h2 className="inline-flex items-center gap-2 font-semibold text-[var(--cc-foreground)]"><PackageCheck size={18} /> Entregáveis</h2>
            <Link className={secondaryButtonClass} href={`/deliverables?project_id=${project.id}`}>Gerir</Link>
          </div>
          <div className="p-5">
            {!deliverables?.length ? <EmptyState>Sem entregáveis neste projecto.</EmptyState> : (
              <div className="space-y-3">
                {deliverables.slice(0, 8).map((item) => (
                  <div key={item.id} className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-3">
                    <p className="text-sm font-medium text-[var(--cc-foreground)]">{item.title}</p>
                    <p className="mt-1 text-xs text-[var(--cc-secondary)]">{formatDate(item.due_date)} · {progressLabel(item.progress)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between border-b border-[var(--cc-border)] p-5">
            <h2 className="inline-flex items-center gap-2 font-semibold text-[var(--cc-foreground)]"><TriangleAlert size={18} /> Bloqueios</h2>
            <Link className={secondaryButtonClass} href={`/blockers?project_id=${project.id}`}>Gerir</Link>
          </div>
          <div className="p-5">
            {!openBlockers.length ? <EmptyState>Sem bloqueios activos.</EmptyState> : (
              <div className="space-y-3">
                {openBlockers.slice(0, 8).map((item) => (
                  <div key={item.id} className="rounded-[var(--cc-radius-md)] border border-[color-mix(in_srgb,var(--cc-warning)_32%,var(--cc-border))] bg-[var(--cc-warning-soft)]/40 p-3">
                    <p className="text-sm font-medium text-[var(--cc-foreground)]">{item.title}</p>
                    <p className="mt-1 text-xs text-[var(--cc-secondary)]">{item.responsible || "Responsável não definido"} · {formatDateTime(item.resolution_due_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between border-b border-[var(--cc-border)] p-5">
            <h2 className="inline-flex items-center gap-2 font-semibold text-[var(--cc-foreground)]"><BarChart3 size={18} /> Métricas</h2>
            <Link className={secondaryButtonClass} href={`/metrics?project_id=${project.id}`}>Gerir</Link>
          </div>
          <div className="p-5">
            {!metrics?.length ? <EmptyState>Sem métricas associadas.</EmptyState> : (
              <div className="space-y-3">
                {metrics.slice(0, 8).map((metric) => (
                  <div key={metric.id} className="flex items-center justify-between gap-4 rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-3">
                    <p className="text-sm font-medium text-[var(--cc-foreground)]">{metric.name}</p>
                    <p className="text-sm text-[var(--cc-secondary)]">{metric.current_value ?? "—"}{metric.unit ? ` ${metric.unit}` : ""} / {metric.target_value ?? "—"}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Memória do projecto</h2>
          <p className="mt-1 text-sm text-[var(--cc-secondary)]">Contexto persistente deste projecto. Não substitui os dados operacionais.</p>
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
          <div className="border-b border-[var(--cc-border)] p-5">
            <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Memória actual</h2>
          </div>
          <div className="p-5">
            {!memory?.length ? <EmptyState>Sem memória persistente neste projecto.</EmptyState> : (
              <div className="space-y-3">
                {memory.map((item) => (
                  <article key={item.id} className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-[var(--cc-foreground)]">{item.title}</p>
                      <span className="rounded-full bg-[var(--cc-surface-muted)] px-2 py-1 text-[11px] font-semibold text-[var(--cc-secondary)]">{item.memory_type.replaceAll("_", " ")}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--cc-foreground)]">{item.content}</p>
                    {item.source && <p className="mt-2 text-xs text-[var(--cc-secondary)]">Fonte: {item.source}</p>}
                  </article>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <div className="flex items-center justify-between border-b border-[var(--cc-border)] p-5">
          <h2 className="font-semibold text-[var(--cc-foreground)]">Decisões recentes</h2>
          <Link className={secondaryButtonClass} href={`/decisions?project_id=${project.id}`}>Gerir decisões</Link>
        </div>
        <div className="p-5">
          {!decisions?.length ? <EmptyState>Sem decisões registadas para este projecto.</EmptyState> : (
            <div className="space-y-3">
              {decisions.map((item) => (
                <article key={item.id} className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-3">
                  <p className="text-sm font-medium text-[var(--cc-foreground)]">{item.title}</p>
                  <p className="mt-1 text-xs text-[var(--cc-secondary)]">{formatDateTime(item.decided_at)}</p>
                  <p className="mt-2 text-sm text-[var(--cc-foreground)]">{item.decision}</p>
                </article>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card className="mt-6">
        <div className="flex items-center justify-between border-b border-[var(--cc-border)] p-5">
          <h2 className="inline-flex items-center gap-2 font-semibold text-[var(--cc-foreground)]"><ShieldCheck size={18} /> Evidência recente</h2>
          <Link className={secondaryButtonClass} href="/evidence">Gerir</Link>
        </div>
        <div className="p-5">
          {!evidence?.length ? <EmptyState>Sem evidência registada.</EmptyState> : (
            <div className="grid gap-3 md:grid-cols-2">
              {evidence.map((item) => (
                <div key={item.id} className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-3">
                  <p className="text-sm font-medium text-[var(--cc-foreground)]">{item.title || item.evidence_type}</p>
                  <p className="mt-1 text-xs text-[var(--cc-secondary)]">{formatDateTime(item.created_at)}</p>
                  {item.description && <p className="mt-2 text-sm text-[var(--cc-foreground)]">{item.description}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </>
  );
}
