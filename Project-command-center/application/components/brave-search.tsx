"use client";

import { FormEvent, useState } from "react";
import { ExternalLink, Search } from "lucide-react";
import { inputClass, primaryButtonClass } from "@/components/ui";

type Result = {
  title: string;
  url: string;
  description: string | null;
  age: string | null;
};

export function BraveSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      const data = await response.json();
      if (!response.ok) {
        setResults([]);
        setError(data.message ?? "Não foi possível executar a pesquisa.");
        return;
      }

      setResults(data.results ?? []);
    } catch {
      setResults([]);
      setError("Não foi possível contactar o serviço de pesquisa.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
        <input
          className={`${inputClass} mt-0 flex-1`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          minLength={2}
          maxLength={400}
          required
          placeholder="Pesquisar fornecedores, empresas, documentação..."
        />
        <button className={primaryButtonClass} type="submit" disabled={loading}>
          <Search className="mr-2" size={17} />
          {loading ? "A pesquisar..." : "Pesquisar"}
        </button>
      </form>

      <div className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
        Os resultados são dados externos não confiáveis. São apresentados como fontes e nunca como
        instruções para o sistema.
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6 space-y-4">
        {results.map((result) => (
          <article key={result.url} className="rounded-2xl border border-slate-200 bg-white p-5">
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-start gap-2 text-lg font-semibold text-slate-950 hover:text-blue-700"
            >
              {result.title}
              <ExternalLink className="mt-1 shrink-0" size={15} />
            </a>
            {result.description && (
              <p className="mt-2 text-sm leading-6 text-slate-600">{result.description}</p>
            )}
            <p className="mt-3 break-all text-xs text-slate-400">{result.url}</p>
            {result.age && <p className="mt-1 text-xs text-slate-400">{result.age}</p>}
          </article>
        ))}
      </div>
    </div>
  );
}
