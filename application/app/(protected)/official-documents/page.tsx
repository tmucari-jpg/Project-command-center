import Link from "next/link";
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

  const [
    { data: documents, error: documentsError },
    { data: projects },
    { data: deliverables },
  ] = await Promise.all([
    supabase.from("pcc_official_documents").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("projects").select("id,title").eq("user_id", user.id).order("title"),
    supabase.from("deliverables").select("id,project_id,title,status").eq("user_id", user.id).order("created_at", { ascending: false }),
  ]);

  const projectById = new Map((projects ?? []).map((item) => [item.id, item.title]));
  const deliverableById = new Map((deliverables ?? []).map((item) => [item.id, item.title]));
  const current = (documents ?? []).filter((item) => item.status === "current");

  return (
    <>
      <PageHeader eyebrow="Resultados" title="Documentos Oficiais PCC" />
      {params.uploaded && (
        <Card className="mb-6 p-5">
          <p className="font-semibold text-[var(--cc-foreground)]">Documento oficial registado.</p>
          <p className="mt-2 text-sm text-[var(--cc-secondary)]">O ficheiro está no arquivo privado do PCC e ligado ao entregável seleccionado.</p>
        </Card>
      )}
      {(params.error ?? documentsError?.message) && (
        <Card className="mb-6 p-5 text-sm text-[var(--cc-danger)]">{params.error ?? documentsError?.message}</Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-secondary)]">Versões actuais</p><p className="mt-2 text-2xl font-semibold text-[var(--cc-foreground)]">{current.length}</p></Card>
        <Card className="p-5"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-secondary)]">Arquivo total</p><p className="mt-2 text-2xl font-semibold text-[var(--cc-foreground)]">{documents?.length ?? 0}</p></Card>
        <Card className="p-5"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-secondary)]">Armazenamento</p><p className="mt-2 text-lg font-semibold text-[var(--cc-foreground)]">Privado · versionado</p></Card>
      </div>

      <Card className="mt-6 p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck size={20} className="mt-0.5 text-[var(--cc-accent)]" aria-hidden="true" />
          <div>
            <h2 className="font-semibold text-[var(--cc-foreground)]">Regra documental protegida</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">
              Master Mind, Guia Comercial, diagnóstico de release e pacote técnico só devem ser promovidos a versão actual depois da validação operacional correspondente. Cada versão actual deve estar ligada a um entregável do PCC. O download é servido pelo próprio PCC para computador e celular.
            </p>
          </div>
        </div>
      </Card>

      <Card className="mt-6 p-5">
        <h2 className="font-semibold text-[var(--cc-foreground)]">Registar nova versão</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--cc-secondary)]">Use “Rascunho” enquanto a operação não estiver plenamente validada. “Actual” representa a versão oficial liberada.</p>
        <form action="/api/official-documents/upload" method="post" encType="multipart/form-data" className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-[var(--cc-foreground)]">Tipo de documento
            <select className={selectClass} name="document_key" defaultValue="master_mind" required>
              <option value="master_mind">Master Mind</option><option value="commercial_guide">Guia Comercial</option><option value="technical_package">Pacote Técnico PCC / pen drive</option><option value="release_diagnostic">Diagnóstico de Release</option><option value="other">Outro</option>
            </select>
          </label>
          <label className="text-sm font-medium text-[var(--cc-foreground)]">Estado
            <select className={selectClass} name="status" defaultValue="draft" required><option value="draft">Rascunho</option><option value="current">Actual / oficial</option></select>
          </label>
          <label className="text-sm font-medium text-[var(--cc-foreground)]">Título<input className={inputClass} name="title" required maxLength={180} placeholder="Ex.: Master Mind — PCC" /></label>
          <label className="text-sm font-medium text-[var(--cc-foreground)]">Versão<input className={inputClass} name="version_label" required maxLength={80} placeholder="Ex.: Release 2026-10-26" /></label>
          <label className="text-sm font-medium text-[var(--cc-foreground)]">Projecto
            <select className={selectClass} name="project_id" defaultValue=""><option value="">Seleccionar projecto</option>{(projects ?? []).map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select>
          </label>
          <label className="text-sm font-medium text-[var(--cc-foreground)]">Entregável
            <select className={selectClass} name="deliverable_id" defaultValue=""><option value="">Seleccionar entregável</option>{(deliverables ?? []).map((item) => <option key={item.id} value={item.id}>{projectById.get(item.project_id) ?? "Projecto"} · {item.title}</option>)}</select>
          </label>
          <label className="text-sm font-medium text-[var(--cc-foreground)] md:col-span-2">Ficheiro
            <input className={inputClass} type="file" name="file" accept=".pdf,.doc,.docx,.zip,.txt,.json,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/zip,text/plain,application/json" required />
          </label>
          <div className="md:col-span-2"><button className={primaryButtonClass} type="submit">Guardar no arquivo oficial</button></div>
        </form>
      </Card>

      <Card className="mt-6">
        <div className="border-b border-[var(--cc-border)] p-5"><h2 className="inline-flex items-center gap-2 font-semibold text-[var(--cc-foreground)]"><FileArchive size={18} /> Arquivo versionado</h2></div>
        <div className="p-5">
          {!documents?.length ? <EmptyState>Ainda não existem ficheiros no arquivo oficial. As versões técnicas finais serão carregadas apenas depois da validação operacional em pleno.</EmptyState> : (
            <div className="space-y-3">{documents.map((item) => (
              <article key={item.id} className="rounded-[var(--cc-radius-md)] border border-[var(--cc-border)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-[var(--cc-foreground)]">{item.title}</p>
                    <p className="mt-1 text-xs text-[var(--cc-secondary)]">{officialDocumentLabel(item.document_key)} · {String(item.format).toUpperCase()} · {item.version_label} · {item.status === "current" ? "Actual" : item.status === "draft" ? "Rascunho" : "Substituído"}</p>
                    <p className="mt-1 text-xs text-[var(--cc-secondary)]">{item.project_id ? projectById.get(item.project_id) ?? "Projecto" : "Sem projecto"}{item.deliverable_id ? ` · Entregável: ${deliverableById.get(item.deliverable_id) ?? "associado"}` : ""}{item.created_at ? ` · ${formatDateTime(item.created_at)}` : ""}</p>
                    {item.sha256 && <p className="mt-2 break-all text-[11px] text-[var(--cc-tertiary)]">SHA-256: {item.sha256}</p>}
                  </div>
                  <Link className={secondaryButtonClass} href={`/api/official-documents/${item.id}/download`}><Download size={16} className="mr-2" /> Baixar</Link>
                </div>
              </article>
            ))}</div>
          )}
        </div>
      </Card>
    </>
  );
}
