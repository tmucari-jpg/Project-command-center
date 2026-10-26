import { Download, FileArchive, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, EmptyState, inputClass, primaryButtonClass, secondaryButtonClass, selectClass } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { officialDocumentLabel } from "@/lib/official-documents";

export default async function OfficialDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ uploaded?: string; error?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireAdmin();

  const { data: documents, error: documentsError } = await supabase
    .from("pcc_official_documents")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const current = (documents ?? []).filter((item) => item.status === "current");

  return (
    <>
      <PageHeader eyebrow="Administração" title="Repositório Oficial PCC" />

      {params.uploaded && (
        <Card className="mb-6 p-5">
          <p className="font-semibold text-[var(--cc-foreground)]">Ficheiro oficial registado.</p>
          <p className="mt-2 text-sm text-[var(--cc-secondary)]">
            O ficheiro está no repositório oficial privado do PCC. Este repositório é independente da Biblioteca do Projecto e dos entregáveis dos clientes.
          </p>
        </Card>
      )}

      {(params.error ?? documentsError?.message) && (
        <Card className="mb-6 p-5 text-sm text-[var(--cc-danger)]">{params.error ?? documentsError?.message}</Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-secondary)]">Versões actuais</p><p className="mt-2 text-2xl font-semibold text-[var(--cc-foreground)]">{current.length}</p></Card>
        <Card className="p-5"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-secondary)]">Ficheiros oficiais</p><p className="mt-2 text-2xl font-semibold text-[var(--cc-foreground)]">{documents?.length ?? 0}</p></Card>
        <Card className="p-5"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-secondary)]">Armazenamento</p><p className="mt-2 text-lg font-semibold text-[var(--cc-foreground)]">Privado · versionado</p></Card>
      </div>

      <Card className="mt-6 p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck size={20} className="mt-0.5 text-[var(--cc-accent)]" aria-hidden="true" />
          <div>
            <h2 className="font-semibold text-[var(--cc-foreground)]">Âmbito do repositório</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
              Este é o repositório oficial de download do PCC: Master Mind, Guia Comercial, diagnóstico de release, pacote técnico e outros ficheiros oficiais da plataforma. Não é a biblioteca de um projecto e não guarda o entregável de diagnóstico do cliente.
            </p>
          </div>
        </div>
      </Card>

      <Card className="mt-6 p-5">
        <h2 className="font-semibold text-[var(--cc-foreground)]">Registar nova versão oficial</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
          Use “Rascunho” enquanto a versão ainda não estiver liberada. “Actual / oficial” exige validação operacional da release, mas não depende de nenhum entregável de projecto.
        </p>

        <form action="/api/official-documents/upload" method="post" encType="multipart/form-data" className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-[var(--cc-foreground)]">Tipo de documento
            <select className={selectClass} name="document_key" defaultValue="master_mind" required>
              <option value="master_mind">Master Mind</option>
              <option value="commercial_guide">Guia Comercial</option>
              <option value="technical_package">Pacote Técnico PCC / pen drive</option>
              <option value="release_diagnostic">Diagnóstico de Release</option>
              <option value="other">Outro ficheiro oficial</option>
            </select>
          </label>

          <label className="text-sm font-medium text-[var(--cc-foreground)]">Estado
            <select className={selectClass} name="status" defaultValue="draft" required>
              <option value="draft">Rascunho</option>
              <option value="current">Actual / oficial</option>
            </select>
          </label>

          <label className="text-sm font-medium text-[var(--cc-foreground)]">Título
            <input className={inputClass} name="title" required maxLength={180} placeholder="Ex.: Master Mind — PCC" />
          </label>

          <label className="text-sm font-medium text-[var(--cc-foreground)]">Versão
            <input className={inputClass} name="version_label" required maxLength={80} placeholder="Ex.: Release 2026-10-26" />
          </label>

          <label className="text-sm font-medium text-[var(--cc-foreground)] md:col-span-2">Ficheiro
            <input className={inputClass} type="file" name="file" accept=".pdf,.doc,.docx,.zip,.txt,.json,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/zip,text/plain,application/json" required />
          </label>

          <div className="md:col-span-2">
            <button className={primaryButtonClass} type="submit">Guardar no Repositório Oficial PCC</button>
          </div>
        </form>
      </Card>

      <Card className="mt-6">
        <div className="border-b border-[var(--cc-border)] p-5">
          <h2 className="inline-flex items-center gap-2 font-semibold text-[var(--cc-foreground)]"><FileArchive size={18} /> Downloads oficiais</h2>
        </div>
        <div className="p-5">
          {!documents?.length ? (
            <EmptyState>Ainda não existem ficheiros no Repositório Oficial PCC.</EmptyState>
          ) : (
            <div className="space-y-3">
              {documents.map((item) => (
                <article key={item.id} className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-[var(--cc-foreground)]">{item.title}</p>
                      <p className="mt-1 text-xs text-[var(--cc-secondary)]">
                        {officialDocumentLabel(item.document_key)} · {String(item.format).toUpperCase()} · {item.version_label} · {item.status === "current" ? "Actual" : item.status === "draft" ? "Rascunho" : "Substituído"}
                        {item.created_at ? ` · ${formatDateTime(item.created_at)}` : ""}
                      </p>
                      {item.sha256 && <p className="mt-2 break-all text-[11px] text-[var(--cc-tertiary)]">SHA-256: {item.sha256}</p>}
                    </div>
                    <a download className={secondaryButtonClass} href={`/api/official-documents/${item.id}/download`}>
                      <Download size={16} className="mr-2" /> Baixar
                    </a>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </Card>
    </>
  );
}
