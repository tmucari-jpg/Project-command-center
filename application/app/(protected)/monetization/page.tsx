import Link from "next/link";
import { BriefcaseBusiness, CircleDollarSign, ContactRound } from "lucide-react";
import {
  createCommercialLead,
  createFinancialEntry,
  upsertCommercialProfile,
} from "@/app/(protected)/mutations";
import { Field, Select, TextArea } from "@/components/form-fields";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { Card, EmptyState, primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/format";
import { monetizationReadiness } from "@/lib/monetization";

function projectTitle(relation: { title: string } | { title: string }[] | null) {
  return Array.isArray(relation) ? relation[0]?.title : relation?.title;
}

export default async function MonetizationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; lead?: string; entry?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();

  const [
    { data: projects, error: projectsError },
    { data: profiles, error: profilesError },
    { data: leads, error: leadsError },
    { data: entries, error: entriesError },
  ] = await Promise.all([
    supabase.from("projects").select("id,title,status,priority").eq("user_id", user.id).order("title"),
    supabase
      .from("project_commercial_profiles")
      .select("*, projects(title)")
      .eq("user_id", user.id)
      .order("is_priority", { ascending: false })
      .order("updated_at", { ascending: false }),
    supabase
      .from("commercial_leads")
      .select("*, projects(title)")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(30),
    supabase
      .from("financial_entries")
      .select("*, projects(title)")
      .eq("user_id", user.id)
      .order("occurred_on", { ascending: false })
      .limit(30),
  ]);

  const error = projectsError?.message ?? profilesError?.message ?? leadsError?.message ?? entriesError?.message;
  const profileByProject = new Map((profiles ?? []).map((profile) => [profile.project_id, profile]));

  return (
    <>
      <PageHeader
        eyebrow="Fase 2"
        title="Monetização"
        description="Oferta, cliente, preço, canal, pipeline, leads, receita e custos por projecto."
      />
      <FlashMessage
        error={params.error ?? error}
        created={params.saved ?? params.lead ?? params.entry}
        message={
          params.saved
            ? "Perfil comercial guardado."
            : params.lead
              ? "Lead registado."
              : params.entry
                ? "Movimento financeiro registado."
                : undefined
        }
      />

      <Card className="mb-6 p-5">
        <h2 className="text-lg font-semibold text-slate-950">Preparação para validação/venda</h2>
        <p className="mt-1 text-sm text-slate-500">
          A prioridade comercial é escolhida manualmente. O sistema não altera prioridades estratégicas sozinho.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(projects ?? []).map((project) => {
            const profile = profileByProject.get(project.id);
            const readiness = monetizationReadiness(profile);
            return (
              <div key={project.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-950">{project.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {profile?.validation_status?.replaceAll("_", " ") ?? "sem perfil comercial"}
                    </p>
                  </div>
                  {profile?.is_priority && (
                    <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">
                      prioritário
                    </span>
                  )}
                </div>
                <p className="mt-3 text-sm text-slate-700">Preparação: {readiness.score}%</p>
                {readiness.missing.length > 0 && (
                  <p className="mt-1 text-xs text-slate-500">
                    Em falta: {readiness.missing.join(", ")}
                  </p>
                )}
                <Link className="mt-3 inline-flex text-sm font-semibold text-blue-700 hover:underline" href={`/projects/${project.id}`}>
                  Abrir Project Hub
                </Link>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="p-5">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-950">
            <BriefcaseBusiness size={19} /> Oferta comercial
          </h2>
          <form action={upsertCommercialProfile} className="mt-5 space-y-4">
            <Select label="Projecto" name="project_id" required defaultValue="">
              <option value="" disabled>Seleccione</option>
              {(projects ?? []).map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
            </Select>
            <TextArea label="Oferta" name="offer" />
            <TextArea label="Cliente ideal" name="ideal_customer" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Preço" name="price" type="number" step="any" />
              <Field label="Moeda" name="currency" placeholder="MZN" />
            </div>
            <Field label="Canal" name="channel" placeholder="Directo, WhatsApp, parceiros..." />
            <Select label="Estado de validação" name="validation_status" defaultValue="draft">
              <option value="not_ready">Não preparado</option>
              <option value="draft">Rascunho</option>
              <option value="ready_to_validate">Pronto para validar</option>
              <option value="validating">Em validação</option>
              <option value="validated">Validado</option>
            </Select>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" name="is_priority" className="size-4 rounded border-slate-300" />
              Marcar como projecto comercial prioritário
            </label>
            <button className={primaryButtonClass} type="submit">Guardar perfil comercial</button>
          </form>
        </Card>

        <Card className="p-5">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-950">
            <ContactRound size={19} /> Novo lead
          </h2>
          <form action={createCommercialLead} className="mt-5 space-y-4">
            <Select label="Projecto" name="project_id" required defaultValue="">
              <option value="" disabled>Seleccione</option>
              {(projects ?? []).map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
            </Select>
            <Field label="Lead / contacto" name="name" required />
            <Field label="Organização" name="organisation" />
            <Field label="Referência de contacto" name="contact_reference" placeholder="Email, telefone ou referência — apenas se conhecido" />
            <Field label="Origem" name="source" />
            <Select label="Etapa" name="stage" defaultValue="lead">
              <option value="lead">Lead</option>
              <option value="contacted">Contactado</option>
              <option value="qualified">Qualificado</option>
              <option value="proposal">Proposta</option>
              <option value="negotiation">Negociação</option>
              <option value="won">Ganho</option>
              <option value="lost">Perdido</option>
            </Select>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Valor, se conhecido" name="value" type="number" step="any" />
              <Field label="Moeda" name="currency" />
            </div>
            <TextArea label="Próxima acção" name="next_action" />
            <Field label="Data da próxima acção" name="next_action_at" type="datetime-local" />
            <TextArea label="Risco" name="risk" />
            <TextArea label="Informação em falta" name="information_missing" />
            <button className={primaryButtonClass} type="submit">Registar lead</button>
          </form>
        </Card>

        <Card className="p-5">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-950">
            <CircleDollarSign size={19} /> Receita / custo
          </h2>
          <form action={createFinancialEntry} className="mt-5 space-y-4">
            <Select label="Projecto" name="project_id" required defaultValue="">
              <option value="" disabled>Seleccione</option>
              {(projects ?? []).map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
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

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-950">Pipeline comercial</h2>
          </div>
          <div className="p-5">
            {!leads?.length ? <EmptyState>Sem leads registados.</EmptyState> : (
              <div className="space-y-3">
                {leads.map((lead) => (
                  <article key={lead.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-950">{lead.name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {projectTitle(lead.projects) ?? "Sem projecto"} · {lead.stage}
                        </p>
                      </div>
                      {lead.value !== null && lead.value !== undefined && (
                        <span className="text-sm font-semibold text-slate-800">{lead.value} {lead.currency ?? ""}</span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-slate-700">
                      Próxima acção: {lead.next_action || "DADO EM FALTA"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{formatDateTime(lead.next_action_at)}</p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-950">Receita e custos</h2>
          </div>
          <div className="p-5">
            {!entries?.length ? <EmptyState>Sem movimentos financeiros registados.</EmptyState> : (
              <div className="space-y-3">
                {entries.map((entry) => (
                  <article key={entry.id} className="flex flex-col justify-between gap-2 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center">
                    <div>
                      <p className="text-sm font-medium text-slate-950">{entry.description}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {projectTitle(entry.projects) ?? "Sem projecto"} · {formatDate(entry.occurred_on)} · {entry.status}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-slate-800">
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
        <p className="text-sm text-slate-600">
          G01/G02/P05/E14: os módulos comerciais usam apenas valores registados. Não são criados contactos, probabilidades, preços ou receitas fictícias.
        </p>
      </Card>
    </>
  );
}
