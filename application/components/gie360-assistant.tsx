"use client";
import { useState } from "react";
import { inputClass, primaryButtonClass } from "@/components/ui";
import type { parseGIE360Answer } from "@/lib/gie360-assistant";
type Answer = ReturnType<typeof parseGIE360Answer>;

export function GIE360Assistant({ organizationId, authorized }: { organizationId: string; authorized: boolean }) {
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ answer: Answer; requestId: string; provider: string } | null>(null);
  return <section className="rounded-xl border border-[#073F36]/15 bg-white p-6">
    <h2 className="text-xl font-semibold">Assistente GIE360°</h2>
    <p className="mt-2 text-sm leading-6">Analisa as respostas registadas e os lotes aprovados desta empresa. As observações mostram a fonte; as sugestões precisam de revisão humana.</p>
    {!authorized ? <p className="mt-4 rounded-lg bg-amber-50 p-4 text-sm">A análise IA aguarda aprovação do módulo, do pacote e da autorização de tratamento dos dados pelo gestor. Pode continuar a guardar respostas e a importar dados.</p> : <form className="mt-4 space-y-3" onSubmit={async (event) => {
      event.preventDefault(); if (pending) return; setPending(true); setError(""); setResult(null);
      const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 28_000);
      try {
        const response = await fetch("/gie360/api/assist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId, question }), signal: controller.signal });
        const body = await response.json(); if (!response.ok) throw new Error(body.error || "Análise indisponível. Tente novamente."); setResult(body);
      } catch (failure) { setError(failure instanceof Error && failure.name !== "AbortError" ? failure.message : "A análise excedeu o tempo de espera. Os seus dados estão guardados; tente novamente."); }
      finally { clearTimeout(timeout); setPending(false); }
    }}>
      <label className="block text-sm font-medium">O que pretende analisar?<textarea className={inputClass} minLength={3} maxLength={3000} rows={3} value={question} onChange={(event) => setQuestion(event.target.value)} required placeholder="Que dados me faltam para avaliar os custos?" /></label>
      <button className={primaryButtonClass} disabled={pending}>{pending ? "A analisar dados e verificar fontes…" : "Analisar dados registados"}</button>
    </form>}
    {error && <p className="mt-4 text-sm text-red-800" role="alert">{error}</p>}
    {result && <div className="mt-5 space-y-4" role="status">
      <h3 className="font-semibold">Observações com fonte</h3>
      {!result.answer.facts.length && <p className="text-sm">Não há evidência suficiente para uma observação factual sobre esta pergunta.</p>}
      {result.answer.facts.map((fact, index) => <blockquote key={index} className="border-l-2 border-[#C99439] pl-3 text-sm"><p className="whitespace-pre-wrap">{fact.quote}</p><footer className="mt-1 text-xs text-slate-600">{fact.source_label} · {fact.validation === "approved" ? "Lote aprovado" : "Informação declarada, por validar"}<details><summary>Referência de origem</summary>{fact.source_ref}</details></footer></blockquote>)}
      {!!result.answer.suggestions.length && <div><h3 className="font-semibold">Sugestões para revisão</h3><ul className="mt-2 list-disc space-y-2 pl-5 text-sm">{result.answer.suggestions.map((suggestion, index) => <li key={index}>{suggestion.text}</li>)}</ul><p className="mt-2 text-xs text-slate-600">Nenhuma alteração foi executada por estas sugestões.</p></div>}
      {!!result.answer.missing_information.length && <div><h3 className="font-semibold">Informação a recolher</h3><ul className="mt-2 list-disc pl-5 text-sm">{result.answer.missing_information.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
      <p className="text-xs text-slate-500">{result.provider} · Análise {result.requestId}</p>
    </div>}
  </section>;
}
