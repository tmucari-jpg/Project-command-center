"use client";

import { generateFreeAssistance } from "@/lib/free-ai-assist";
import { useRef, useState } from "react";
import { secondaryButtonClass } from "@/components/ui";
import { parseFactorySuggestion, type FactorySuggestion } from "@/lib/factory-ai";

const INSTRUCTIONS = `Actua como assistente do Project Command Center. A partir da ideia do utilizador, prepara apenas a informação necessária para iniciar uma avaliação de viabilidade. Devolve APENAS JSON válido com as chaves: title, problem, expected_value, target_user. Escreve em português de Moçambique, claro, executivo e conciso. Não inventes dados. Não uses markdown.`;

export function FactoryAIAssistant() {
  const anchor = useRef<HTMLDivElement>(null);
  const [idea, setIdea] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggestion, setSuggestion] = useState<FactorySuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appliedCount, setAppliedCount] = useState(0);

  function applySuggestion(nextSuggestion: FactorySuggestion, scroll = true) {
    const form = anchor.current?.closest("form") ?? anchor.current?.parentElement;
    if (!form) return;
    const details = form.querySelector<HTMLDetailsElement>('details[data-manual-entry="true"]');
    if (details) details.open = true;
    let count = 0;
    Object.entries(nextSuggestion).forEach(([name, value]) => {
      const field = form.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`);
      // Filling never overwrites a value already entered or reviewed by a person.
      if (!field || !value || field.value.trim()) return;
      field.value = value;
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
      count += 1;
    });

    setAppliedCount(count);

    if (scroll) {
      const firstField = form.querySelector<HTMLElement>('[name="title"]');
      firstField?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  async function generate() {
    if (idea.trim().length < 3) return;
    setBusy(true);
    setError(null);
    setSuggestion(null);

    try {
      const { text } = await generateFreeAssistance(idea, INSTRUCTIONS);
      const parsed = parseFactorySuggestion(text);
      if (!parsed) throw new Error("INVALID_AI_JSON");
      setSuggestion(parsed);
      applySuggestion(parsed);
    } catch (error) {
      const message = error instanceof Error ? error.message : "erro desconhecido";
      console.error("Assistente IA:", message);
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  function apply() {
    if (!suggestion) return;
    applySuggestion(suggestion);
  }

  return (
    <div ref={anchor} className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface-muted)] p-4">
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
          Campos vazios preparados. Reveja as sugestões antes de guardar.
        </p>
      )}
      {error && <p className="mt-3 text-xs text-red-700">{error}</p>}
    </div>
  );
}
