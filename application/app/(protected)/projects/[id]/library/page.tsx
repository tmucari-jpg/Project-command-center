import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, EmptyState, secondaryButtonClass } from "@/components/ui";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { updateProjectDeliverableDocumentLink } from "./actions";

export default async function ProjectDocumentLibrary({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { id } = await params;
  const notices = await searchParams;
  const { supabase, user } = await requireUser();
  const { data: project, error: projectError } = await supabase
    .from("projects").select("id,title").eq("id",id).eq("user_id",user.id).maybeSingle();
  if (projectError || !project) notFound();

  const { data: deliverables, error } = await supabase
    .from("deliverables")
    .select("id,title,artifact_type,artifact_url,working_edit_url,artifact_reference,artifact_version,status,acceptance_status,completion_criteria")
    .eq("user_id",user.id).eq("project_id",project.id).order("created_at",{ascending:true});

  const withLinks = (deliverables ?? []).filter(item => Boolean(item.artifact_url || item.working_edit_url));
  return <>
    <nav className="mb-4 text-sm text-[var(--cc-secondary)]">
      <Link className="underline" href={`/projects/${project.id}`}>{project.title}</Link>
      <span className="mx-2">/</span>Biblioteca documental
    </nav>
    <PageHeader eyebrow="Documentos do projecto" title="Biblioteca documental"/>
    <Card className="mt-5 p-5">
      <h2 className="text-lg font-semibold">Documentos ligados aos entregáveis</h2>
      <p className="mt-2 text-sm text-[var(--cc-secondary)]">
        Cada link pertence a um entregável deste projecto. Os documentos de trabalho podem
        ficar no serviço de origem, onde o gestor os edita. O PCC guarda apenas a referência,
        sem duplicar o ficheiro. O link privado de edição nunca é publicado ao cliente; só o link de entrega autorizado pode ser partilhado.
      </p>
      <p className="mt-3 text-sm">{withLinks.length} de {(deliverables??[]).length} entregáveis com link associado.</p>
      {notices.saved && <p role="status" className="mt-3 text-sm">Referência do entregável actualizada.</p>}
      {notices.error && <p role="alert" className="mt-3 text-sm text-[var(--cc-danger)]">{notices.error}</p>}
      {error && <p role="alert" className="mt-3 text-sm text-[var(--cc-danger)]">Não foi possível consultar os entregáveis deste projecto.</p>}
    </Card>
    {!error && !(deliverables??[]).length && <div className="mt-5"><EmptyState>A biblioteca fica disponível quando existir um entregável registado no projecto.</EmptyState></div>}
    {!error && <div className="mt-5 space-y-4">{(deliverables??[]).map(item => {
      const locked = item.status==="completed" || ["accepted","accepted_with_reservations"].includes(item.acceptance_status ?? "");
      return <Card key={item.id} className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">{item.title}</h2>
            <p className="mt-1 text-sm text-[var(--cc-secondary)]">{item.artifact_type ?? "Documento"} · {item.artifact_version ? `Versão ${item.artifact_version}` : "Sem versão registada"} · {locked ? "Versão protegida" : "Em preparação"}</p>
          </div>
          {item.working_edit_url && <a className={secondaryButtonClass} href={item.working_edit_url} target="_blank" rel="noopener noreferrer">Editar documento (gestor)</a>}
          {item.artifact_url && <a className={secondaryButtonClass} href={item.artifact_url} target="_blank" rel="noopener noreferrer">Abrir link de entrega</a>}
        </div>
        <p className="mt-3 text-sm text-[var(--cc-secondary)]">Referência: {item.artifact_reference || "Não registada"}</p>
        {!item.working_edit_url && !item.artifact_url && <p className="mt-2 text-sm text-[var(--cc-secondary)]">Ainda não existe link de documento associado a este entregável.</p>}
        {!locked ? <details className="mt-4 border-t border-[var(--cc-border)] pt-3">
          <summary className="cursor-pointer text-sm font-semibold">Associar ou actualizar link privado de edição</summary>
          <form action={updateProjectDeliverableDocumentLink} className="mt-3 space-y-3">
            <input type="hidden" name="project_id" value={project.id}/>
            <input type="hidden" name="deliverable_id" value={item.id}/>
            <label className="block text-sm font-medium">Link privado HTTPS para edição pelo gestor
              <input type="url" name="working_edit_url" required maxLength={2048} defaultValue={item.working_edit_url ?? ""} placeholder="https://..." className="mt-1 block w-full rounded-lg border border-[var(--cc-border)] p-2"/>
            </label>
            <label className="block text-sm font-medium">Referência / versão do documento
              <input name="artifact_reference" maxLength={240} defaultValue={item.artifact_reference ?? ""} className="mt-1 block w-full rounded-lg border border-[var(--cc-border)] p-2"/>
            </label>
            <button type="submit" className={secondaryButtonClass}>Guardar ligação neste entregável</button>
          </form>
        </details> : <p className="mt-3 text-xs text-[var(--cc-secondary)]">Entregável aprovado ou concluído: o link está protegido. Novas versões seguem o processo de revisão existente.</p>}
      </Card>;
    })}</div>}
    <div className="mt-5 flex flex-wrap gap-3">
      <Link href={`/projects/${project.id}`} className={secondaryButtonClass}>Regressar ao projecto</Link>
      <Link href={`/deliverables?project_id=${project.id}`} className={secondaryButtonClass}>Ver aceitação e evidências</Link>
    </div>
  </>;
}
