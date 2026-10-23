import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createProjectChangeRequest,
  decideProjectChangeRequest,
  recordProjectCommitmentDecision,
  saveProjectCommitment,
  upsertProjectClosureAssessment,
} from "@/app/(protected)/mutations";
import { Field, Select, TextArea } from "@/components/form-fields";
import { PageHeader } from "@/components/page-header";
import { Card, EmptyState, primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { displayLabel } from "@/lib/display-label";
import { formatDateTime } from "@/lib/format";

export default async function ProjectCommitmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const [
    { data: project },
    { data: baselines },
    { data: changes },
    { data: closure },
    { data: risks },
    { data: dependencies },
  ] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).eq("user_id", user.id).maybeSingle(),
    supabase.from("project_commitment_baselines").select("*").eq("project_id", id).eq("user_id", user.id).order("version", { ascending: false }),
    supabase.from("project_change_requests").select("*").eq("project_id", id).eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("project_closure_assessments").select("*").eq("project_id", id).eq("user_id", user.id).maybeSingle(),
    supabase.from("project_governance_risks").select("id,gate,title,severity,status,blocks_progress").eq("project_id", id).eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("project_governance_dependencies").select("id,gate,required_item,status,blocks_progress").eq("project_id", id).eq("user_id", user.id).order("created_at", { ascending: false }),
  ]);
  if (!project) notFound();
  const latest = baselines?.[0];
  const editable = latest;
  const blockingG3Risks = (risks ?? []).filter((item) => item.gate === "g3_planning" && item.blocks_progress && ["open", "mitigating"].includes(item.status));
  const blockingG3Dependencies = (dependencies ?? []).filter((item) => item.gate === "g3_planning" && item.blocks_progress && ["pending", "resolving"].includes(item.status));

  return (
    <>
      <div className="mb-4"><Link className={secondaryButtonClass} href={`/projects/${project.id}`}>← Voltar ao projecto</Link></div>
      <PageHeader eyebrow="G3 → G5" title="Compromisso, alterações e fecho" />
      <Card className="mb-6 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-[var(--cc-foreground)]">{project.title}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">O PCC só inicia execução material depois de validar capacidade, financeiro e segurança e de o cliente confirmar aquilo que espera receber.</p>
          </div>
          <span className="rounded-full bg-[var(--cc-surface-muted)] px-3 py-1 text-xs font-semibold text-[var(--cc-secondary)]">{project.governance_gate} · {project.governance_gate_status}</span>
        </div>
        {(blockingG3Risks.length > 0 || blockingG3Dependencies.length > 0) && (
          <p className="mt-3 rounded-[var(--cc-radius-md)] bg-amber-50 p-3 text-sm text-amber-900">G3 tem {blockingG3Risks.length} risco(s) e {blockingG3Dependencies.length} dependência(s) bloqueante(s).</p>
        )}
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Definição do Projecto e Compromisso de Entrega</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">A versão aprovada pelo cliente torna-se a baseline. Depois disso, alterações materiais passam por Pedido de Alteração.</p>
          {latest && (
            <div className="mt-4 rounded-[var(--cc-radius-md)] bg-[var(--cc-surface-muted)] p-3 text-sm">
              <strong>Versão {latest.version}</strong> · {displayLabel(latest.status)}
              {latest.client_validated_at ? ` · cliente validou em ${formatDateTime(latest.client_validated_at)}` : ""}
            </div>
          )}
          <form action={saveProjectCommitment} className="mt-5 space-y-4">
            <input type="hidden" name="project_id" value={project.id} />
            <TextArea label="Resultado esperado" name="expected_result" required defaultValue={editable?.expected_result ?? project.expected_result ?? ""} />
            <TextArea label="Âmbito incluído" name="scope_included" required defaultValue={editable?.scope_included ?? ""} />
            <TextArea label="Exclusões" name="exclusions" required defaultValue={editable?.exclusions ?? ""} />
            <TextArea label="Entregáveis que o cliente receberá" name="deliverables_summary" required defaultValue={editable?.deliverables_summary ?? ""} />
            <TextArea label="Como serão aceites" name="acceptance_summary" required defaultValue={editable?.acceptance_summary ?? ""} />
            <TextArea label="Responsabilidades do PCC" name="pcc_responsibilities" required defaultValue={editable?.pcc_responsibilities ?? ""} />
            <TextArea label="Responsabilidades do cliente" name="client_responsibilities" required defaultValue={editable?.client_responsibilities ?? ""} />
            <TextArea label="Premissas e dependências" name="assumptions_dependencies" required defaultValue={editable?.assumptions_dependencies ?? ""} />
            <TextArea label="Validação de capacidade" name="capacity_validation" required defaultValue={editable?.capacity_validation ?? ""} />
            <TextArea label="Validação financeira / margem" name="financial_validation" required defaultValue={editable?.financial_validation ?? ""} />
            <TextArea label="Validação de segurança" name="security_validation" required defaultValue={editable?.security_validation ?? ""} />
            <TextArea label="Custos externos e trabalhos paralelos" name="external_costs_note" required defaultValue={editable?.external_costs_note ?? "Domínios, hosting, licenças, publicidade, fornecedores e trabalhos paralelos são orçamentados separadamente, salvo aprovação expressa em contrário."} />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Preço" name="price" type="number" step="any" min={0} defaultValue={editable?.price ?? undefined} />
              <Field label="Moeda" name="currency" defaultValue={editable?.currency ?? project.currency ?? "MZN"} />
              <Field label="Prazo" name="due_date" type="date" defaultValue={editable?.due_date ?? project.due_date ?? undefined} />
            </div>
            <div className="flex flex-wrap gap-3">
              <button className={secondaryButtonClass} type="submit" name="intent" value="save">Guardar rascunho</button>
              <button className={primaryButtonClass} type="submit" name="intent" value="submit_client">Validar PCC e apresentar ao cliente</button>
            </div>
          </form>
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Validação do cliente</h2>
            {latest?.status === "awaiting_client" ? (
              <form action={recordProjectCommitmentDecision} className="mt-5 space-y-4">
                <input type="hidden" name="project_id" value={project.id} />
                <input type="hidden" name="baseline_id" value={latest.id} />
                <Field label="Quem validou pelo cliente" name="client_validator" required />
                <Field label="Referência da aprovação" name="approval_reference" placeholder="Ex.: email, acta, documento assinado" />
                <TextArea label="Observação" name="notes" />
                <div className="flex flex-wrap gap-3">
                  <button className={primaryButtonClass} type="submit" name="decision" value="approved">Cliente aprova</button>
                  <button className={secondaryButtonClass} type="submit" name="decision" value="rejected">Pedir ajustes</button>
                </div>
              </form>
            ) : latest?.status === "approved" ? (
              <p className="mt-3 text-sm text-[var(--cc-secondary)]">Baseline v{latest.version} aprovada por {latest.client_validator || "cliente"}.</p>
            ) : (
              <EmptyState>Apresente primeiro uma baseline ao cliente.</EmptyState>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Pedido de Alteração</h2>
            <p className="mt-2 text-sm text-[var(--cc-secondary)]">Mudanças materiais de âmbito, prazo, custo, capacidade ou segurança não alteram silenciosamente a baseline.</p>
            <form action={createProjectChangeRequest} className="mt-5 space-y-4">
              <input type="hidden" name="project_id" value={project.id} />
              <TextArea label="Alteração solicitada" name="request_summary" required />
              <TextArea label="Impacto no âmbito" name="impact_scope" required />
              <TextArea label="Impacto no prazo" name="impact_schedule" required />
              <TextArea label="Impacto no custo" name="impact_cost" required />
              <TextArea label="Impacto na capacidade" name="impact_capacity" required />
              <TextArea label="Impacto na segurança" name="impact_security" required />
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Variação de custo" name="cost_delta" type="number" step="any" />
                <Field label="Moeda" name="currency" defaultValue={project.currency ?? "MZN"} />
                <Field label="Variação de prazo (dias)" name="due_date_delta_days" type="number" />
              </div>
              <button className={secondaryButtonClass} type="submit">Registar alteração</button>
            </form>
            <div className="mt-5 space-y-3">
              {(changes ?? []).map((change) => (
                <div key={change.id} className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-3">
                  <p className="text-sm font-semibold text-[var(--cc-foreground)]">{change.request_summary}</p>
                  <p className="mt-1 text-xs text-[var(--cc-secondary)]">Baseline v{change.baseline_version} · {displayLabel(change.status)}</p>
                  {["requested", "approved"].includes(change.status) && (
                    <form action={decideProjectChangeRequest} className="mt-3 space-y-2">
                      <input type="hidden" name="project_id" value={project.id} />
                      <input type="hidden" name="change_request_id" value={change.id} />
                      <Field label="Fundamentação" name="decision_rationale" required />
                      <div className="flex flex-wrap gap-2">
                        {change.status === "requested" && (<>
                          <button className={secondaryButtonClass} type="submit" name="decision" value="approved">Aprovar alteração</button>
                          <button className={secondaryButtonClass} type="submit" name="decision" value="rejected">Rejeitar</button>
                        </>)}
                        {change.status === "approved" && <button className={secondaryButtonClass} type="submit" name="decision" value="implemented">Marcar implementada</button>}
                      </div>
                    </form>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Card className="mt-6 p-5">
        <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Preparação do G5 — Valor, handover e segurança</h2>
        <form action={upsertProjectClosureAssessment} className="mt-5 space-y-4">
          <input type="hidden" name="project_id" value={project.id} />
          <Select label="Estado do valor" name="value_status" defaultValue={closure?.value_status ?? "not_assessed"}>
            <option value="not_assessed">Ainda não avaliado</option>
            <option value="proven">Valor comprovado</option>
            <option value="observing">Valor em observação</option>
            <option value="not_proven">Valor não comprovado</option>
          </Select>
          <TextArea label="Síntese do valor" name="value_summary" required defaultValue={closure?.value_summary ?? ""} />
          {[
            ["client_acceptance_complete", "Aceitação global do cliente confirmada"],
            ["changes_closed", "Alterações de âmbito encerradas"],
            ["financials_updated", "Financeiro actualizado"],
            ["handover_required", "O projecto exige handover / transferência"],
            ["handover_complete", "Handover concluído"],
            ["access_transfer_complete", "Propriedade e acessos transferidos"],
            ["temporary_access_revoked", "Acessos temporários revogados"],
            ["data_retention_reviewed", "Arquivo e retenção de dados revistos"],
          ].map(([name, label]) => (
            <label key={name} className="flex items-start gap-3 rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-3 text-sm">
              <input type="checkbox" name={name} defaultChecked={Boolean(closure?.[name])} className="mt-1" />
              <span>{label}</span>
            </label>
          ))}
          <TextArea label="Notas de segurança / transferência" name="security_transfer_notes" defaultValue={closure?.security_transfer_notes ?? ""} />
          <TextArea label="Continuidade / recuperação / manutenção" name="continuity_notes" defaultValue={closure?.continuity_notes ?? ""} />
          <button className={primaryButtonClass} type="submit">Guardar preparação do fecho</button>
        </form>
      </Card>
    </>
  );
}
