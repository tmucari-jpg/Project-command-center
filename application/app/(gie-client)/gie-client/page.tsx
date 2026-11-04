import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const statusLabels:Record<string,string>={
  awaiting_scope:"A preparar",
  active:"Em execução",
  paused:"Suspenso",
  completed:"Concluído",
};

export default async function GieClientHome() {
  const supabase = await createClient();
  const {data:{user}} = await supabase.auth.getUser();
  if (!user) redirect("/gie-login");

  const {data: memberships,error:membershipError} = await supabase
    .from("gie360_memberships").select("organization_id").eq("client_user_id",user.id);
  if (membershipError) return <p role="alert">Não foi possível verificar os seus projectos.</p>;

  const organizationIds=(memberships ?? []).map(item=>item.organization_id);
  if (!organizationIds.length) return <p>Não existem projectos disponíveis para esta conta.</p>;

  const {data:projects,error:projectsError}=await supabase
    .from("gie360_projects")
    .select("id,title,status,created_at")
    .in("organization_id",organizationIds)
    .order("created_at",{ascending:false});
  if (projectsError) return <p role="alert">Não foi possível carregar os seus projectos.</p>;

  return <div className="space-y-5">
    <div>
      <h1 className="text-2xl font-bold">Os meus projectos</h1>
      <p className="mt-1 text-sm text-[#63716c]">Acompanhe o estado e as actividades dos seus projectos.</p>
    </div>
    {(projects ?? []).length ? (projects ?? []).map(project=>(
      <section key={project.id} className="rounded-2xl border border-[#d0ded6] bg-white p-5">
        <h2 className="text-lg font-bold">{project.title}</h2>
        <p className="mt-2 text-sm text-[#63716c]">{statusLabels[project.status] ?? "Em acompanhamento"}</p>
        <Link className="mt-4 inline-flex rounded-lg bg-[#073f36] px-4 py-2 text-sm font-semibold text-white"
          href={`/gie-client/${project.id}`}>Acompanhar projecto</Link>
      </section>
    )) : <p className="rounded-xl border border-[#d0ded6] bg-white p-5 text-sm">Ainda não existem projectos disponíveis para acompanhamento.</p>}
  </div>;
}
