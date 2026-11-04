import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Card, primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { Gie360ShareAccess } from "@/components/gie360-share-access";
import { activateGie360Project, createGie360WorkItem, progressGie360WorkItem } from "../../actions";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const statusLabels: Record<string,string> = {
  awaiting_scope:"Aguarda aprovação do âmbito",active:"Em execução",
  paused:"Em pausa",completed:"Concluído",open:"Por iniciar",
  in_progress:"Em curso",blocked:"Bloqueado",
};
const diagnosticLabels: Record<string,string> = {
  context:"Situação inicial",focus:"Foco principal",desired_result:"Resultado pretendido",
  conditions:"Condições",deadline_urgency:"Prioridade e prazo",success_criteria:"Critérios de sucesso",
};

export default async function GieProjectPage({
  params,searchParams,
}:{
  params:Promise<{id:string}>;
  searchParams:Promise<{error?:string;project?:string;work?:string;handoff?:string;scope?:string}>;
}) {
  const {id}=await params;
  const notices=await searchParams;
  if (!uuid.test(id)) notFound();
  const {supabase,user}=await requireUser();

  const {data:project,error:projectError}=await supabase.from("gie360_projects")
    .select("id,organization_id,factory_case_id,title,status,diagnostic_summary")
    .eq("id",id).eq("manager_user_id",user.id).maybeSingle();
  if (projectError || !project) notFound();
  const [{data:organization,error:organizationError},{data:work,error:workError}]=await Promise.all([
    supabase.from("gie360_organizations")
      .select("id,name,contract_approved,approved_modules")
      .eq("id",project.organization_id).eq("manager_user_id",user.id).maybeSingle(),
    supabase.from("gie360_work_items")
      .select("id,title,status,module_code,completion_criterion,evidence_reference")
      .eq("project_id",id).eq("organization_id",project.organization_id)
      .order("created_at",{ascending:true}),
  ]);
  if (organizationError || !organization) notFound();

  const ready=Boolean(organization.contract_approved && organization.approved_modules?.length);
  const started=project.status==="active";
  const tasks=work??[];
  const done=tasks.filter(item=>item.status==="completed").length;
  const percent=tasks.length ? Math.round(done*100/tasks.length) : 0;
  const context=project.diagnostic_summary ?? {};

  return <>
    <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm text-[var(--cc-secondary)]" aria-label="Percurso GIE360°">
      <Link className="underline" href="/gie360">GIE360°</Link>
      <span aria-hidden="true">/</span>
      <Link className="underline" href={`/gie360/${organization.id}`}>{organization.name}</Link>
      <span aria-hidden="true">/</span>
      <span className="font-semibold text-[var(--cc-foreground)]">{project.title}</span>
    </nav>
    <PageHeader eyebrow="GIE360° · Projecto empresarial" title={project.title}/>
    <Card className="mt-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Onde está este projecto?</h2>
          <p className="mt-1 text-sm text-[var(--cc-secondary)]">{statusLabels[project.status]??project.status}</p>
        </div>
        <span className="rounded-full border border-[var(--cc-border)] px-3 py-1 text-xs font-semibold">
          {started ? "Execução GIE360°" : ready ? "Pronto para activação" : "Preparação do âmbito"}
        </span>
      </div>
      <ol className="mt-5 grid gap-2 text-sm sm:grid-cols-4">
        <li className="rounded-lg border border-[var(--cc-border)] p-3"><strong>1. Diagnóstico</strong><p className="mt-1 text-[var(--cc-secondary)]">Recebido e encaminhado pelo PCC</p></li>
        <li className="rounded-lg border border-[var(--cc-border)] p-3"><strong>2. Âmbito</strong><p className="mt-1 text-[var(--cc-secondary)]">{ready?"Contrato e módulos aprovados":"Pendente de aprovação"}</p></li>
        <li className="rounded-lg border border-[var(--cc-border)] p-3"><strong>3. Execução</strong><p className="mt-1 text-[var(--cc-secondary)]">{started?"Em curso":project.status==="completed"?"Concluída":"Não iniciada"}</p></li>
        <li className="rounded-lg border border-[var(--cc-border)] p-3"><strong>4. Cliente</strong><p className="mt-1 text-[var(--cc-secondary)]">Acompanhamento por link próprio</p></li>
      </ol>
      {notices.error && <p role="alert" className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{notices.error}</p>}
      {notices.scope==="approved" && <p role="status" className="mt-4 text-sm">Âmbito aprovado. Confirme agora a activação da execução, se estiver autorizada.</p>}
      {notices.project==="activated" && <p role="status" className="mt-4 text-sm">Execução activada. Pode registar as actividades do projecto abaixo.</p>}
      {notices.work && <p role="status" className="mt-4 text-sm">{notices.work==="created"?"Tarefa registada no projecto.":"Evolução da tarefa guardada."}</p>}
      {!ready && project.status==="awaiting_scope" && <>
        <p className="mt-4 text-sm"><strong>Próximo passo:</strong> confirmar o contrato e os módulos deste projecto. Só depois poderá activar a execução.</p>
        <Link className={primaryButtonClass+" mt-3 inline-flex"} href={`/gie360/${organization.id}?project=${project.id}`}>Aprovar âmbito na organização</Link>
      </>}
      {ready && project.status==="awaiting_scope" && <form className="mt-4 space-y-3" action={activateGie360Project}>
        <input type="hidden" name="project_id" value={project.id}/>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" required name="explicitly_approved"/>
          Confirmo que a execução deste projecto está abrangida pelo contrato e pelos módulos aprovados.
        </label>
        <button type="submit" className={primaryButtonClass}>Activar execução deste projecto</button>
      </form>}
    </Card>

    <Card className="mt-5 p-5 sm:p-6">
      <h2 className="text-lg font-semibold">Informação inicial do projecto</h2>
      <p className="mt-2 text-sm text-[var(--cc-secondary)]">Dados declarados no diagnóstico aprovado; não são resultados auditados.</p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        {Object.entries(diagnosticLabels).map(([key,label])=><div key={key}>
          <dt className="text-sm font-semibold">{label}</dt>
          <dd className="mt-1 whitespace-pre-wrap text-sm text-[var(--cc-secondary)]">{typeof context[key]==="string" && context[key].trim()?context[key]:"Não informado"}</dd>
        </div>)}
      </dl>
    </Card>

    <Card className="mt-5 p-5 sm:p-6">
      <h2 className="text-lg font-semibold">Execução e resultados</h2>
      <p className="mt-2 text-sm text-[var(--cc-secondary)]">Registe apenas trabalho dos módulos aprovados no GIE360°, com critério de conclusão e evidência.</p>
      {workError && <p role="alert" className="mt-3 text-sm text-red-700">Não foi possível carregar as tarefas. Não considere o progresso confirmado.</p>}
      {!workError && <p className="mt-3 text-sm">{done} de {tasks.length} tarefas concluídas · {percent}%</p>}
      {!workError && <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--cc-border)]">
        <div className="h-full bg-[#073f36]" style={{width:`${percent}%`}}/>
      </div>}
      {!workError && tasks.length===0 && <p className="mt-3 text-sm text-[var(--cc-secondary)]">Ainda não existem tarefas registadas.</p>}
      {!workError && <div className="mt-4 space-y-3">{tasks.map(item=><article key={item.id} className="rounded-lg border border-[var(--cc-border)] p-4">
        <div className="flex flex-wrap justify-between gap-2"><strong>{item.title}</strong><span className="text-sm">{statusLabels[item.status]??item.status}</span></div>
        <p className="mt-1 text-sm text-[var(--cc-secondary)]">Módulo: {item.module_code}</p>
        <p className="mt-1 text-sm">Resultado verificável: {item.completion_criterion}</p>
        {item.evidence_reference && <p className="mt-2 text-sm">Evidência: {item.evidence_reference}</p>}
        {started && item.status!=="completed" && <form className="mt-3 space-y-3" action={progressGie360WorkItem}>
          <input type="hidden" name="work_item_id" value={item.id}/>
          <label className="block text-sm font-medium">Actualizar estado
            <select name="status" defaultValue={item.status==="blocked"?"blocked":"in_progress"} className="mt-1 block w-full rounded-lg border border-[var(--cc-border)] p-2">
              <option value="in_progress">Em curso</option>
              <option value="blocked">Bloqueado</option>
              <option value="completed">Concluído com evidência</option>
            </select>
          </label>
          <label className="block text-sm font-medium">Referência de evidência (obrigatória quando concluído)
            <input name="evidence_reference" maxLength={1000} className="mt-1 block w-full rounded-lg border border-[var(--cc-border)] p-2"/>
          </label>
          <button className={secondaryButtonClass} type="submit">Guardar evolução</button>
        </form>}
      </article>)}</div>}
      {started && <form className="mt-5 space-y-3 rounded-xl border border-[var(--cc-border)] p-4" action={createGie360WorkItem}>
        <h3 className="font-semibold">Adicionar actividade ao projecto</h3>
        <input type="hidden" name="project_id" value={project.id}/>
        <label className="block text-sm">Módulo aprovado
          <select name="module_code" defaultValue="" required className="mt-1 block w-full rounded-lg border border-[var(--cc-border)] p-2">
            <option value="" disabled>Seleccione o módulo</option>
            {(organization.approved_modules??[]).map((code:string)=><option key={code} value={code}>{code}</option>)}
          </select>
        </label>
        <label className="block text-sm">Actividade
          <input name="title" minLength={5} maxLength={240} required className="mt-1 block w-full rounded-lg border border-[var(--cc-border)] p-2"/>
        </label>
        <label className="block text-sm">Critério de conclusão
          <textarea name="completion_criterion" minLength={5} maxLength={1000} required className="mt-1 block w-full rounded-lg border border-[var(--cc-border)] p-2"/>
        </label>
        <button className={primaryButtonClass} type="submit">Criar actividade neste projecto</button>
      </form>}
    </Card>

    {project.status!=="awaiting_scope" ? <div className="mt-5"><Gie360ShareAccess projectId={project.id}/></div> : <Card className="mt-5 p-5"><h2 className="font-semibold">Acompanhamento do cliente</h2><p className="mt-2 text-sm text-[var(--cc-secondary)]">O link de acompanhamento fica disponível após a activação autorizada do projecto.</p></Card>}
    <div className="mt-5 flex flex-wrap gap-3">
      <Link className={secondaryButtonClass} href={`/gie360/${organization.id}?project=${project.id}`}>Ver organização e contrato</Link>
      <Link className={secondaryButtonClass} href="/gie360">Ver lista de projectos GIE360°</Link>
    </div>
  </>;
}
