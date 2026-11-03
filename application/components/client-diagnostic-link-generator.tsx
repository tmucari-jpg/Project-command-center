"use client";

import { useActionState, useState } from "react";
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
  buttonLabel = "Gerar questionário",
}: {
  factoryCaseId: string;
  defaultClientName?: string;
  defaultOrganization?: string;
  defaultContext?: string;
  buttonLabel?: string;
}) {
  const [state, action, pending] = useActionState(createClientDiagnosticRequest, initialState);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [phone, setPhone] = useState("");
  const [preview, setPreview] = useState({ contact: defaultClientName, organization: defaultOrganization, context: defaultContext });

  const whatsappNumber = phone.replace(/\D/g, "");
  const validWhatsappNumber = whatsappNumber.length >= 8 && whatsappNumber.length <= 15;
  const shareMessage = state.url
    ? ["Olá" + (preview.contact ? " " + preview.contact : "") + ".",
       "Segue o link do diagnóstico do PCC para " + (preview.organization || "a sua organização") + ":",
       state.url,
       "Este link é pessoal e tem validade limitada."].join("\n")
    : "";

  function downloadLink() {
    if (!state.url) return;
    const contents = [
      "PCC — Link do diagnóstico", "Destinatário: " + preview.contact,
      "Organização: " + preview.organization, "Número: " + (phone || "Não indicado"),
      "", shareMessage, "", "Confirme o destinatário antes de partilhar.",
    ].join("\n");
    const blob = new Blob([contents], { type: "text/plain;charset=utf-8" });
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = "PCC-link-diagnostico-" + factoryCaseId.slice(0, 8) + ".txt";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  }


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
      <form action={action} onChange={(event) => { if (event.target.getAttribute("name") === "reviewed") return; const data = new FormData(event.currentTarget); setPreview({ contact: String(data.get("client_name") ?? ""), organization: String(data.get("client_organization") ?? ""), context: String(data.get("public_context") ?? "") }); setReviewed(false); }} className="grid gap-4 md:grid-cols-2">
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
          Número WhatsApp do destinatário (com indicativo internacional)
          <input type="tel" inputMode="tel" autoComplete="tel" name="recipient_phone"
            className="mt-1 w-full rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface-strong)] px-3 py-2.5 text-sm"
            placeholder="Ex.: +258 84 123 4567" value={phone} onChange={(event) => setPhone(event.target.value)}
          />
          <span className="mt-1 block text-xs text-[var(--cc-secondary)]">O número permite abrir a mensagem no WhatsApp depois de gerar o link. Não existe envio automático de SMS ou WhatsApp.</span>
        </label>
        <label className="block text-sm font-medium text-[var(--cc-foreground)] md:col-span-2">
          Mensagem / contexto visível para o cliente
          <textarea
            className="mt-1 min-h-20 w-full rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface-strong)] px-3 py-2.5 text-sm"
            name="public_context"
            defaultValue={defaultContext}
            placeholder="Ex.: Para prepararmos um diagnóstico mais focado e uma próxima conversa mais objectiva, agradecemos o preenchimento deste breve questionário."
          />
        </label>
        <div className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-[var(--cc-surface-muted)] p-3 text-sm">
          <p className="font-semibold text-[var(--cc-foreground)]">Validade do questionário: 7 dias</p>
          <p className="mt-1 text-xs leading-5 text-[var(--cc-secondary)]">
            Se expirar ou for necessário recolher nova informação, pode emitir uma nova solicitação.
          </p>
        </div>
        <div className="rounded-xl border border-[#d8e2dc] bg-[#f8f6f0] p-4 text-sm md:col-span-2">
          <p className="font-semibold text-[#073f36]">Pré-visualização da informação destinada ao cliente</p>
          <dl className="mt-3 space-y-2"><div><dt className="text-xs font-semibold">Destinatário</dt><dd>{preview.contact || "Por identificar"}</dd></div><div><dt className="text-xs font-semibold">Empresa</dt><dd>{preview.organization || "Por identificar"}</dd></div><div><dt className="text-xs font-semibold">Número para partilha</dt><dd>{phone || "Por indicar"}</dd></div><div><dt className="text-xs font-semibold">Mensagem que o cliente verá</dt><dd className="whitespace-pre-wrap">{preview.context || "Sem mensagem adicional"}</dd></div><div><dt className="text-xs font-semibold">Validade</dt><dd>7 dias após emissão</dd></div></dl>
          <label className="mt-4 flex items-start gap-2 border-t border-[#d8e2dc] pt-3"><input type="checkbox" name="reviewed" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} className="mt-1" /><span>Revisei destinatário, organização e conteúdo, confirmei que não incluem informação interna ou dados não validados e aprovo a emissão do link externo.</span></label>
        </div>
        <div className="flex items-end">
          <button className={primaryButtonClass} type="submit" disabled={pending || !reviewed}>
            {pending ? "A gerar..." : reviewed ? buttonLabel : "Validar informação antes de gerar"}
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
          {copyError && <p role="alert" className="mt-2 text-sm text-[var(--cc-danger)]">{copyError}</p>}
          <p className="mt-2 text-xs text-[var(--cc-secondary)]">Guarde ou partilhe este link antes de sair desta página. Por segurança, o token só é mostrado após gerar; poderá emitir uma nova solicitação caso o perca.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={copyLink} className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--cc-foreground)]">
              {copied ? "Copiado" : "Copiar link"}
            </button>
            <button type="button" onClick={downloadLink} className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--cc-foreground)]">
              Descarregar link (.txt)
            </button>
            {validWhatsappNumber ? (
              <a href={"https://wa.me/" + whatsappNumber + "?text=" + encodeURIComponent(shareMessage)} target="_blank" rel="noopener noreferrer"
                className="rounded-[var(--cc-radius-md)] bg-[#075e54] px-3 py-2 text-sm font-semibold text-white">
                Abrir WhatsApp para enviar
              </a>
            ) : (
              <span className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] px-3 py-2 text-xs text-[var(--cc-secondary)]">Indique um número válido para partilhar pelo WhatsApp.</span>
            )}
          </div>
          <p className="mt-2 text-xs text-[var(--cc-secondary)]">O WhatsApp abre a mensagem preparada para o número indicado. Confirme o destinatário e toque em Enviar; o PCC não confirma a entrega.</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-3 text-sm font-semibold underline text-[var(--cc-accent)]">
            Voltar ao diagnóstico depois de guardar o link
          </button>
        </div>
      )}
    </div>
  );
}
