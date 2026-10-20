import { parseBotIAPlan, type BotIAPlan } from "@/lib/bot-ia";

export type BotIAProviderProfile = {
  provider: string;
  label: string;
  mode: "cloud" | "local";
  endpoint_hint?: string | null;
  model_hint?: string | null;
};

type ProviderRuntime = {
  baseUrl: string;
  apiKey?: string;
  model: string;
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

function runtimeForProvider(profile: BotIAProviderProfile): ProviderRuntime {
  if (profile.provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY_NOT_CONFIGURED");
    return {
      baseUrl: profile.endpoint_hint?.trim() || "https://api.openai.com/v1",
      apiKey,
      model: process.env.OPENAI_MODEL?.trim() || profile.model_hint?.trim() || "",
    };
  }

  if (profile.provider === "moonshot") {
    const apiKey = process.env.MOONSHOT_API_KEY;
    if (!apiKey) throw new Error("MOONSHOT_API_KEY_NOT_CONFIGURED");
    return {
      baseUrl: profile.endpoint_hint?.trim() || "https://api.moonshot.ai/v1",
      apiKey,
      model: process.env.MOONSHOT_MODEL?.trim() || profile.model_hint?.trim() || "",
    };
  }

  if (profile.provider === "qwen_cloud") {
    const apiKey = process.env.QWEN_API_KEY;
    if (!apiKey) throw new Error("QWEN_API_KEY_NOT_CONFIGURED");
    return {
      baseUrl:
        profile.endpoint_hint?.trim() ||
        "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
      apiKey,
      model: process.env.QWEN_MODEL?.trim() || profile.model_hint?.trim() || "",
    };
  }

  if (profile.mode === "local") {
    const endpoint = profile.endpoint_hint?.trim();
    if (!endpoint) throw new Error("LOCAL_AI_ENDPOINT_NOT_CONFIGURED");
    return {
      baseUrl: endpoint,
      model:
        profile.model_hint?.trim() ||
        (profile.provider === "koboldcpp_local" ? "koboldcpp" : "qwen-local"),
    };
  }

  throw new Error("BOTIA_PROVIDER_NOT_SUPPORTED");
}

function chatCompletionsUrl(baseUrl: string) {
  const root = baseUrl.replace(/\/$/, "");
  if (root.endsWith("/chat/completions")) return root;
  if (root.endsWith("/v1")) return `${root}/chat/completions`;
  return `${root}/v1/chat/completions`;
}

export async function generateBotIAPlan(
  profile: BotIAProviderProfile,
  context: Record<string, unknown>,
): Promise<BotIAPlan> {
  const runtime = runtimeForProvider(profile);
  if (!runtime.model) throw new Error("BOTIA_MODEL_NOT_CONFIGURED");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (runtime.apiKey) headers.Authorization = `Bearer ${runtime.apiKey}`;

  const body = {
    model: runtime.model,
    messages: [
      { role: "system", content: BOT_IA_INSTRUCTIONS },
      {
        role: "user",
        content: `Contexto factual do PCC:\n${JSON.stringify(context)}`,
      },
    ],
    temperature: 0.1,
    max_tokens: 1800,
  };

  let lastStatus = 0;
  let lastText = "";

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(chatCompletionsUrl(runtime.baseUrl), {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });

    lastStatus = response.status;

    if (response.ok) {
      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string | null } }>;
      };
      const text = data.choices?.[0]?.message?.content?.trim() ?? "";
      const plan = parseBotIAPlan(text);
      if (!plan) throw new Error("BOTIA_INVALID_PROVIDER_RESPONSE");
      return plan;
    }

    lastText = await response.text();
    if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 1) break;
    await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));
  }

  throw new Error(`BOTIA_PROVIDER_ERROR_${lastStatus}: ${lastText.slice(0, 300)}`);
}
