import Link from "next/link";
import { ArrowRight, Clock3 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, EmptyState, StatCard } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

export default async function DashboardPage() {
  const { supabase, user } = await requireUser();

  const [
    objectivesResult,
    projectsResult,
    actionsResult,
    blockersResult,
    ideasResult,
    nextActionResult,
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
