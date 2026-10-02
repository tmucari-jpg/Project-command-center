import Link from "next/link";
import { notFound } from "next/navigation";
import { CreditCard, TrendingUp, WalletCards } from "lucide-react";
import { upsertSubscriptionFunnelMetric } from "@/app/(protected)/mutations";
import { Field, TextArea } from "@/components/form-fields";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { Card, EmptyState, primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { subscriptionFunnelRates } from "@/lib/briefing-monetization";

function pct(value: number | null) {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

export default async function BriefingMonetizationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();

  const { data: project } = await supabase
    .from("projects")
    .select("id,title")
    .eq("user_id", user.id)
    .in("title", ["Briefing Diário", "Briefing Diario"])
    .limit(1)
    .maybeSingle();

  if (!project) notFound();

  const [
    { data: plans, error: plansError },
    { data: channels, error: channelsError },
    { data: metrics, error: metricsError },
  ] = await Promise.all([
    supabase
      .from("subscription_plans")
      .select("*")
      .eq("user_id", user.id)
      .eq("project_id", project.id)
      .order("price", { ascending: true }),
    supabase
      .from("payment_channels")
      .select("*")
      .eq("user_id", user.id)
      .eq("project_id", project.id)
      .order("channel_label"),
    supabase
      .from("subscription_funnel_metrics")
      .select("*")
      .eq("user_id", user.id)
      .eq("project_id", project.id)
      .order("metric_date", { ascending: false })
      .limit(30),
  ]);

  const error = plansError?.message ?? channelsError?.message ?? metricsError?.message;
  const latest = metrics?.[0] ?? null;
  const rates = latest ? subscriptionFunnelRates(latest) : null;

  return (
    <>
      <div className="mb-4">
        <Link className={secondaryButtonClass} href="/monetization">Voltar à Monetização</Link>
      </div>

      <PageHeader
        eyebrow="E02 · Briefing Diário"
        title="Monetização e subscrições"
        description="Planos, pagamentos e funil aquisição → pagamento → activação → retenção."
      />
      <FlashMessage
        error={params.error ?? error}
        created={params.saved}
        message={params.saved ? "Métricas de subscrição guardadas." : undefined}
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <div className="border-b border-slate-200 p-5">
            <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-950">
              <WalletCards size={19} /> Planos
            </h2>
          </div>
          <div className="p-5">
            {!plans?.length ? (
              <EmptyState>Os planos ainda não foram carregados.</EmptyState>
            ) : (
              <div className="space-y-3">
                {plans.map((plan) => (
                  <div key={plan.id} className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-3">
                    <div>
                      <p className="text-sm font-medium text-slate-950">{plan.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{plan.billing_period}</p>
                    </div>
                    <p className="text-sm font-semibold text-slate-900">{plan.price} {plan.currency}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className="border-b border-slate-200 p-5">
            <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-950">
              <CreditCard size={19} /> Pagamentos
            </h2>
          </div>
          <div className="p-5">
            {!channels?.length ? (
              <EmptyState>Sem canais de pagamento registados.</EmptyState>
            ) : (
              <div className="space-y-3">
                {channels.map((channel) => (
                  <div key={channel.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-slate-950">{channel.channel_label}</p>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                        {channel.status}
                      </span>
                    </div>
                    {channel.notes && <p className="mt-2 text-xs leading-5 text-slate-500">{channel.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-950">
            <TrendingUp size={19} /> Funil de hoje
          </h2>
          <form action={upsertSubscriptionFunnelMetric} className="mt-5 space-y-4">
            <input type="hidden" name="project_id" value={project.id} />
            <Field label="Data" name="metric_date" type="date" />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Aquisição" name="acquired" type="number" min={0} defaultValue={0} required />
              <Field label="Iniciaram pagamento" name="payment_started" type="number" min={0} defaultValue={0} required />
              <Field label="Pagaram" name="paid" type="number" min={0} defaultValue={0} required />
              <Field label="Activados" name="activated" type="number" min={0} defaultValue={0} required />
              <Field label="Retidos" name="retained" type="number" min={0} defaultValue={0} required />
              <Field label="Churn" name="churned" type="number" min={0} defaultValue={0} required />
            </div>
            <TextArea label="Notas" name="notes" />
            <button className={primaryButtonClass} type="submit">Guardar métricas</button>
          </form>
        </Card>
      </div>

      <Card className="mt-6 p-5">
        <h2 className="text-lg font-semibold text-slate-950">Último funil registado</h2>
        {!latest || !rates ? (
          <div className="mt-4"><EmptyState>Ainda não existem métricas de subscrição.</EmptyState></div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Aquisição → pagamento</p><p className="mt-1 text-xl font-semibold">{pct(rates.acquisition_to_payment)}</p></div>
            <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Conversão pagamento</p><p className="mt-1 text-xl font-semibold">{pct(rates.payment_conversion)}</p></div>
            <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Activação</p><p className="mt-1 text-xl font-semibold">{pct(rates.activation_rate)}</p></div>
            <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Retenção</p><p className="mt-1 text-xl font-semibold">{pct(rates.retention_rate)}</p></div>
            <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Churn</p><p className="mt-1 text-xl font-semibold">{pct(rates.churn_rate)}</p></div>
          </div>
        )}
      </Card>

      <Card className="mt-6 p-5">
        <p className="text-sm leading-6 text-slate-600">
          Esta página é específica do produto Briefing Diário e continua ligada à base geral de monetização do Command Center. Não cria um segundo pipeline comercial.
        </p>
      </Card>
    </>
  );
}
