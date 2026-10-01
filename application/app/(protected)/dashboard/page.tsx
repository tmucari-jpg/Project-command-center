import Link from "next/link";
import { ArrowRight, Clock3, ExternalLink, Radio } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, EmptyState, StatCard } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

const BRIEFING_URL =
  "https://raw.githubusercontent.com/tmucari-jpg/Briefing_Di-rio-/main/docs/news-pt.json";
const BRIEFING_APP_URL = "https://tmucari-jpg.github.io/Briefing_Di-rio-/";

type BriefingItem = {
  section: "Mundo" | "África" | "Moçambique" | string;
  title: string;
  summary?: string;
  link?: string;
  source?: string;
  published?: string;
  event_id?: string;
  cluster_size?: number;
  source_count?: number;
  status?: "today" | "update" | "context" | string;
  opportunity_flag?: boolean;
};

type BriefingFeed = {
  updated_at: string;
  items: BriefingItem[];
};

async function getLiveBriefing(): Promise<BriefingFeed | null> {
  try {
    const response = await fetch(BRIEFING_URL, {
      next: { revalidate: 300 },
      headers: { Accept: "application/json" },
    });

    if (!response.ok) return null;

    const data = (await response.json()) as BriefingFeed;
    if (!data?.updated_at || !Array.isArray(data.items)) return null;

    return data;
  } catch {
    return null;
  }
}

function briefingStatusLabel(status?: string) {
  if (status === "update") return "ACTUALIZAÇÃO";
  if (status === "context") return "CONTEXTO";
  return "HOJE";
}

