"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  publishProjectClientStatus,
  previewProjectClientStatus,
  type ProjectClientStatusLinkState,
} from "@/app/(protected)/mutations";
import { primaryButtonClass } from "@/components/ui";

const initialState: ProjectClientStatusLinkState = { ok: false };

export function ProjectClientStatusLink({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState(publishProjectClientStatus, initialState);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [publicNote, setPublicNote] = useState("");
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewProjectClientStatus>> | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
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
            value={publicNote}
            onChange={(event) => { setPublicNote(event.target.value); setReviewed(false); setPreview(null); }}
            placeholder="Opcional. O PCC já inclui automaticamente estado, entregáveis, KPIs e próxima acção."
          />
        </label>
        <button type="button" className={primaryButtonClass} disabled={pending || previewBusy} onClick={async () => {
          setPreviewBusy(true); setReviewed(false); setPreview(null);
          try { setPreview(await previewProjectClientStatus(projectId, publicNote)); }
          finally { setPreviewBusy(false); }
        }}>{previewBusy ? "A carregar..." : "Pré-visualizar informação integral"}</button>
        <input type="hidden" name="preview_fingerprint" value={preview?.ok ? preview.fingerprint : ""} />
        {preview && !preview.ok && <p role="alert">{preview.error}</p>}
        {preview?.ok && <section className="rounded-xl border p-4 text-sm">
          <h3 className="font-semibold">Conteúdo exacto para partilha</h3>
          <p>Projecto: {preview.preview.project.title}</p>
          <p>Estado: {preview.preview.project.status}</p>
          <p>Resultado: {preview.preview.project.expected_result || "Não definido"}</p>
          <p>Próxima acção: {preview.preview.project.next_action || "Não definida"}</p>
          <p>Nota: {preview.preview.public_note || "Sem nota"}</p>
          <h4 className="mt-3 font-semibold">Entregáveis</h4>
          <pre className="whitespace-pre-wrap break-words text-xs">{JSON.stringify(preview.preview.deliverables,null,2)}</pre>
          <h4 className="mt-3 font-semibold">Indicadores</h4>
          <pre className="whitespace-pre-wrap break-words text-xs">{JSON.stringify(preview.preview.kpis,null,2)}</pre>
        </section>}
        <div className="rounded-xl border border-[#d8e2dc] bg-[#f8f6f0] p-4 text-sm">
          <p className="font-semibold text-[#073f36]">Pré-visualização para partilha externa</p>
          <p className="mt-2 whitespace-pre-wrap text-[#667085]">{publicNote.trim() || "Sem nota adicional. Os dados do projecto, entregáveis e métricas serão incluídos no snapshot."}</p>
          <label className="mt-3 flex items-start gap-2 border-t border-[#d8e2dc] pt-3">
            <input type="checkbox" name="reviewed" disabled={!preview?.ok} checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} className="mt-1" />
            <span>Revisei os dados que serão partilhados, incluindo os entregáveis, e autorizo a emissão deste link externo.</span>
          </label>
        </div>
        <button className={primaryButtonClass} type="submit" disabled={pending || !reviewed || !preview?.ok}>
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
