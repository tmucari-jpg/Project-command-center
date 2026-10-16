import Link from "next/link";
import { ArrowLeft, Home } from "lucide-react";
import { notFound } from "next/navigation";
import { refreshProjectStrategyExecutionPlan } from "@/app/(protected)/mutations";
import { PageHeader } from "@/components/page-header";
import { Card, primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { displayLabel } from "@/lib/display-label";
import { formatDateTime } from "@/lib/format";

function renderValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Pendente";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "number" || typeof value === "string") return String(value);
  if (Array.isArray(value)) {
    if (!value.length) return "Pendente";
    return value
      .map((item) =>
        typeof item === "object" && item !== null
          ? Object.entries(item)
              .map(([key, itemValue]) => `${displayLabel(key)}: ${renderValue(itemValue)}`)
              .join(" · ")
          : renderValue(item),
      )
      .join("\n");
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, itemValue]) => `${displayLabel(key)}: ${renderValue(itemValue)}`)
      .join("\n");
  }
  return String(value);
}

function PlanSection({
  title,
  data,
}: {
  title: string;
  data: Record<string, unknown>;
}) {
  return (
    <Card className="p-5">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <dl className="mt-4 space-y-4">
        {Object.entries(data).map(([key, value]) => (
          <div key={key}>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {displayLabel(key)}
            </dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-800">
              {renderValue(value)}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

export default async function ProjectPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; updated?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { supabase, user } = await requireUser();

  const [{ data: project }, { data: plan }] = await Promise.all([
    supabase
      .from("projects")
      .select("id,title")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("project_strategy_execution_plans")
      .select("*")
      .eq("project_id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (!project) notFound();

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link className={secondaryButtonClass} href={`/projects/${project.id}`}>
          <ArrowLeft size={16} /> Voltar
        </Link>
        <Link className={secondaryButtonClass} href="/dashboard">
          <Home size={16} /> Painel geral
        </Link>
      </div>

      <PageHeader
        eyebrow="Estratégia → Execução"
        title={`Plano · ${project.title}`}
      />

      {query.error && (
        <Card className="mb-6 p-5 text-sm text-red-700">{query.error}</Card>
      )}
      {query.updated && (
        <Card className="mb-6 p-5 text-sm text-emerald-700">
          Plano actualizado a partir do contexto actual do projecto.
        </Card>
      )}

      <Card className="mb-6 p-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <h2 className="font-semibold text-slate-950">Plano canónico do projecto</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Consolida a estratégia, monetização, marketing, vendas, execução e medição. Dados reais existentes são reutilizados; lacunas permanecem explícitas até validação.
            </p>
            {plan?.updated_at && (
              <p className="mt-2 text-xs text-slate-500">
                Actualizado em {formatDateTime(plan.updated_at)}
              </p>
            )}
          </div>
          <form action={refreshProjectStrategyExecutionPlan}>
            <input type="hidden" name="project_id" value={project.id} />
            <button className={primaryButtonClass} type="submit">
              Actualizar a partir do contexto
            </button>
          </form>
        </div>
      </Card>

      {!plan ? (
        <Card className="p-5">
          <p className="text-sm text-slate-700">
            O plano ainda não foi preparado. Use “Actualizar a partir do contexto”.
          </p>
        </Card>
      ) : (
        <>
          {Array.isArray(plan.missing_items) && plan.missing_items.length > 0 && (
            <Card className="mb-6 p-5">
              <h2 className="font-semibold text-slate-950">Pendências para fechar o plano</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {plan.missing_items.map((item: unknown) => (
                  <span
                    key={String(item)}
                    className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700"
                  >
                    {String(item)}
                  </span>
                ))}
              </div>
            </Card>
          )}

          <div className="grid gap-6 xl:grid-cols-2">
            <PlanSection title="Estratégia" data={(plan.strategy ?? {}) as Record<string, unknown>} />
            <PlanSection title="Monetização" data={(plan.monetization ?? {}) as Record<string, unknown>} />
            <PlanSection title="Marketing" data={(plan.marketing ?? {}) as Record<string, unknown>} />
            <PlanSection title="Vendas" data={(plan.sales ?? {}) as Record<string, unknown>} />
            <PlanSection title="Execução" data={(plan.execution ?? {}) as Record<string, unknown>} />
            <PlanSection title="Medição e decisão" data={(plan.measurement ?? {}) as Record<string, unknown>} />
          </div>
        </>
      )}
    </>
  );
}