function formatBriefingTime(value: string) {
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function DashboardPage() {
  const { supabase, user } = await requireUser();

  const [
    objectivesResult,
    projectsResult,
    actionsResult,
    blockersResult,
    ideasResult,
    nextActionResult,
    briefing,
  ] = await Promise.all([
    supabase.from("objectives").select("id,status,progress", { count: "exact" }).eq("user_id", user.id),
    supabase.from("projects").select("id,status,progress", { count: "exact" }).eq("user_id", user.id),
    supabase
      .from("actions")
      .select("id,title,status,due_at,priority,actual_minutes,projects(title)")
      .eq("user_id", user.id)
      .neq("status", "completed")
      .neq("status", "cancelled")
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(6),
    supabase
      .from("blockers")
      .select("id,status,impact,title")
      .eq("user_id", user.id)
      .in("status", ["open", "investigating", "waiting"]),
    supabase.from("ideas").select("id,status", { count: "exact" }).eq("user_id", user.id),
    supabase
      .from("actions")
      .select("id,title,priority,due_at,completion_criteria,projects(title)")
      .eq("user_id", user.id)
      .eq("is_next_action", true)
      .maybeSingle(),
    getLiveBriefing(),
  ]);

  const objectives = objectivesResult.data ?? [];
  const projects = projectsResult.data ?? [];
  const actions = actionsResult.data ?? [];
  const blockers = blockersResult.data ?? [];
  const ideas = ideasResult.data ?? [];

  const activeObjectives = objectives.filter((item) =>
    ["active", "on_track", "at_risk", "delayed"].includes(item.status),
  ).length;
  const activeProjects = projects.filter((item) =>
    ["planning", "active", "at_risk", "on_hold"].includes(item.status),
  ).length;
  const atRiskProjects = projects.filter((item) => item.status === "at_risk").length;
  const pendingIdeas = ideas.filter((item) =>
    ["captured", "evaluating", "approved"].includes(item.status),
  ).length;

  const briefingItems = briefing?.items ?? [];
  const briefingSections = ["Mundo", "África", "Moçambique"].map((section) => ({
    section,
    count: briefingItems.filter((item) => item.section === section).length,
  }));
  const multiSourceEvents = briefingItems.filter((item) => (item.source_count ?? item.cluster_size ?? 1) > 1).length;
  const mozambiqueImpactEvents = briefingItems.filter((item) => item.section === "Moçambique" || Boolean(item.summary?.toLowerCase().includes("moçambique"))).length;
  const opportunities = briefingItems.filter((item) => item.opportunity_flag).length;

  return (
    <>
      <PageHeader
        eyebrow="Visão geral"
        title="Dashboard"
        description="O que está activo, o que está em risco e qual é a próxima acção concreta."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Objectivos activos" value={activeObjectives} />
        <StatCard label="Projectos activos" value={activeProjects} />
        <StatCard label="Projectos em risco" value={atRiskProjects} />
        <StatCard label="Bloqueios activos" value={blockers.length} />
        <StatCard label="Ideias por decidir" value={pendingIdeas} />
      </div>

      <section className="mt-7">
        <Card className="overflow-hidden">
          <div className="border-b border-slate-200 bg-white p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    <Radio size={13} />
                    LIVE
                  </span>
                  <span className="text-xs font-medium text-slate-400">Briefing Diário</span>
                </div>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
                  O que realmente importa hoje
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Eventos editoriais reais, cruzados e actualizados automaticamente.
                </p>
              </div>
              <a
                href={BRIEFING_APP_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Abrir briefing <ExternalLink size={15} />
              </a>
            </div>
          </div>

          {briefing ? (
            <>
              <div className="grid grid-cols-2 gap-px bg-slate-200 sm:grid-cols-4">
                <div className="bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">Eventos publicados</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-950">{briefingItems.length}</p>
                </div>
                {briefingSections.slice(0, 3).map((item) => (
                  <div key={item.section} className="bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">{item.section}</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-950">{item.count}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 border-b border-slate-100 p-5 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-slate-500">Múltiplas fontes</p>
                  <p className="mt-1 font-semibold text-slate-900">{multiSourceEvents} eventos</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Ligação a Moçambique</p>
                  <p className="mt-1 font-semibold text-slate-900">{mozambiqueImpactEvents} eventos</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Oportunidades sinalizadas</p>
                  <p className="mt-1 font-semibold text-slate-900">{opportunities}</p>
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {briefingItems.slice(0, 5).map((item) => (
                  <article key={item.event_id ?? item.link ?? item.title} className="p-5">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold tracking-wide">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
                        {briefingStatusLabel(item.status)}
                      </span>
                      <span className="text-blue-700">{item.section}</span>
                      {item.source_count && item.source_count > 1 ? (
                        <span className="text-slate-400">{item.source_count} fontes</span>
                      ) : null}
                    </div>
                    <h3 className="mt-2 text-base font-semibold text-slate-950">{item.title}</h3>
                    {item.summary ? (
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{item.summary}</p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-400">
                      {item.source ? <span>{item.source}</span> : null}
                      {item.published ? <span>{formatBriefingTime(item.published)}</span> : null}
                      {item.link ? (
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-blue-700 hover:underline"
                        >
                          Ler fonte
                        </a>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>

              <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                <span>Última actualização: {formatBriefingTime(briefing.updated_at)}</span>
                <span>Fonte de verdade: Briefing Diário · main</span>
              </div>
            </>
          ) : (
            <div className="p-5">
              <EmptyState>Não foi possível actualizar o briefing neste momento.</EmptyState>
            </div>
          )}
        </Card>
      </section>

      <div className="mt-7 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <div className="border-b border-slate-200 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-950">Execução</h2>
                <p className="mt-1 text-sm text-slate-500">Acções abertas ordenadas por prazo.</p>
              </div>
              <Link className="text-sm font-medium text-blue-700 hover:underline" href="/actions">
                Ver todas
              </Link>
            </div>
          </div>
          <div className="p-5">
            {actions.length === 0 ? (
              <EmptyState>Não existem acções abertas.</EmptyState>
            ) : (
              <div className="divide-y divide-slate-100">
                {actions.map((action) => (
                  <div key={action.id} className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">{action.title}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                        <Clock3 size={13} />
                        {formatDateTime(action.due_at)}
                      </p>
                    </div>
                    <StatusBadge status={action.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
              Next best action
            </p>
            {nextActionResult.data ? (
              <div className="mt-3">
                <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                  {nextActionResult.data.title}
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Prazo: {formatDateTime(nextActionResult.data.due_at)}
                </p>
                {nextActionResult.data.completion_criteria && (
                  <p className="mt-3 text-sm leading-6 text-slate-700">
                    Critério: {nextActionResult.data.completion_criteria}
                  </p>
                )}
                <Link
                  href="/focus"
                  className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-700"
                >
                  Entrar em modo foco <ArrowRight size={16} />
                </Link>
              </div>
            ) : (
              <div className="mt-3">
                <p className="text-sm leading-6 text-slate-600">
                  Ainda não definiu uma próxima acção.
                </p>
                <Link
                  href="/actions"
                  className="mt-4 inline-flex text-sm font-semibold text-blue-700"
                >
                  Escolher uma acção
                </Link>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="font-semibold text-slate-950">Bloqueios</h2>
            <div className="mt-3 space-y-3">
              {blockers.length === 0 ? (
                <p className="text-sm text-slate-500">Sem bloqueios activos.</p>
              ) : (
                blockers.slice(0, 4).map((blocker) => (
                  <div key={blocker.id} className="rounded-xl bg-red-50 px-3.5 py-3">
                    <p className="text-sm font-medium text-red-900">{blocker.title}</p>
                    <p className="mt-1 text-xs text-red-700">{blocker.status}</p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
