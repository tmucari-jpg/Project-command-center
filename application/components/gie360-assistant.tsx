"use client";

import { useState } from "react";

export function Gie360Assistant({ organizationId }: { organizationId: string }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [pending, setPending] = useState(false);

  async function ask() {
    if (pending || question.trim().length < 5) return;
    setPending(true);
    setAnswer("");
    try {
      const response = await fetch("/api/gie360/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organization_id: organizationId, question }),
      });
      const body = await response.json();
      setAnswer(response.ok
        ? body.text
        : body.error === "gie360_ai_not_authorized"
          ? "O âmbito contratado não autoriza esta IA."
          : "A IA GIE360° está indisponível neste momento. A avaliação manual continua disponível.");
    } catch {
      setAnswer("Não foi possível comunicar com a IA GIE360°. Nenhuma alteração foi executada.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mt-5 rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-strong)] p-5">
      <h2 className="text-lg font-semibold">IA própria GIE360°</h2>
      <p className="mt-2 text-sm text-[var(--cc-secondary)]">
        Assistente especializado, limitado ao âmbito autorizado desta organização.
        As recomendações não alteram dados nem constituem decisões aprovadas.
      </p>
      <label className="mt-4 block text-sm font-semibold">
        Questão empresarial
        <textarea value={question} onChange={(event) => setQuestion(event.target.value)}
          maxLength={1500} className="mt-2 min-h-24 w-full rounded-lg border border-[var(--cc-border)] p-3 text-sm"
          placeholder="Que informação falta para avaliar o módulo autorizado?" />
      </label>
      <button type="button" disabled={pending || question.trim().length < 5} onClick={ask}
        className="mt-3 rounded-lg bg-[#073f36] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
        {pending ? "A consultar…" : "Consultar IA GIE360°"}
      </button>
      {answer && <div role="status" className="mt-4 whitespace-pre-wrap rounded-lg border border-[var(--cc-border)] bg-[#f8f6f0] p-4 text-sm">{answer}</div>}
    </section>
  );
}
