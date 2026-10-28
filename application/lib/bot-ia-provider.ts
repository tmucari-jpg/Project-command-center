import { requestAIText } from "@/lib/ai-runtime";
import { parseBotIAPlan, type BotIAPlan } from "@/lib/bot-ia";

export type BotIAProviderProfile = {
  provider: string;
  label: string;
  mode: "cloud" | "local";
  endpoint_hint?: string | null;
  model_hint?: string | null;
};

const BOT_IA_INSTRUCTIONS = `
És o BotIA interno do Project Command Center (PCC). Trabalhas exclusivamente sobre o contexto factual fornecido pelo PCC.

Objectivo:
- responder directamente a perguntas sobre o projecto e o contexto factual disponível no PCC;
- interpretar comandos escritos em linguagem natural;
- dar seguimento a acções dentro do PCC;
- propor melhorias operacionais do projecto;
- tratar bloqueios reais;
- nunca obrigar o utilizador a sair do PCC para continuar o trabalho.

Regras obrigatórias:
1. Não inventes factos, datas, métricas, receitas, responsáveis, evidências, preços, Gates ou resultados.
2. Usa apenas operações permitidas:
   - create_action
   - set_project_next_action
   - append_project_note
   - create_blocker
   - update_blocker
   - resolve_blocker
3. Não alteres preço, orçamento, Gate, permissões, estado estratégico, ownership, nem apagues registos.
4. Não marques um bloqueio como resolvido sem uma solução concreta suportada pelo contexto ou pela instrução explícita do utilizador.
5. Não cries prazos automaticamente.
6. Se o utilizador fizer uma pergunta, responde claramente em response e usa operations=[] salvo se a mesma mensagem também contiver um comando inequívoco.
7. Se não houver base factual suficiente para uma alteração segura, devolve operations=[] e explica o que falta.
8. Mantém as alterações pequenas, executáveis e directamente ligadas ao projecto seleccionado.
9. Define intent como question, command ou mixed conforme a mensagem do utilizador.

Devolve APENAS JSON válido, sem markdown, nesta forma:
{
  "intent": "question | command | mixed",
  "response": "resposta directa ao utilizador, baseada no contexto factual do PCC",
  "summary": "resumo executivo",
  "diagnosis": "diagnóstico factual e próximo raciocínio operacional",
  "operations": [
    {
      "kind": "create_action | set_project_next_action | append_project_note | create_blocker | update_blocker | resolve_blocker",
      "target_id": "",
      "title": "",
      "description": "",
      "priority": "low | medium | high | critical | ",
      "completion_criteria": "",
      "impact": "",
      "solution": "",
      "value": "",
      "status": "investigating | waiting | resolved | "
    }
  ]
}
`.trim();

export async function generateBotIAPlan(profile: BotIAProviderProfile, context: Record<string, unknown>): Promise<BotIAPlan> {
  const text = await requestAIText(profile, `Contexto factual do PCC:\n${JSON.stringify(context)}`, BOT_IA_INSTRUCTIONS, 8000);
  const plan = parseBotIAPlan(text);
  if (!plan) throw new Error("BOTIA_INVALID_PROVIDER_RESPONSE");
  return plan;
}

export type BotIAProviderAttempt = {
  provider: string;
  label: string;
  status: "passed" | "failed";
  error?: string;
};

function providerAttemptError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 300);
}

export async function generateBotIAPlanWithFallback<T extends BotIAProviderProfile>(
  profiles: T[],
  context: Record<string, unknown>,
  onProviderFailure?: (profile: T, error: unknown) => Promise<void> | void,
): Promise<{ plan: BotIAPlan; provider: T; attempts: BotIAProviderAttempt[] }> {
  if (!profiles.length) {
    throw new Error("BOTIA_NO_HEALTHY_PROVIDER");
  }

  const attempts: BotIAProviderAttempt[] = [];

  for (const profile of profiles) {
    try {
      const plan = await generateBotIAPlan(profile, context);
      attempts.push({
        provider: profile.provider,
        label: profile.label,
        status: "passed",
      });
      return { plan, provider: profile, attempts };
    } catch (error) {
      attempts.push({
        provider: profile.provider,
        label: profile.label,
        status: "failed",
        error: providerAttemptError(error),
      });

      if (onProviderFailure) {
        await onProviderFailure(profile, error);
      }
    }
  }

  const summary = attempts
    .map((attempt) => `${attempt.label}: ${attempt.error ?? "falhou"}`)
    .join(" | ");

  throw new Error(`BOTIA_ALL_PROVIDERS_FAILED: ${summary}`);
}
