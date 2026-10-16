"use client";

import { useState } from "react";
import { secondaryButtonClass } from "@/components/ui";
import { parseFactorySuggestion, type FactorySuggestion } from "@/lib/factory-ai";

const INSTRUCTIONS = `Actua como assistente do Project Command Center. A partir da ideia do utilizador, prepara apenas a informação necessária para iniciar uma avaliação de viabilidade. Devolve APENAS JSON válido com as chaves: title, problem, expected_value, target_user. Escreve em português de Moçambique, claro, executivo e conciso. Não inventes dados. Não uses markdown.`;

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
    expectedValue = "Demonstrar valor na prática, recolher retorno dos utilizadores e aumentar adopção.";
  }

  return {
    title,
    problem: `Necessidade de estruturar e executar: ${clean}`,
    expected_value: expectedValue,
    target_user: targetUser,
    description: undefined,
    constraints: undefined,
  };
}

export function FactoryAIAssistant() {
  const [idea, setIdea] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggestion, setSuggestion] = useState<FactorySuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appliedCount, setAppliedCount] = useState(0);

  function applySuggestion(nextSuggestion: FactorySuggestion, scroll = true) {
    const details = document.querySelector<HTMLDetailsElement>('details[data-manual-entry="true"]');
    if (details) details.open = true;

    let count = 0;
    Object.entries(nextSuggestion).forEach(([name, value]) => {
      if (setField(name, value)) count += 1;
    });

    setAppliedCount(count);

    if (scroll) {
      const firstField = document.querySelector<HTMLElement>('[name="title"]');
      firstField?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  async function generate() {
    if (idea.trim().length < 3) return;
    setBusy(true);
    setError(null);
    setSuggestion(null);

    try {
      let text = "";

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
          text = await callLocal(idea);
        } catch (localError) {
          const localMessage = localError instanceof Error ? localError.message : "Serviço automático indisponível";
          const isQuotaError =
            cloudMessage.includes("credit_balance_exhausted") ||
            cloudMessage.includes("insufficient_quota") ||
            cloud.status === 429;

          if (isQuotaError) {
            const fallbackSuggestion = deterministicSuggestion(idea);
            setSuggestion(fallbackSuggestion);
            applySuggestion(fallbackSuggestion);
            return;
          }

          throw new Error(`AUTO_FILL_UNAVAILABLE: ${cloudMessage}; ${localMessage}`);
        }
      }

      const parsed = parseFactorySuggestion(text);
      if (!parsed) throw new Error("INVALID_AI_JSON");
      setSuggestion(parsed);
      applySuggestion(parsed);
    } catch (error) {
      const message = error instanceof Error ? error.message : "erro desconhecido";
      console.error("Assistente IA:", message);
      setError("Não foi possível preencher automaticamente. Tente novamente ou reveja os campos.");
    } finally {
      setBusy(false);
    }
  }

  function apply() {
    if (!suggestion) return;
    applySuggestion(suggestion);
  }

  return (
    <div className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface-muted)] p-4">
      <textarea
        value={idea}
        onChange={(event) => setIdea(event.target.value)}
        placeholder="Ex.: Quero lançar um workshop para um público específico, demonstrar a solução e converter participantes em utilizadores."
        className="min-h-24 w-full rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface)] p-3 text-sm text-[var(--cc-foreground)] outline-none"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={generate} disabled={busy || idea.trim().length < 3} className={secondaryButtonClass}>
          {busy ? "A preparar..." : "Preencher automaticamente"}
        </button>
        {suggestion && (
          <button type="button" onClick={apply} className={secondaryButtonClass}>Actualizar preenchimento</button>
        )}
      </div>
      {appliedCount > 0 && (
        <p className="mt-3 text-xs font-medium text-[var(--cc-foreground)]">
          Campos preparados. Reveja apenas se necessário.
        </p>
      )}
      {error && <p className="mt-3 text-xs text-red-700">{error}</p>}
    </div>
  );
}
