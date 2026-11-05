import Link from "next/link";

type ClientTask = {
  id: string;
  title: string;
  status: string;
  completion_criterion: string;
  evidence_reference: string | null;
};

const statusLabels: Record<string,string> = {
  awaiting_scope:"A preparar",active:"Em execução",paused:"Suspenso",
  completed:"Concluído",open:"Por iniciar",in_progress:"Em execução",blocked:"Bloqueado",
};

/** Read-only project view shared by the client and the manager's secure preview.
 * No manager commands, private diagnostics or unpublished internal information.
 */
export function Gie360ClientProjectView({
  title,organizationName,status,tasks,workError=false,preview=false,backHref="/gie-client",
}:{
  title:string;organizationName:string|null;status:string;tasks:ClientTask[];
  workError?:boolean;preview?:boolean;backHref?:string;
}) {
  const completed=tasks.filter(task=>task.status==="completed").length;
  const progress=tasks.length?Math.round(100*completed/tasks.length):0;
  return <div className="space-y-5">
    <Link href={backHref} className="text-sm underline">{preview?"Voltar ao painel do gestor":"Meus projectos"}</Link>
    {preview && <p role="status" className="rounded-lg border border-[#d0ded6] bg-[#e6ece7] p-3 text-sm">
      Pré-visualização do acompanhamento do cliente. Não concede acesso ao cliente nem altera o projecto.
    </p>}
    <header className="rounded-2xl border border-[#d0ded6] bg-white p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#557269]">Acompanhamento do projecto</p>
      <h1 className="mt-2 text-2xl font-bold">{title}</h1>
      {organizationName && <p className="mt-1 text-sm text-[#63716c]">{organizationName}</p>}
      <p className="mt-4 text-sm font-semibold">{statusLabels[status]??"Em acompanhamento"}</p>
    </header>
    <section className="rounded-2xl border border-[#d0ded6] bg-white p-5">
      <h2 className="font-semibold">Progresso</h2>
      <p className="mt-2 text-2xl font-bold">{progress}%</p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e6ece7]">
        <div className="h-full rounded-full bg-[#073f36]" style={{width:`${progress}%`}}/>
      </div>
      <p className="mt-2 text-sm text-[#63716c]">{completed} de {tasks.length} tarefas concluídas</p>
      {!tasks.length && <p className="mt-1 text-sm text-[#63716c]">Ainda não existem tarefas registadas.</p>}
    </section>
    <section className="rounded-2xl border border-[#d0ded6] bg-white p-5">
      <h2 className="font-semibold">Actividades e resultados</h2>
      {workError ? <p role="alert" className="mt-3 text-sm">Não foi possível apresentar o acompanhamento.</p>
        : tasks.length ? <div className="mt-4 space-y-3">{tasks.map(task=><article key={task.id} className="rounded-xl border border-[#d0ded6] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">{task.title}</h3>
            <span className="rounded-full bg-[#e6ece7] px-3 py-1 text-xs font-medium">{statusLabels[task.status]??"Em acompanhamento"}</span>
          </div>
          <p className="mt-2 text-sm text-[#63716c]">Resultado esperado: {task.completion_criterion}</p>
          {task.evidence_reference && <p className="mt-2 text-sm">Evidência: {task.evidence_reference}</p>}
        </article>)}</div> : <p className="mt-3 text-sm text-[#63716c]">O acompanhamento será apresentado à medida que as actividades forem registadas.</p>}
    </section>
  </div>;
}
