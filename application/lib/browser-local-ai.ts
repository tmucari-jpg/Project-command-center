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
    return { supported: false, reason: "A IA local sÃ³ pode ser executada no dispositivo do utilizador." };
  }
  if (!("gpu" in navigator)) {
    return { supported: false, reason: "Este dispositivo nÃ£o disponibiliza WebGPU para a IA local." };
  }
  return { supported: true, reason: "WebGPU disponÃ­vel. IA local sem API key nem quota." };
}

async function getEngine(onProgress?: (message: string) => void) {
¶»§q«^