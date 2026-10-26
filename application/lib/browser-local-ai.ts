"use client";

export const BROWSER_LOCAL_MODEL_ID = "SmolLM2-360M-Instruct-q4f16_1-MLC";
const WEBLLM_RUNTIME_URL = "https://esm.run/@mlc-ai/web-llm@0.2.85";

type ProgressReport = { text?: string; progress?: number };
type LocalEngine = {
  chat: { completions: { create: (input: Record<string, unknown>) => Promise<{ choices?: Array<{ message?: { content?: string | null } }> }> } };
};
type WebLLMModule = {
  CreateMLCEngine: (modelId: string, options?: { initProgressCallback?: (report: ProgressReport) => void }) => Promise<LocalEngine>;
};

let modulePromise: Promise<WebLLMModule> | null = null;
let enginePromise: Promise<LocalEngine> | null = null;

function runtimeImport(url: string) {
  const importer = new Function("url", "return import(url)") as (value: string) => Promise<WebLLMModule>;
  return importer(url);
}

async function loadRuntime() {
  if (!modulePromise) modulePromise = runtimeImport(WEBLLM_RUNTIME_URL);
  return modulePromise;
}

export function browserLocalAICompatibility() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { supported: false, reason: "A IA local só pode ser executada no dispositivo do utilizador." };
  }
  if (!("gpu" in navigator)) {
    return { supported: false, reason: "Este dispositivo não disponibiliza WebGPU para a IA local." };
  }
  return { supported: true, reason: "WebGPU disponível. IA local sem API key nem quota." };
}

async function getEngine(onProgress?: (message: string) => void) {
  if (!enginePromise) {
    enginePromise = loadRuntime().then(({ CreateMLCEngine }) =>
      CreateMLCEngine(BROWSER_LOCAL_MODEL_ID, {
        initProgressCallback(report) {
          const pct = typeof report.progress === "number" ? Math.round(report.progress * 100) : null;
          const label = report.text?.trim() || "A preparar o modelo local";
          onProgress?.(pct === null ? label : `${label} · ${pct}%`);
        },
      }),
    );
  }
  return enginePromise;
}

function parseJsonObject(value: string) {
  const trimmed = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("LOCAL_AI_INVALID_JSON");
  return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
}

const LOCAL_BOTIA_INSTRUCTIONS = [
  "És a IA Local PCC, fallback gratuito e sem quota do Project Command Center.",
  "Trabalhas apenas com o contexto factual fornecido. Não inventes factos, datas, preços, métricas, responsáveis ou evidências.",
  "Podes responder e, quando a instrução for inequívoca, propor apenas: create_action, set_project_next_action, append_project_note, create_blocker, update_blocker, resolve_blocker.",
  "Nunca alteres preços, orçamento, Gates, permissões, ownership ou elimines registos. Não cries prazos automaticamente.",
  "Se faltarem dados, usa operations=[] e explica o que falta.",
  "Responde APENAS com JSON válido com intent, response, summary, diagnosis e operations.",
  "intent deve ser question, command ou mixed.",
].join("\n");

export async function generateBrowserLocalBotIAPlan(
  context: Record<string, unknown>,
  onProgress?: (message: string) => void,
) {
  const compatibility = browserLocalAICompatibility();
  if (!compatibility.supported) throw new Error(compatibility.reason);

  onProgress?.("A iniciar IA Local PCC sem quota...");
  const engine = await getEngine(onProgress);
  onProgress?.("A analisar o projecto localmente...");

  const result = await engine.chat.completions.create({
    messages: [
      { role: "system", content: LOCAL_BOTIA_INSTRUCTIONS },
      { role: "user", content: "Contexto factual do PCC:\n" + JSON.stringify(context) },
    ],
    temperature: 0.1,
    max_tokens: 1000,
  });

  const content = result.choices?.[0]?.message?.content?.trim() ?? "";
  if (!content) throw new Error("A IA local não devolveu resposta.");
  onProgress?.("Resposta local concluída.");
  return parseJsonObject(content);
}
