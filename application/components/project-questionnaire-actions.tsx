"use client";

import Link from "next/link";
import { useState } from "react";

type Intent =
  | "idea"
  | "client_request"
  | "investment"
  | "internal_improvement"
  | "digital_solution"
  | "problem"
  | "gie360";

type Generated = {
  url: string;
  factoryCaseId: string;
  expiresAt: string;
};

const fieldClass =
  "w-full rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface-strong)] px-3 py-2.5 text-sm text-[var(--cc-foreground)] outline-none focus:border-[var(--cc-accent)]";

export function ProjectQuestionnaireActions({
  intent,
  intentLabel,
}: {
  intent: Intent;
  intentLabel: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [caseTitle, setCaseTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientOrganization, setClientOrganization] = useState("");
  const [publicContext, setPublicContext] = useState("");
  const [generated, setGenerated] = useState<Generated | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [error, setError] = useState("");

  async function generate() {
    if (!caseTitle.trim()) {
      setError("Indique um nome para identificar este caso.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/client-diagnostic/preintake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent,
          case_title: caseTitle,
          client_name: clientName,
          client_organization: clientOrganization,
          public_context: publicContext,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        url?: string;
        factoryCaseId?: string;
        expiresAt?: string;
      };

      if (!response.ok || !data.url || !data.factoryCaseId || !data.expiresAt) {
        setError(data.error ?? "Não foi possível gerar o questionário.");
        return;
      }

      setGenerated({
        url: data.url,
        factoryCaseId: data.factoryCaseId,
        expiresAt: data.expiresAt,
      });
    } catch {
      setError("Não foi possível gerar o questionário.");
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!generated?.url) return;
    setCopyError("");
    try {
      await navigator.clipboard.writeText(generated.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
      setCopyError("O navegador não permitiu copiar. Seleccione o link apresentado e copie-o manualmente; o link continua válido.");
    }
  }

  return (
    <section className="rounded-2xl border border-[#c9dbd4] bg-[#f8f6f0] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#146453]">
              Questionário de diagnóstico
            </p>
            <span className="rounded-full border border-[#e2d3ae] bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#8b6a25]">
              Caminho recomendado
            </span>
          </div>
          <h3 className="mt-2 text-base font-semibold text-[#073f36]">
            {intentLabel}
          </h3>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-[var(--cc-radius-md)] bg-[#073f36] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#052f29]"
            type="button"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? "Fechar" : "Gerar questionário adaptado"}
          </button>
          <a
            className="rounded-[var(--cc-radius-md)] border border-[#c99439] bg-white px-4 py-2.5 text-sm font-semibold text-[#073f36] transition hover:bg-[#fffaf0]"
            href={`/api/exports/client-diagnostic-template?intent=${encodeURIComponent(intent)}`}
          >
            Baixar questionário
          </a>
        </div>
      </div>

      {expanded && !generated && (
        <div className="mt-5 border-t border-[#d8e3de] pt-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-[#142825] sm:col-span-2">
              Nome do caso / oportunidade
              <input
                className={"mt-1 " + fieldClass}
                value={caseTitle}
                onChange={(event) => setCaseTitle(event.target.value)}
                placeholder="Ex.: Diagnóstico comercial — Cliente X"
              />
            </label>
            <label className="block text-sm font-medium text-[#142825]">
              Nome do contacto
              <input
                className={"mt-1 " + fieldClass}
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
                placeholder="Opcional"
              />
            </label>
            <label className="block text-sm font-medium text-[#142825]">
              Organização
              <input
                className={"mt-1 " + fieldClass}
                value={clientOrganization}
                onChange={(event) => setClientOrganization(event.target.value)}
                placeholder="Opcional"
              />
            </label>
            <label className="block text-sm font-medium text-[#142825] sm:col-span-2">
              Mensagem para o cliente
              <input
                className={"mt-1 " + fieldClass}
                value={publicContext}
                onChange={(event) => setPublicContext(event.target.value)}
                placeholder="Opcional"
              />
            </label>
          </div>

          {error && (
            <p className="mt-3 rounded-lg border border-[#ead2d2] bg-white px-3 py-2 text-sm text-[#8a3e3e]">
              {error}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              className="rounded-[var(--cc-radius-md)] bg-[#073f36] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              type="button"
              onClick={generate}
              disabled={loading}
            >
              {loading ? "A gerar..." : "Gerar link seguro"}
            </button>
            <span className="text-xs text-[#667085]">Validade fixa: 7 dias.</span>
          </div>
        </div>
      )}

      {generated && (
        <div className="mt-5 rounded-xl border border-[#b9d0c7] bg-white p-4">
          <p className="text-sm font-semibold text-[#073f36]">Questionário pronto para enviar</p>
          {copyError && <p role="alert" className="mt-2 text-sm text-[var(--cc-danger)]">{copyError}</p>}
          <p className="mt-1 text-xs text-[#667085]">
            Válido até {new Date(generated.expiresAt).toLocaleDateString("pt-PT")}.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              className={fieldClass}
              value={generated.url}
              readOnly
              aria-label="Link seguro do questionário"
            />
            <button
              className="shrink-0 rounded-[var(--cc-radius-md)] border border-[#c99439] bg-white px-4 py-2.5 text-sm font-semibold text-[#073f36]"
              type="button"
              onClick={copyLink}
            >
              {copied ? "Copiado" : "Copiar link"}
            </button>
          </div>
          <div className="mt-3">
            <Link
              className="text-sm font-semibold text-[#146453] underline underline-offset-4"
              href={`/project-factory/${generated.factoryCaseId}`}
            >
              Abrir acompanhamento do caso
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
