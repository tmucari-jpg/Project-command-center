"use client";

import { useState } from "react";

export function Gie360ShareAccess({ projectId }: { projectId: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const relativePath = `/gie-client/${projectId}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(new URL(relativePath, window.location.origin).href);
      setCopied(true);
      setError(false);
    } catch {
      setError(true);
      setCopied(false);
    }
  }

  return (
    <section className="rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-strong)] p-5">
      <h2 className="text-lg font-semibold">Link de acompanhamento deste projecto</h2>
      <p className="mt-2 text-sm text-[var(--cc-secondary)]">
        Partilhe o acesso independente GIE360° com o cliente. O cliente acompanha projectos,
        tarefas, evidências e avaliações apenas da sua empresa. Não vê o PCC administrativo.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={copyLink}
          className="rounded-lg bg-[#073f36] px-4 py-2 text-sm font-semibold text-white">
          Copiar link do projecto
        </button>
        <a href={relativePath} target="_blank" rel="noopener noreferrer"
          className="rounded-lg border border-[var(--cc-border)] px-4 py-2 text-sm font-semibold">
          Abrir acompanhamento
        </a>
      </div>
      {copied && <p role="status" className="mt-2 text-sm">Link copiado. Já pode partilhá-lo com o cliente.</p>}
      {error && <p role="alert" className="mt-2 text-sm">Não foi possível copiar automaticamente. Abra o portal e copie o endereço do navegador.</p>}
      <p className="mt-3 text-xs text-[var(--cc-secondary)]">
        Segurança: o link não é uma autorização. O cliente precisa de iniciar sessão com a
        conta associada à organização. O acesso é validado no servidor e pela base de dados.
      </p>
    </section>
  );
}
