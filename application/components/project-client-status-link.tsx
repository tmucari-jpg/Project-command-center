"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  publishProjectClientStatus,
  type ProjectClientStatusLinkState,
} from "@/app/(protected)/mutations";
import { primaryButtonClass } from "@/components/ui";

const initialState: ProjectClientStatusLinkState = { ok: false };

export function ProjectClientStatusLink({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState(publishProjectClientStatus, initialState);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  async function copyLink() {
    if (!state.url) return;
    setCopyError("");
    try {
      await navigator.clipboard.writeText(state.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
      setCopyError("O navegador não permitiu copiar. Seleccione o link apresentado e copie-o manualmente; o link continua válido.");
    }
  }

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <input type="hidden" name="project_id" value={projectId} />
        <label className="block text-sm font-medium text-[var(--cc-foreground)]">
          Nota visível para o cliente, se necessária
          <textarea
            className="mt-1 min-h-20 w-full rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface-strong)] px-3 py-2.5 text-sm"
            name="public_note"
            placeholder="Opcional. O PCC já inclui automaticamente estado, entregáveis, KPIs e próxima acção."
          />
        </label>
        <button className={primaryButtonClass} type="submit" disabled={pending}>
          {pending ? "A publicar..." : "Publicar Status & Next Actions"}
        </button>
      </form>

      {state.error && <p className="text-sm text-[var(--cc-danger)]">{state.error}</p>}

      {state.url && (
        <div className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface-muted)] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--cc-secondary)]">Link seguro</p>
          <p className="mt-2 break-all text-sm text-[var(--cc-foreground)]">{state.url}</p>
          {copyError && <p role="alert" className="mt-2 text-sm text-[var(--cc-danger)]">{copyError}</p>}
          <button
            type="button"
            onClick={copyLink}
            className="mt-3 rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--cc-foreground)]"
          >
            {copied ? "Copiado" : "Copiar link"}
          </button>
        </div>
      )}
    </div>
  );
}
