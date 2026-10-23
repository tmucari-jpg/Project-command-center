import Link from "next/link";
import { BriefcaseBusiness, CircleDollarSign, ContactRound, PackageCheck, TrendingUp } from "lucide-react";
import {
  createCommercialLead,
  createDeliverable,
  createFinancialEntry,
  upsertCommercialProfile,
} from "@/app/(protected)/mutations";
import { Field, Select, TextArea } from "@/components/form-fields";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { Card, EmptyState, primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import { PRIORITIES } from "@/lib/constants";
import { requireAdmin } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/format";
import { displayLabel } from "@/lib/display-label";
import { monetizationReadiness } from "@/lib/monetization";

const PIPELINE_STAGES = [
  ["contact", "Contacto"],
  ["interest", "Interesse"],
  ["diagnosis", "Diagnóstico"],
  ["demonstration", "Demonstração"],
  ["proposal", "Proposta"],
  ["client", "Cliente"],
  ["handoff", "Handoff"],
  ["lost", "Perdido"],
] as const;

export default async function CommercialPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; lead?: string; entry?: string; created?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireAdmin();

  const [
    { data: projects, error: projectsError },
    { data: profiles, error: profilesError },
    { data: leads, error: leadsError },
    { data: entries, error: entriesError },
    { data: commercialDeliverables, error: deliverablesError },
  ] = await Promise.all([
    supabase.from("projects").select("id,title,status,priority").eq("user_id", user.id).order("title"),
    supabase.from("project_commercial_profiles").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }),
    supabase.from("commercial_leads").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(100),
    supabase.from("financial_entries").select("*").eq("user_id", user.id).order("occurred_on", { ascending: false }).limit(100),
    supabase.from("deliverables").select("*").eq("user_id", user.id).eq("workstream", "commercial").order("created_at", { ascending: false }).limit(150),
  ]);

  const error =
    projectsError?.message ??
    profilesError?.message ??
    leadsError?.message ??
    entriesError?.message ??
    deliverablesError?.message;

  const projectById = new Map((projects ?? []).map((project) => [project.id, project]));
  const profileByProject = new Map((profiles ?? []).map((profile) => [profile.project_id, profile]));
  const commercialProjectIds = new Set<string>();
  (profiles ?? []).forEach((item) => commercialProjectIds.add(item.project_id));
  (leads ?? []).forEach((item) => commercialProjectIds.add(item.project_id));
  (commercialDeliverables ?? []).forEach((item) => commercialProjectIds.add(item.project_id));

  const commercialProjects = (projects ?? []).filter((project) => commercialProjectIds.has(project.id));
  const projectOptions = commercialProjects.length ? commercialProjects : (projects ?? []);
  const backlog = commercialProjects.filter((project) => profileByProject.get(project.id)?.validation_status !== "validated");
  const activeLeads = (leads ?? []).filter((lead) => !["handoff", "lost"].includes(lead.stage));
  const openCommercialDeliverables = (commercialDeliverables ?? []).filter(
    (item) => !["completed", "cancelled"].includes(item.status),
  );
  const commercialEntries = (entries ?? []).filter((entry) => commercialProjectIds.has(entry.project_id));

  return (
    <>
      <PageHeader
        eyebrow="Administração · capacidade transversal"
        title="Comercial"
        action={<Link className={secondaryButtonClass} href="/commercial-master">Pré-visualizar Master Comercial do PCC</Link>}
      />

      <FlashMessage
        error={params.error ?? error}
        created={params.saved ?? params.lead ?? params.entry ?? params.created}
        message={
          params.saved
            ? "Vertente comercial actualizada."
            : params.lead
              ? "Lead registado."
              : params.entry
                ? "Movimento financeiro registado."
                : params.created
                  ? "Entregável comercial registado."
                  : undefined
        }
      />

      <Card className="mb-6 border-[color-mix(in_srgb,var(--cc-gold)_45%,var(--cc-border))] bg-[color-mix(in_srgb,var(--cc-gold)_7%,var(--cc-surface))] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--cc-gold)]">Regra da área</p>
        <h2 className="mt-2 text-xl font-semibold text-[var(--cc-accent)]">Comercial serve todos os projectos que precisam de vertente comercial.</h2>
        <p className="mt-2 max-w-5xl text-sm leading-6 text-[var(--cc-secondary)]">
          Aqui são tratados backlog, avaliação comercial, oferta e preço, pipeline, leads, custos/receitas e entregáveis comerciais.
          Nada é separado do projecto: cada registo mantém a ligação ao projecto de origem e os resultados finais aparecem também em Entregáveis.
        </p>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <p className="text-sm text-[var(--cc-secondary)]">Backlog comercial</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--cc-foreground)]">{backlog.length}</p>
          <p className="mt-2 text-xs text-[var(--cc-secondary)]">Projectos com vertente comercial por validar ou concluir.</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-[var(--cc-secondary)]">Pipeline activo</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--cc-foreground)]">{activeLeads.length}</p>
          <p className="mt-2 text-xs text-[var(--cc-secondary)]">Oportunidades ainda entre contacto, interesse, diagnóstico, demonstração, proposta ou cliente.</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-[var(--cc-secondary)]">Entregáveis comerciais</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--cc-foreground)]">{openCommercialDeliverables.length}</p>
          <p className="mt-2 text-xs text-[var(--cc-secondary)]">Resultados comerciais em preparação ou validação.</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-[var(--cc-secondary)]">Projectos comerciais</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--cc-foreground)]">{commercialProjects.length}</p>
          <p className="mt-2 text-xs text-[var(--cc-secondary)]">Projectos actualmente ligados a esta capacidade.</p>
        </Card>
      </div>

      <Card className="mt-6">
        <div className="border-b border-[var(--cc-border)] p-5">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-[var(--cc-foreground)]">
            <BriefcaseBusiness size={19} /> Backlog comercial por projecto
          </h2>
          <p className="mt-1 text-sm text-[var(--cc-secondary)]">
            Um projecto entra nesta área quando precisa de análise, validação ou execução comercial.
          </p>
        </div>
        <div className="p-5">
          {!commercialProjects.length ? (
            <EmptyState>Ainda não existem projectos ligados à vertente comercial.</EmptyState>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {commercialProjects.map((project) => {
                const profile = profileByProject.get(project.id);
                const readiness = monetizationReadiness(profile);
                const projectLeads = (leads ?? []).filter((lead) => lead.project_id === project.id);
                const projectDeliverables = (commercialDeliverables ?? []).filter((item) => item.project_id === project.id);
                return (
                  <article key={project.id} className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-[var(--cc-foreground)]">{project.title}</h3>
                        <p className="mt-1 text-xs text-[var(--cc-secondary)]">
                          {profile?.validation_status ? displayLabel(profile.validation_status) : "Por estruturar"}
                        </p>
                      </div>
                      <span className="rounded-full bg-[var(--cc-surface-muted)] px-2 py-1 text-[10px] font-semibold text-[var(--cc-secondary)]">
                        {readiness.score}%
                      </span>
                    </div>
                    <p className="mt-3 text-xs text-[var(--cc-secondary)]">
                      {projectLeads.length} lead(s) · {projectDeliverables.length} entregável(is) comercial(is)
                    </p>
                    {readiness.missing.length > 0 && (
                      <p className="mt-2 text-xs text-[var(--cc-secondary)]">Em falta: {readiness.missing.join(", ")}</p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold">
                      <Link href={"/projects/" + project.id} className="text-[var(--cc-accent)] hover:underline">Abrir projecto</Link>
                      <Link href={"/deliverables?project_id=" + project.id} className="text-[var(--cc-accent)] hover:underline">Entregáveis</Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      <Card className="mt-6 p-5">
        <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-[var(--cc-foreground)]">
          <TrendingUp size={19} /> Pipeline
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
          {PIPELINE_STAGES.map(([stage, label]) => {
            const count = (leads ?? []).filter((lead) => lead.stage === stage).length;
            return (
              <div key={stage} className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface-muted)] p-3">
                <p className="text-xs font-semibold text-[var(--cc-secondary)]">{label}</p>
                <p className="mt-1 text-2xl font-semibold text-[var(--cc-foreground)]">{count}</p>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-[var(--cc-foreground)]">
            <BriefcaseBusiness size={19} /> Adicionar / actualizar projecto comercial
          </h2>
          <form action={upsertCommercialProfile} className="mt-5 space-y-4">
            <Select label="Projecto" name="project_id" required defaultValue="">
              <option value="" disabled>Seleccione</option>
              {(projects ?? []).map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
            </Select>
            <TextArea label="Oferta / proposta de valor" name="offer" />
            <TextArea label="Cliente / público ideal" name="ideal_customer" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Preço, se conhecido" name="price" type="number" step="any" />
              <Field label="Moeda" name="currency" placeholder="MZN" />
            </div>
            <Field label="Canal prioritário" name="channel" placeholder="Directo, WhatsApp, parceiros..." />
            <Select label="Estado da validação comercial" name="validation_status" defaultValue="draft">
              <option value="not_ready">Não preparado</option>
              <option value="draft">Backlog / rascunho</option>
              <option value="ready_to_validate">Pronto para validar</option>
              <option value="validating">Em validação</option>
              <option value="validated">Validado</option>
            </Select>
            <label className="flex items-center gap-2 text-sm font-medium text-[var(--cc-foreground)]">
              <input type="checkbox" name="is_priority" className="size-4 rounded border-[var(--cc-border)]" />
              Prioridade comercial
            </label>
            <button className={primaryButtonClass} type="submit">Guardar vertente comercial</button>
          </form>
        </Card>

        <Card className="p-5">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-[var(--cc-foreground)]">
            <ContactRound size={19} /> Novo lead
          </h2>
          <form action={createCommercialLead} className="mt-5 space-y-4">
            <Select label="Projecto" name="project_id" required defaultValue="">
              <option value="" disabled>Seleccione</option>
              {projectOptions.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
            </Select>
            <Field label="Lead / contacto" name="name" required />
            <Field label="Organização" name="organisation" />
            <Field label="Referência de contacto" name="contact_reference" placeholder="Email, telefone ou referência conhecida" />
            <Field label="Origem" name="source" />
            <Select label="Etapa do pipeline" name="stage" defaultValue="lead">
              {PIPELINE_STAGES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Valor, se conhecido" name="value" type="number" step="any" />
              <Field label="Moeda" name="currency" placeholder="MZN" />
            </div>
            <TextArea label="Próxima acção" name="next_action" />
            <Field label="Data da próxima acção" name="next_action_at" type="datetime-local" />
            <TextArea label="Informação em falta" name="information_missing" />
            <button className={primaryButtonClass} type="submit">Registar lead</button>
          </form>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-[var(--cc-foreground)]">
            <PackageCheck size={19} /> Novo entregável comercial
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
            O resultado é processado aqui, mas fica arquivado no projecto e disponível em Entregáveis para consulta, download, evidência e fecho.
          </p>
          <form action={createDeliverable} className="mt-5 space-y-4">
            <input type="hidden" name="workstream" value="commercial" />
            <input type="hidden" name="return_path" value="/monetization" />
            <input type="hidden" name="status" value="pending" />
            <input type="hidden" name="progress" value="0" />
            <Select label="Projecto" name="project_id" required defaultValue="">
              <option value="" disabled>Seleccione</option>
              {projectOptions.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
            </Select>
            <Field label="Entregável" name="title" required placeholder="Ex.: Proposta comercial final" />
            <TextArea label="Matéria real a entregar" name="description" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Prioridade" name="priority" defaultValue="medium">
                {PRIORITIES.map((value) => <option key={value} value={value}>{displayLabel(value)}</option>)}
              </Select>
              <Field label="Prazo" name="due_date" type="date" />
            </div>
            <TextArea label="Critérios de aceitação" name="completion_criteria" />
            <Select label="Formato do resultado" name="artifact_type" defaultValue="document">
              <option value="document">Documento editável</option>
              <option value="spreadsheet">Folha de cálculo</option>
              <option value="presentation">Apresentação</option>
              <option value="pdf">PDF</option>
              <option value="website">Website</option>
              <option value="dashboard">Dashboard</option>
              <option value="dataset">Dataset</option>
              <option value="other">Outro</option>
            </Select>
            <Field label="URL do resultado, quando já existir" name="artifact_url" type="url" />
            <Field label="Referência da versão" name="artifact_reference" />
            <button className={primaryButtonClass} type="submit">Registar entregável comercial</button>
          </form>
        </Card>

        <Card className="p-5">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-[var(--cc-foreground)]">
            <CircleDollarSign size={19} /> Receita / custo
          </h2>
          <form action={createFinancialEntry} className="mt-5 space-y-4">
            <Select label="Projecto" name="project_id" required defaultValue="">
              <option value="" disabled>Seleccione</option>
              {projectOptions.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
            </Select>
            <Select label="Tipo" name="entry_type" defaultValue="revenue">
              <option value="revenue">Receita</option>
              <option value="cost">Custo</option>
            </Select>
            <Field label="Categoria" name="category" />
            <Field label="Descrição" name="description" required />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Montante" name="amount" type="number" step="any" min={0} required />
              <Field label="Moeda" name="currency" defaultValue="MZN" required />
            </div>
            <Field label="Data" name="occurred_on" type="date" />
            <Select label="Estado" name="status" defaultValue="actual">
              <option value="actual">Realizado</option>
              <option value="forecast">Previsão</option>
              <option value="pending">Pendente</option>
            </Select>
            <Field label="Referência de evidência" name="evidence_reference" />
            <button className={primaryButtonClass} type="submit">Registar movimento</button>
          </form>
        </Card>
      </div>

      <Card className="mt-6">
        <div className="border-b border-[var(--cc-border)] p-5">
          <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Leads e próximas acções</h2>
        </div>
        <div className="p-5">
          {!leads?.length ? (
            <EmptyState>Sem leads registados.</EmptyState>
          ) : (
            <div className="space-y-3">
              {leads.map((lead) => (
                <article key={lead.id} className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-[var(--cc-foreground)]">{lead.name}</p>
                      <p className="mt-1 text-xs text-[var(--cc-secondary)]">
                        {projectById.get(lead.project_id)?.title ?? "Projecto"} · {displayLabel(lead.stage)}
                      </p>
                    </div>
                    {lead.value !== null && lead.value !== undefined && (
                      <span className="text-sm font-semibold text-[var(--cc-foreground)]">{lead.value} {lead.currency ?? ""}</span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-[var(--cc-secondary)]">
                    Próxima acção: {lead.next_action || "Em falta"}
                    {lead.next_action_at ? <> · {formatDateTime(lead.next_action_at)}</> : null}
                  </p>
                </article>
              ))}
            </div>
          )}
        </div>
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <div className="border-b border-[var(--cc-border)] p-5">
            <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Entregáveis comerciais</h2>
          </div>
          <div className="p-5">
            {!commercialDeliverables?.length ? (
              <EmptyState>Sem entregáveis comerciais registados.</EmptyState>
            ) : (
              <div className="space-y-3">
                {commercialDeliverables.map((item) => (
                  <article key={item.id} className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-[var(--cc-foreground)]">{item.title}</p>
                        <p className="mt-1 text-xs text-[var(--cc-secondary)]">
                          {projectById.get(item.project_id)?.title ?? "Projecto"} · {displayLabel(item.status)} · {item.progress ?? 0}%
                        </p>
                      </div>
                      {item.artifact_url && (
                        <a href={item.artifact_url} className="text-xs font-semibold text-[var(--cc-accent)] hover:underline">
                          Baixar / abrir
                        </a>
                      )}
                    </div>
                    <Link href={"/deliverables?project_id=" + item.project_id} className="mt-3 inline-flex text-xs font-semibold text-[var(--cc-accent)] hover:underline">
                      Abrir em Entregáveis
                    </Link>
                  </article>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className="border-b border-[var(--cc-border)] p-5">
            <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Receitas e custos comerciais</h2>
          </div>
          <div className="p-5">
            {!commercialEntries.length ? (
              <EmptyState>Sem movimentos financeiros ligados aos projectos comerciais.</EmptyState>
            ) : (
              <div className="space-y-3">
                {commercialEntries.map((entry) => (
                  <article key={entry.id} className="flex flex-col justify-between gap-2 rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-4 sm:flex-row sm:items-center">
                    <div>
                      <p className="text-sm font-medium text-[var(--cc-foreground)]">{entry.description}</p>
                      <p className="mt-1 text-xs text-[var(--cc-secondary)]">
                        {projectById.get(entry.project_id)?.title ?? "Projecto"} · {formatDate(entry.occurred_on)} · {displayLabel(entry.status)}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-[var(--cc-foreground)]">
                      {entry.entry_type === "cost" ? "−" : "+"}{entry.amount} {entry.currency}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-6 p-5">
        <p className="text-sm leading-6 text-[var(--cc-secondary)]">
          O PCC não inventa leads, preços, probabilidades, receitas ou custos. A inteligência apoia análise e produção,
          mas os registos comerciais e a decisão permanecem baseados em informação real e validação humana.
        </p>
      </Card>
    </>
  );
}
