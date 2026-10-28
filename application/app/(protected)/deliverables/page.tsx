import { DeliverableGeneration } from "@/components/deliverable-generation";
import Link from "next/link";
import { createDeliverable, recordDeliverableAcceptance, recordDeliverableQA } from "@/app/(protected)/mutations";
import { Field, Select, TextArea } from "@/components/form-fields";
import { PageHeader } from "@/components/page-header";
import { Card, EmptyState, primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { displayLabel } from "@/lib/display-label";

export default async function DeliverablesPage({
  searchParams,
}: {
  searchParams: Promise<{ project_id?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();

  const [{ data: projects, error: projectError }, { data: deliverables, error: deliverableError }] =
    await Promise.all([
      supabase
        .from("projects")
        .select("id,title,status")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("deliverables")
        .select("id,project_id,title,description,status,progress,due_date,completion_criteria,artifact_type,artifact_url,artifact_reference,artifact_version,qa_status,acceptance_status,accepted_at,created_at,updated_at")
        .eq("user_id", user.id)
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true }),
    ]);

  const archive = process.env.PCC_ARTIFACT_GENERATION_ENABLED === "true"
    ? await supabase.from("generated_deliverable_artifacts").select("id,deliverable_id,document_kind,created_at,previous_url:source_snapshot->deliverable->>artifact_url").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1000)
    : { data: [], error: null };
  const error = projectError?.message ?? deliverableError?.message ?? archive.error?.message;
  const visibleProjects = params.project_id
    ? (projects ?? []).filter((project) => project.id === params.project_id)
    : projects ?? [];

  return (
    <>
      <PageHeader eyebrow="Resultados do Projecto" title="Entregáveis" />

      {error && <Card className="mb-6 p-5 text-sm text-[var(--cc-danger)]">{error}</Card>}

      <div className="space-y-5">
        {visibleProjects.map((project) => {
          const projectDeliverables = (deliverables ?? []).filter((item) => item.project_id === project.id);
          const accepted = projectDeliverables.filter((item) => item.acceptance_status === "accepted").length;
          const evidenced = projectDeliverables.filter((item) => Boolean(item.artifact_url || item.artifact_reference)).length;

          return (
            <Card key={project.id} className="p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--cc-secondary)]">Projecto</p>
                  <h2 className="mt-1 text-xl font-semibold text-[var(--cc-foreground)]">{project.title}</h2>
                  <p className="mt-2 text-sm text-[var(--cc-secondary)]">
                    {projectDeliverables.length
                      ? `${accepted}/${projectDeliverables.length} aceite(s) · ${evidenced} com evidência`
                      : "Ainda sem entregáveis definidos."}
                  </p>
                </div>
                <Link className={secondaryButtonClass} href={"/projects/" + project.id}>Abrir projecto</Link>
              </div>

              <details className="mt-5 rounded-[var(--cc-radius-md)] border border-[var(--cc-border)]">
                <summary className="cursor-pointer list-none p-4 text-sm font-semibold text-[var(--cc-accent)]">
                  Adicionar entregável
                </summary>
                <form action={createDeliverable} className="space-y-4 border-t border-[var(--cc-border)] p-4">
                  <input type="hidden" name="project_id" value={project.id} />
                  <input type="hidden" name="workstream" value="general" />
                  <input type="hidden" name="return_path" value="/deliverables" />
                  <input type="hidden" name="status" value="pending" />
                  <input type="hidden" name="progress" value="0" />
                  <input type="hidden" name="priority" value="medium" />
                  <Field label="Entregável" name="title" required placeholder="Resultado concreto a produzir" />
                  <TextArea label="Descrição" name="description" />
                  <TextArea label="Critério de aceitação" name="completion_criteria" required />
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Prazo" name="due_date" type="date" />
                    <Select label="Formato do resultado" name="artifact_type" defaultValue="document">
                      <option value="document">Documento</option>
                      <option value="spreadsheet">Folha de cálculo</option>
                      <option value="presentation">Apresentação</option>
                      <option value="pdf">PDF</option>
                      <option value="website">Website</option>
                      <option value="application">Aplicação</option>
                      <option value="dashboard">Dashboard</option>
                      <option value="api">API</option>
                      <option value="dataset">Dataset</option>
                      <option value="prototype">Protótipo</option>
                      <option value="other">Outro</option>
                    </Select>
                  </div>
                  <Field label="URL da evidência, quando já existir" name="artifact_url" type="url" />
                  <Field label="Referência da evidência / versão" name="artifact_reference" />
                  <button className={primaryButtonClass} type="submit">Registar entregável</button>
                </form>
              </details>

              {projectDeliverables.length ? (
                <div className="mt-5 space-y-3">
                  {projectDeliverables.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface-strong)] p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-[var(--cc-foreground)]">{item.title}</h3>
                          {item.description && (
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--cc-secondary)]">
                              {item.description}
                            </p>
                          )}
                        </div>
                        <span className="rounded-full bg-[var(--cc-surface-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--cc-foreground)]">
                          {item.acceptance_status === "accepted"
                            ? "Aceite"
                            : item.qa_status && item.qa_status !== "pending"
                              ? displayLabel(item.qa_status)
                              : displayLabel(item.status)}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
                        <Info label="Critério de aceitação" value={item.completion_criteria || "Por definir"} />
                        <Info
                          label="Evidência"
                          value={item.artifact_reference || (item.artifact_url ? "Link disponível" : "Em falta — sem URL ou referência")}
                        />
                        <Info label="Prazo" value={item.due_date ? formatDate(item.due_date) : "Sem prazo"} />
                        <Info
                          label="Validação"
                          value={item.acceptance_status === "accepted"
                            ? `Aceite${item.accepted_at ? ` · ${formatDate(item.accepted_at)}` : ""}`
                            : displayLabel(item.acceptance_status || "pending")}
                        />
                      </div>

                      {!item.artifact_url && !item.artifact_reference && (
                        <div role="alert" className="mt-4 rounded-[var(--cc-radius-md)] border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                          <p className="font-semibold">Falta o resultado verificável deste entregável.</p>
                          <p className="mt-1">
                            {process.env.PCC_ARTIFACT_GENERATION_ENABLED === "true" && item.status !== "completed" && ["document", "pdf", "spreadsheet", "presentation"].includes(item.artifact_type)
                              ? "Use Gerar e arquivar rascunho abaixo. A geração indicará os dados ainda necessários; QA e aceitação continuam sujeitos a revisão."
                              : "Associe uma evidência existente ou complete os dados em falta. A geração automática não está disponível para este entregável neste ambiente."}
                          </p>
                          <Link href={`/evidence?project_id=${project.id}&deliverable_id=${item.id}`} className="mt-2 inline-block font-semibold underline">Registar evidência deste entregável</Link>
                        </div>
                      )}

                      {process.env.PCC_ARTIFACT_GENERATION_ENABLED === "true" && item.status !== "completed" && ["document", "pdf", "spreadsheet", "presentation"].includes(item.artifact_type) && (
                        <DeliverableGeneration id={item.id} type={item.artifact_type} hasArtifact={Boolean(item.artifact_url)} />
                      )}
                      {(archive.data ?? []).some(version => version.deliverable_id === item.id) && (
                        <details className="mt-3 text-sm"><summary className="cursor-pointer font-semibold">Histórico de ficheiros gerados</summary>
                          <ul className="mt-2 space-y-2">{(archive.data ?? []).filter(version => version.deliverable_id === item.id).map(version => <li key={version.id}>
                            <a className="underline" href={`/api/deliverables/artifacts/${version.id}/download`}>{formatDate(version.created_at)} · {version.document_kind} · {version.id.slice(0,8)}</a>
                          </li>)}</ul>
                        </details>
                      )}
                      {item.artifact_url && (
                        <div className="mt-4">
                          <a className={secondaryButtonClass} href={item.artifact_url} target="_blank" rel="noreferrer">
                            Abrir entregável{item.artifact_version ? ` · v${item.artifact_version}` : ""}
                          </a>
                        </div>
                      )}

                      <details className="mt-4 border-t border-[var(--cc-border)] pt-4">
                        <summary className="cursor-pointer text-sm font-semibold text-[var(--cc-accent)]">
                          QA e validação
                        </summary>
                        <div className="mt-4 grid gap-4 lg:grid-cols-2">
                          <form action={recordDeliverableQA} className="space-y-3 rounded-[var(--cc-radius-md)] bg-[var(--cc-surface-muted)] p-4">
                            <input type="hidden" name="deliverable_id" value={item.id} />
                            <input type="hidden" name="project_id" value={project.id} />
                            <Select label="QA" name="qa_status" defaultValue={item.qa_status || "pending"}>
                              <option value="pending" disabled>Por rever</option>
                              <option value="passed">Aprovado</option>
                              <option value="failed">Reprovado</option>
                              <option value="not_required">Não aplicável</option>
                            </Select>
                            <TextArea label="Notas de QA" name="qa_notes" />
                            <button className={secondaryButtonClass} type="submit">Guardar QA</button>
                          </form>

                          <form action={recordDeliverableAcceptance} className="space-y-3 rounded-[var(--cc-radius-md)] bg-[var(--cc-surface-muted)] p-4">
                            <input type="hidden" name="deliverable_id" value={item.id} />
                            <input type="hidden" name="project_id" value={project.id} />
                            <Select label="Validação / aceitação" name="acceptance_status" defaultValue={item.acceptance_status || "pending"}>
                              <option value="pending" disabled>Por validar</option>
                              <option value="accepted">Aceite</option>
                              <option value="accepted_with_reservations">Aceite com reservas</option>
                              <option value="correction_required">Correcção necessária</option>
                              <option value="not_required">Não aplicável</option>
                            </Select>
                            <Field label="Referência da validação" name="acceptance_reference" placeholder="Ex.: email, reunião, documento assinado" />
                            <TextArea label="Notas" name="acceptance_notes" />
                            <button className={secondaryButtonClass} type="submit">Registar validação</button>
                          </form>
                        </div>
                      </details>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="mt-5">
                  <EmptyState>
                    Os entregáveis devem representar resultados concretos do projecto e ter critério de aceitação, evidência e validação quando aplicável.
                  </EmptyState>
                </div>
              )}
            </Card>
          );
        })}
        {!visibleProjects.length && <EmptyState>Sem projectos para apresentar.</EmptyState>}
      </div>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-[var(--cc-secondary)]">{label}</p>
      <p className="mt-1 text-[var(--cc-foreground)]">{value}</p>
    </div>
  );
}
