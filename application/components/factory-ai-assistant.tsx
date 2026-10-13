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
  if (!value) return false;
  const element = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`);
  if (!element) return false;

  element.value = value;
  element.defaultValue = value;
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function deterministicSuggestion(input: string): FactorySuggestion {
  const clean = input.trim().replace(/\s+/g, " ");
  const title = clean.length <= 72 ? clean : clean.slice(0, 69).trimEnd() + "…";
  const lower = clean.toLowerCase();

  let targetUser = "Utilizadores ou equipa directamente envolvidos";
  if (lower.includes("agente") && lower.includes("imobili")) targetUser = "Agentes imobiliários";
  else if (lower.includes("cliente")) targetUser = "Clientes";
  else if (lower.includes("empresa")) targetUser = "Empresas";
  else if (lower.includes("colaborador") || lower.includes("equipa")) targetUser = "Equipa interna";

  let expectedValue = "Transformar a ideia em execução mensurável e validar resultados.";
  if (lower.includes("converter") || lower.includes("venda")) {
    expectedValue = "Aumentar conversão e gerar resultados comerciais mensuráveis.";
  } else if (lower.includes("demonstr") || lower.includes("workshop")) {
    expectedValue = "Demonstrar valor na prática, recolher feedback e aumentar adopção.";
  }

  return {
    title,
    problem: `Necessidade de estruturar e executar: ${clean}`,
    expected_value: expectedValue,
    target_user: targetUser,
    description: clean,
    constraints: "Validar recursos, prazo, responsáveis, orçamento e critérios de sucesso antes da execução.",
  };
}

export function FactoryAIAssistant() {
  const [idea, setIdea] = useState("");
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<FactorySuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appliedCount, setAppliedCount] = useState(0);

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
          const isQuotaError =
            cloudMessage.includes("credit_balance_exhausted") ||
            cloudMessage.includes("insufficient_quota") ||
            cloud.status === 429;

          if (isQuotaError) {
            setSuggestion(deterministicSuggestion(idea));
            setSource("PCC gratuito");
            return;
          }

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

    const details = document.querySelector<HTMLDetailsElement>("details");
    if (details) details.open = true;

    let count = 0;
    Object.entries(suggestion).forEach(([name, value]) => {
      if (setField(name, value)) count += 1;
    });

    setAppliedCount(count);

    const firstField = document.querySelector<HTMLElement>('[name="title"]');
    firstField?.scrollIntoView({ behavior: "smooth", block: "center" });
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
      {appliedCount > 0 && (
        <p className="mt-3 text-xs font-medium text-[var(--cc-foreground)]">
          {appliedCount} campos preenchidos. Reveja abaixo antes de analisar o projecto.
        </p>
      )}
      {error && <p className="mt-3 text-xs text-red-700">{error}</p>}
    </div>
  );
}
