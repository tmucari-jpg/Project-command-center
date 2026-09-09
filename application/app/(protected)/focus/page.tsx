import Link from "next/link";
import { CircleStop, Play, ShieldCheck, TriangleAlert } from "lucide-react";
import {
  setNextAction,
  startTimeSession,
  stopTimeSession,
} from "@/app/(protected)/mutations";
import { FlashMessage } from "@/components/flash-message";
import { LiveTimer } from "@/components/live-timer";
import { PageHeader } from "@/components/page-header";
import { Card, EmptyState, primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

export default async function FocusPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; started?: string; stopped?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();

  const [{ data: openSession }, { data: nextAction }, { data: candidates }] = await Promise.all([
    supabase
      .from("time_sessions")
      .select("*, actions(title,completion_criteria,due_at,estimated_minutes,actual_minutes,project_id,projects(title))")
      .eq("user_id", user.id)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("actions")
      .select("*, projects(title)")
      .eq("user_id", user.id)
      .eq("is_next_action", true)
      .neq("status", "completed")
      .neq("status", "cancelled")
      .maybeSingle(),
    supabase
      .from("actions")
      .select("id,title,priority,due_at,projects(title)")
      .eq("user_id", user.id)
      .neq("status", "completed")
      .neq("status", "cancelled")
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(5),
  ]);

  const activeAction = openSession?.actions ?? nextAction;

  return (
    <>
      <PageHeader
        eyebrow="Execução"
        title="Modo foco"
        description="Uma acção, um critério de conclusão e o tempo necessário para avançar."
      />
      <FlashMessage
        error={params.error}
        created={params.started ?? params.stopped}
        message={params.started ? "Sessão iniciada." : "Sessão terminada e tempo registado."}
      />

      {activeAction ? (
        <Card className="overflow-hidden">
          <div className="border-b border-slate-200 bg-white p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
              {openSession ? "Em execução" : "Próxima acção"}
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              {activeAction.title}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {activeAction.projects?.title ?? "Sem projecto"} · Prazo {formatDateTime(activeAction.due_at)}
            </p>
          </div>

          <div className="grid gap-0 md:grid-cols-2">
            <div className="border-b border-slate-200 p-6 sm:p-8 md:border-b-0 md:border-r">
              <p className="text-sm font-medium text-slate-500">Cronómetro</p>
              <div className="mt-3">
                {openSession ? (
                  <LiveTimer startedAt={openSession.started_at} />
                ) : (
                  <div className="font-mono text-4xl font-semibold tracking-tight text-slate-300">00:00:00</div>
                )}
              </div>
              <p className="mt-3 text-sm text-slate-500">
                Estimado: {activeAction.estimated_minutes ?? "—"} min · Real acumulado: {activeAction.actual_minutes ?? 0} min
              </p>

              <div className="mt-6">
                {openSession ? (
                  <form action={stopTimeSession}>
                    <input type="hidden" name="session_id" value={openSession.id} />
                    <button className={primaryButtonClass} type="submit">
                      <CircleStop className="mr-2" size={17} />
                      Parar e registar tempo
                    </button>
                  </form>
                ) : (
                  <form action={startTimeSession}>
                    <input type="hidden" name="action_id" value={activeAction.id} />
                    <button className={primaryButtonClass} type="submit">
                      <Play className="mr-2" size={17} />
                      Iniciar execução
                    </button>
                  </form>
                )}
              </div>
            </div>

            <div className="p-6 sm:p-8">
              <p className="text-sm font-medium text-slate-500">Critério de conclusão</p>
              <p className="mt-2 text-base leading-7 text-slate-800">
                {activeAction.completion_criteria || "Ainda não foi definido um critério de conclusão."}
              </p>

              <div className="mt-7 flex flex-wrap gap-2">
                <Link className={secondaryButtonClass} href="/evidence">
                  <ShieldCheck className="mr-2" size={16} />
                  Registar evidência
                </Link>
                <Link className={secondaryButtonClass} href="/blockers">
                  <TriangleAlert className="mr-2" size={16} />
                  Registar bloqueio
                </Link>
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-6">
          <EmptyState>Não existe uma próxima acção definida.</EmptyState>
        </Card>
      )}

      {!openSession && (
        <Card className="mt-6 p-5">
          <h2 className="font-semibold text-slate-950">Escolher próxima acção</h2>
          <div className="mt-4 space-y-2">
            {(candidates ?? []).length === 0 ? (
              <p className="text-sm text-slate-500">Crie uma acção para começar.</p>
            ) : (
              (candidates ?? []).map((action) => (
                <div key={action.id} className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{action.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{action.projects?.title ?? "Sem projecto"} · {formatDateTime(action.due_at)}</p>
                  </div>
                  <form action={setNextAction}>
                    <input type="hidden" name="id" value={action.id} />
                    <button className="text-sm font-semibold text-blue-700 hover:underline" type="submit">
                      Definir como próxima
                    </button>
                  </form>
                </div>
              ))
            )}
          </div>
        </Card>
      )}
    </>
  );
}
