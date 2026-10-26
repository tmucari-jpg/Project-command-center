import { HardDrive, RefreshCw, ShieldCheck } from "lucide-react";
import { registerAIProviderProfile, validateAIProviderProfile, validateAllAIProviderProfiles } from "@/app/(protected)/mutations";
import { Field, Select } from "@/components/form-fields";
import { primaryButtonClass } from "@/components/ui";
import { PageHeader } from "@/components/page-header";
import { Card, EmptyState } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { displayLabel } from "@/lib/display-label";
import { resolveAIExecutionState } from "@/lib/ai-provider-adapter";

export default async function AIFornecedoresPage({
  searchParams,
}: {
  searchParams: Promise<{ health?: string; health_message?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireAdmin();

  const [{ data: providers, error: providerError }, { data: queue, error: queueError }] = await Promise.all([
    supabase.from("ai_provider_profiles").select("*").eq("user_id", user.id).order("priority", { ascending: true }),
    supabase.from("sync_queue").select("id,entity_type,operation,status,attempts,last_error,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
  ]);

  const error = providerError?.message ?? queueError?.message;
  const enabledProviders = (providers ?? []).filter((provider) => provider.enabled);
  const operationalProviders = enabledProviders.filter((provider) => provider.last_health_status === "healthy");
  const executionState = resolveAIExecutionState(providers ?? []);
  const queuedOperations = (queue ?? []).filter((item) => item.status !== "completed" && item.status !== "cancelled");
  const failedOperations = (queue ?? []).filter((item) => item.status === "failed" || Boolean(item.last_error));
  const capabilities = Array.from(
    new Set(
      operationalProviders.flatMap((provider) =>
        Array.isArray(provider.capabilities)
          ? provider.capabilities.filter((value: unknown): value is string => typeof value === "string")
          : [],
      ),
    ),
  );

  return (
    <>
      <PageHeader
        eyebrow="Administração"
        title="Configuração de IA"
      />

      {params.health && (
        <Card className="mb-6 p-5">
          <p className="font-semibold text-[var(--cc-foreground)]">
            Validação IA: {displayLabel(params.health)}
          </p>
          {params.health_message && (
            <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
              {params.health_message}
            </p>
          )}
        </Card>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-secondary)]">Serviços configurados</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--cc-foreground)]">{providers?.length ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-secondary)]">Operacionais</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--cc-foreground)]">{operationalProviders.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-secondary)]">Operações pendentes</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--cc-foreground)]">{queuedOperations.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-secondary)]">Falhas recentes</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--cc-foreground)]">{failedOperations.length}</p>
        </Card>
      </div>

      <Card className="mb-6 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <h2 className="font-semibold text-[var(--cc-foreground)]">Validação operacional dos providers</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
              Executa uma chamada real ao mesmo endpoint e modelo usados pelo PCC. O resultado, latência e diagnóstico ficam registados como evidência operacional; um teste de código isolado não activa o provider.
            </p>
          </div>
          <form action={validateAllAIProviderProfiles}>
            <button className={primaryButtonClass} type="submit">Validar todos agora</button>
          </form>
        </div>
      </Card>

      <Card className="mb-6 p-5">
        <h2 className="font-semibold text-[var(--cc-foreground)]">Motor de autonomia e melhoria</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
          O PCC deve consumir capacidades, não depender de uma ferramenta específica: pesquisa, navegação web, execução de código, diagnóstico, automação e agentes podem ser fornecidos por serviços diferentes ou por runtime local.
        </p>
        <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
          Regra operacional: usar IA na nuvem quando estiver saudável; se ficar indisponível, usar IA local apenas quando o endpoint local estiver validado e alcançável a partir do runtime do PCC.
        </p>
        <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
          Sem provider saudável, o PCC continua a executar as funções normais baseadas em dados e regras, mas não deve simular capacidades de IA. O modo offline operacional permanece disponível após a criação do snapshot local; capacidades de IA local dependem de um endpoint local validado e acessível.
        </p>
        <div className="mt-4 rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-secondary)]">Modo de IA actual</p>
          <p className="mt-1 font-semibold text-[var(--cc-foreground)]">
            {executionState.mode === "cloud" ? "Nuvem" : executionState.mode === "local" ? "Local" : "IA indisponível"}
          </p>
          <p className="mt-1 text-sm text-[var(--cc-secondary)]">{executionState.reason}</p>
          {executionState.provider && (
            <p className="mt-1 text-xs text-[var(--cc-secondary)]">Provider: {executionState.provider.label}</p>
          )}
        </div>
      </Card>

      <Card className="mb-6 border-[color-mix(in_srgb,var(--cc-warning)_32%,var(--cc-border))] bg-[color-mix(in_srgb,var(--cc-warning-soft)_72%,transparent)] p-5">
        <p className="font-semibold text-[#76551d]">
          {operationalProviders.length
            ? `${operationalProviders.length} serviço(s) inteligente(s) operacional(is).`
            : "IA ainda não validada neste ambiente."}
        </p>
        <p className="mt-2 text-sm leading-6 text-[#76551d]">
          {operationalProviders.length
            ? "O PCC pode usar apenas as capacidades abaixo, respeitando prioridade, custo e estado de saúde."
            : "Nenhum fornecedor está actualmente registado como operacional. O PCC não deve fingir capacidades de IA enquanto não houver um serviço configurado e verificado."}
        </p>
        {capabilities.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {capabilities.map((capability: string) => (
              <span key={capability} className="rounded-full bg-[var(--cc-surface)] px-2.5 py-1 text-xs font-semibold text-[#76551d]">
                {displayLabel(capability)}
              </span>
            ))}
          </div>
        )}
      </Card>

      {error && <Card className="mb-6 p-5 text-sm text-[var(--cc-danger)]">{error}</Card>}

      <Card className="mb-6 p-5">
        <h2 className="font-semibold text-[var(--cc-foreground)]">Registar provider</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
          Este registo não activa a IA. O provider permanece desactivado e com health desconhecido até ser validado.
        </p>
        <form action={registerAIProviderProfile} className="mt-4 grid gap-4 md:grid-cols-2">
          <Select label="Provider" name="provider" defaultValue="qwen_local">
            <option value="qwen_local">Qwen local</option>
            <option value="qwen_cloud">Qwen cloud</option>
            <option value="moonshot">Kimi / Moonshot</option>
            <option value="koboldcpp_local">KoboldCPP local</option>
            <option value="openai">OpenAI</option>
            <option value="groq">Groq</option>
            <option value="huggingchat">HuggingChat</option>
            <option value="other">Outro</option>
          </Select>
          <Field label="Nome" name="label" required />
          <Select label="Modo" name="mode" defaultValue="local">
            <option value="local">Local</option>
            <option value="cloud">Nuvem</option>
          </Select>
          <Field label="Prioridade" name="priority" type="number" min={1} max={100} defaultValue={10} />
          <Select label="Classe de custo" name="cost_class" defaultValue="free">
            <option value="free">Gratuito</option>
            <option value="low">Baixo</option>
            <option value="medium">Médio</option>
            <option value="high">Alto</option>
            <option value="unknown">Desconhecido</option>
          </Select>
          <Field label="Modelo" name="model_hint" />
          <Field label="Endpoint" name="endpoint_hint" placeholder="Só configuração; sem credenciais" />
          <Field label="Capacidades" name="capabilities" placeholder="chat, diagnóstico, código" />
          <div className="md:col-span-2">
            <button className={primaryButtonClass} type="submit">Registar sem activar</button>
          </div>
        </form>
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-[var(--cc-foreground)]">
            <HardDrive size={19} /> Serviços disponíveis
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
            Credenciais sensíveis permanecem fora desta área. Serviços indisponíveis não são usados pelo PCC.
          </p>
          {!providers?.length ? (
            <div className="mt-4"><EmptyState>Nenhum serviço foi activado neste ambiente.</EmptyState></div>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {providers.map((provider) => (
                <div key={provider.id} className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-[var(--cc-foreground)]">{provider.label}</p>
                      <p className="mt-1 text-xs text-[var(--cc-secondary)]">
                        {displayLabel(provider.provider)} · {displayLabel(provider.mode)}
                      </p>
                    </div>
                    <span className="rounded-full bg-[var(--cc-surface-muted)] px-2 py-1 text-xs font-semibold text-[var(--cc-foreground)]">{displayLabel(provider.last_health_status)}</span>
                  </div>
                  <p className="mt-3 text-xs text-[var(--cc-secondary)]">
                    Prioridade {provider.priority} · custo {displayLabel(provider.cost_class)}
                    {provider.model_hint ? ` · modelo ${provider.model_hint}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-[var(--cc-secondary)]">
                    Última validação: {provider.last_health_at ? formatDateTime(provider.last_health_at) : "ainda não realizada"}
                  </p>
                  {provider.last_health_message && (
                    <p className="mt-2 text-xs leading-5 text-[var(--cc-secondary)]">
                      Diagnóstico: {provider.last_health_message}
                    </p>
                  )}
                  {Array.isArray(provider.capabilities) && provider.capabilities.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {provider.capabilities
                        .filter((value: unknown): value is string => typeof value === "string")
                        .map((capability: string) => (
                          <span key={capability} className="rounded-full bg-[var(--cc-surface-muted)] px-2 py-1 text-[11px] font-medium text-[var(--cc-foreground)]">
                            {displayLabel(capability)}
                          </span>
                        ))}
                    </div>
                  )}
                  <form action={validateAIProviderProfile} className="mt-4">
                    <input type="hidden" name="provider_id" value={provider.id} />
                    <button
                      type="submit"
                      className="rounded-lg bg-[var(--cc-surface-muted)] px-3 py-2 text-xs font-semibold text-[var(--cc-foreground)] hover:bg-slate-200"
                    >
                      Validar agora
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="inline-flex items-center gap-2 font-semibold text-[var(--cc-foreground)]"><ShieldCheck size={18} /> Segurança</h2>
          <div className="mt-4 space-y-3 text-sm text-[var(--cc-secondary)]">
            <p>• Credenciais sensíveis ficam fora da aplicação.</p>
            <p>• Serviços na nuvem recebem apenas contexto necessário.</p>
            <p>• IA local só será marcada como activa após verificação real.</p>
            <p>• Acções críticas continuam sujeitas a aprovação humana.</p>
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <div className="border-b border-[var(--cc-border)] p-5">
          <h2 className="inline-flex items-center gap-2 font-semibold text-[var(--cc-foreground)]"><RefreshCw size={18} /> Fila de sincronização</h2>
        </div>
        <div className="p-5">
          {!queue?.length ? (
            <EmptyState>Não existem operações pendentes de sincronização.</EmptyState>
          ) : (
            <div className="space-y-3">
              {queue.map((item) => (
                <div key={item.id} className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-medium text-[var(--cc-foreground)]">{displayLabel(item.operation)} · {displayLabel(item.entity_type)}</p>
                    <span className="rounded-full bg-[var(--cc-surface-muted)] px-2 py-1 text-xs font-semibold">{displayLabel(item.status)}</span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--cc-secondary)]">{formatDateTime(item.created_at)} · tentativas {item.attempts}</p>
                  {item.last_error && <p className="mt-2 text-xs text-[var(--cc-danger)]">{item.last_error}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </>
  );
}
