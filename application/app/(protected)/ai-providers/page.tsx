import { HardDrive, RefreshCw, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, EmptyState } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

export default async function AIProvidersPage() {
  const { supabase, user } = await requireUser();

  const [{ data: providers, error: providerError }, { data: queue, error: queueError }] = await Promise.all([
    supabase
      .from("ai_provider_profiles")
      .select("*")
      .eq("user_id", user.id)
      .order("priority", { ascending: true }),
    supabase
      .from("sync_queue")
      .select("id,entity_type,operation,status,attempts,last_error,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const error = providerError?.message ?? queueError?.message;

  return (
    <>
      <PageHeader
        eyebrow="Fase 5"
        title="Offline + IA privada"
        description="Provider Adapter, preferência por IA local, estado de sincronização e base PWA/offline."
      />

      {error && <Card className="mb-6 p-5 text-sm text-red-700">{error}</Card>}

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-950">
            <HardDrive size={19} /> AI Provider Adapter
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            O router pode privilegiar providers locais e de menor custo. Credenciais não são guardadas nesta tabela.
          </p>
          {!providers?.length ? (
            <div className="mt-4">
              <EmptyState>Nenhum provider foi activado neste ambiente.</EmptyState>
            </div>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {providers.map((provider) => (
                <div key={provider.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-950">{provider.label}</p>
                      <p className="mt-1 text-xs text-slate-500">{provider.provider} · {provider.mode}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                      {provider.last_health_status}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    Prioridade {provider.priority} · custo {provider.cost_class}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="inline-flex items-center gap-2 font-semibold text-slate-950">
            <ShieldCheck size={18} /> Segurança
          </h2>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <p>• Secrets permanecem fora do Provider Adapter.</p>
            <p>• IA local pode operar sem enviar conteúdo para cloud.</p>
            <p>• Providers cloud só devem receber contexto necessário.</p>
            <p>• Work continua reservado a tarefas em que o benefício justifique o custo.</p>
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <div className="border-b border-slate-200 p-5">
          <h2 className="inline-flex items-center gap-2 font-semibold text-slate-950">
            <RefreshCw size={18} /> Sync Queue
          </h2>
        </div>
        <div className="p-5">
          {!queue?.length ? (
            <EmptyState>Não existem operações pendentes de sincronização.</EmptyState>
          ) : (
            <div className="space-y-3">
              {queue.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-950">{item.operation} · {item.entity_type}</p>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">{item.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{formatDateTime(item.created_at)} · tentativas {item.attempts}</p>
                  {item.last_error && <p className="mt-2 text-xs text-red-700">{item.last_error}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card className="mt-6 p-5">
        <p className="text-sm leading-6 text-slate-600">
          A PWA e o cache offline existentes são reutilizados. Base local completa, RAG local e ligação real ao Qwen/KoboldCPP dependem do runtime local do pen drive e serão activados sem substituir a base principal.
        </p>
      </Card>
    </>
  );
}
