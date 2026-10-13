"use client";

import { useState } from "react";
import { secondaryButtonClass } from "@/components/ui";
import { parseFactorySuggestion, type FactorySuggestion } from "@/lib/factory-ai";

const INSTRUCTIONS = `Actua como assistente do Project Command Center. A partir da ideia do utilizador, devolve APENAS JSON válido com as chaves: title, problem, expected_value, target_user, description, constraints. Escreve em português claro, executivo e conciso. Não uses markdown.`;

async function callLocal(input: string) {
  const response = await fetch("http://127.0.0.1:8080/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "qwen-local",
      messages: [
        { role: "system", content: INSTRUCTIONS },
        { role: "user", content: input },
      ],
      temperature: 0.2,
      max_tokens: 900,
    }),
  });

  if (!response.ok) throw new Error(`LOCAL_${response.status}`);
  const data = await response.json();
  return String(data?.choices?.[0]?.message?.content ?? "");
}

function setField(name: string, value?: string) {
  if (!value) return;
  const element = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`);
  if (!element) return;
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

export function FactoryAIAssistant() {
  const [idea, setIdea] = useState("");
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<FactorySuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (idea.trim().length < 3) return;
    setBusy(true);
    setError(null);
    setSuggestion(null);

    try {
      let text = "";
      let provider = "OpenAI";

      const cloud = await fetch("/api/ai/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: idea, instructions: INSTRUCTIONS }),
      });

      if (cloud.ok) {
        const data = await cloud.json();
        text = String(data.text ?? "");
      } else {
        const cloudError = await cloud.json().catch(() => ({ error: `HTTP ${cloud.status}` }));
        const cloudMessage = String(cloudError.error ?? `HTTP ${cloud.status}`).slice(0, 320);
        try {
          provider = "Qwen local";
          text = await callLocal(idea);
        } catch (localError) {
          const localMessage = localError instanceof Error ? localError.message : "Qwen local indisponível";
          throw new Error(`Cloud: ${cloudMessage} | Local: ${localMessage}`);
        }
      }

      const parsed = parseFactorySuggestion(text);
      if (!parsed) throw new Error("INVALID_AI_JSON");
      setSuggestion(parsed);
      setSource(provider);
    } catch (error) {
      const message = error instanceof Error ? error.message : "erro desconhecido";
      console.error("Assistente IA:", message);
      const safeDiagnostic = message
        .replace(/Bearer\s+[^\s]+/gi, "Bearer [redacted]")
        .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]")
        .slice(0, 420);
      setError(`Não foi possível obter sugestões. Diagnóstico: ${safeDiagnostic}`);
    } finally {
      setBusy(false);
    }
  }

  function apply() {
    if (!suggestion) return;
    Object.entries(suggestion).forEach(([name, value]) => setField(name, value));
  }

  return (
    <div className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface-muted)] p-4">
      <p className="text-sm font-semibold text-[var(--cc-foreground)]">Assistente IA</p>
      <p className="mt-1 text-xs leading-5 text-[var(--cc-secondary)]">
        Descreva a ideia de forma simples. O PCC ajuda a organizar a informação necessária.
      </p>
      <textarea
        value={idea}
        onChange={(event) => setIdea(event.target.value)}
        placeholder="Ex.: Quero lançar um workshop para agentes imobiliários e converter participantes em utilizadores da Easy Property."
        className="mt-3 min-h-24 w-full rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface)] p-3 text-sm text-[var(--cc-foreground)] outline-none"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={generate} disabled={busy || idea.trim().length < 3} className={secondaryButtonClass}>
          {busy ? "A preparar..." : "Ajuda-me a preencher"}
        </button>
        {suggestion && (
          <button type="button" onClick={apply} className={secondaryButtonClass}>Aplicar aos campos</button>
        )}
      </div>
      {source && <p className="mt-3 text-xs text-[var(--cc-secondary)]">Sugestão gerada por {source}.</p>}
      {error && <p className="mt-3 text-xs text-red-700">{error}</p>}
    </div>
  );
}
