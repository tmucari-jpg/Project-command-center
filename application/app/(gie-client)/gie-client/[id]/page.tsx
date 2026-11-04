import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const statusLabel: Record<string,string> = {
  awaiting_scope: "A preparar",
  active: "Em execução",
  paused: "Suspenso",
  completed: "Concluído",
  open: "Por iniciar",
  in_progress: "Em execução",
  blocked: "Bloqueado",
};

export default async function GieClientProject({params}: {params: Promise<{id:string}>}) {
  const {id} = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();

  const supabase = await createClient();
  const {data:{user}} = await supabase.auth.getUser();
  if (!user) redirect("/gie-login?next="+encodeURIComponent("/gie-client/"+id));

  const {data: project, error: projectError} = await supabase
    .from("gie360_projects")
    .select("id,organization_id,title,status,created_at")
    .eq("id",id).maybeSingle();
  if (projectError || !project) notFound();

  // A share URL only identifies a project: access always requires a matching
  // authenticated membership and tenant-scoped RLS.
  const {data: membership, error: membershipError} = await supabase
    .from("gie360_memberships")
    .select("organization_id")
    .eq("client_user_id",user.id)
    .eq("organization_id",project.organization_id)
    .maybeSingle();
  if (membershipError || !membership) notFound();

  const {data: organization} = await supabase
    .from("gie360_organizations")
    .select("name").eq("id",project.organization_id).maybeSingle();

  const {data: workItems, error: workError} = await supabase
    .from("gie360_work_items")
    .select("id,title,status,completion_criterion,evidence_reference")
    .eq("organization_id",project.organization_id)
    .eq("project_id",project.id)
    .order("created_at",{ascending:true});

  const tasks=workItems ?? [];
  const completed=tasks.filter(task=>task.status==="completed").length;
  const progress=tasks.length ? Math.round(100*completed/tasks.length) : 0;

  return (
    <div className="space-y-5">
      <Link href="/gie-client" className="text-sm underline">Meus projectos</Link>
      <header className="rounded-2xl border border-[#d0ded6] bg-white p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#557269]">Acompanhamento do projecto</p>
        <h1 className="mt-2 text-2xl font-bold">{project.title}</h1>
        {organization?.name && <p className="mt-1 text-sm text-[#63716c]">{organization.name}</p>}
        <p className="mt-4 text-sm font-semibold">{statusLabel[project.status] ?? "Em acompanhamento"}</p>
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
        : tasks.length ? <div className="mt-4 space-y-3">
          {tasks.map(task=>(
            <article key={task.id} className="rounded-xl border border-[#d0ded6] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">{task.title}</h3>
                <span className="rounded-full bg-[#e6ece7] px-3 py-1 text-xs font-medium">
                  {statusLabel[task.status] ?? "Em acompanhamento"}
                </span>
              </div>
              <p className="mt-2 text-sm text-[#63716c]">Resultado esperado: {task.completion_criterion}</p>
              {task.evidence_reference && <p className="mt-2 text-sm">Evidência: {task.evidence_reference}</p>}
            </article>
          ))}
        </div> : <p className="mt-3 text-sm text-[#63716c]">O acompanhamento será apresentado à medida que as actividades forem registadas.</p>}
      </section>
    </div>
  );
}
