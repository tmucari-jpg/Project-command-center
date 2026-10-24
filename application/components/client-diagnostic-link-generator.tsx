"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createClientDiagnosticRequest,
  type ClientDiagnosticLinkState,
} from "@/app/(protected)/mutations";
import { primaryButtonClass } from "@/components/ui";

const initialState: ClientDiagnosticLinkState = { ok: false };

export function ClientDiagnosticLinkGenerator({
  factoryCaseId,
  defaultClientName = "",
  defaultOrganization = "",
  defaultContext = "",
}: {
  factoryCaseId: string;
  defaultClientName?: string;
  defaultOrganization?: string;
  defaultContext?: string;
}) {
  const [state, action, pending] = useActionState(createClientDiagnosticRequest, initialState);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (state.ok && state.requestId) router.refresh();
  }, [state.ok, state.requestId, router]);

  async function copyLink() {
    if (!state.url) return;
    await navigator.clipboard.writeText(state.url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="space-y-4">
      <form action={action} className="grid gap-4 md:grid-cols-2">
        <input type="hidden" name="factory_case_id" value={factoryCaseId} />
        <label className="block text-sm font-medium text-[var(--cc-foreground)]">
          Contacto do cliente
          <input
            className="mt-1 w-full rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface-strong)] px-3 py-2.5 text-sm"
            name="client_name"
            defaultValue={defaultClientName}
          />
        </label>
        <label className="block text-sm font-medium text-[var(--cc-foreground)]">
          Organização
          <input
            className="mt-1 w-full rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface-strong)] px-3 py-2.5 text-sm"
            name="client_organization"
            defaultValue={defaultOrganization}
          />
        </label>
        <label className="block text-sm font-medium text-[var(--cc-foreground)] md:col-span-2">
          Mensagem / contexto visível para o cliente
          <textarea
            className="mt-1 min-h-20 w-full rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface-strong)] px-3 py-2.5 text-sm"
            name="public_context"
            defaultValue={defaultContext}
            placeholder="Ex.: Para prepararmos o diagnóstico inicial, agradecemos o preenchimento deste breve questionário."
          />
        </label>
        <label className="block text-sm font-medium text-[var(--cc-foreground)]">
          Validade do link
          <select
            className="mt-1 w-full rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface-strong)] px-3 py-2.5 text-sm"
            name="expiry_days"
            defaultValue="14"
          >
            <option value="7">7 dias</option>
            <option value="14">14 dias</option>
            <option value="30">30 dias</option>
          </select>
        </label>
        <div className="flex items-end">
          <button className={primaryButtonClass} type="submit" disabled={pending}>
            {pending ? "A gerar..." : "Gerar link para enviar"}
          </button>
        </div>
      </form>

      {state.error && (
        <p className="text-sm text-[var(--cc-danger)]">{state.error}</p>
      )}

      {state.url && (
        <div className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface-muted)] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--cc-secondary)]">
            Link do questionário
          </p>
          <p className="mt-2 break-all text-sm text-[var(--cc-foreground)]">{state.url}</p>
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
