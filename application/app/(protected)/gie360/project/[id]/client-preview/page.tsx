import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { Gie360ClientProjectView } from "@/components/gie360-client-project-view";

export default async function ManagerClientPreview({params}: {params:Promise<{id:string}>}) {
  const {id}=await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const {supabase,user}=await requireUser();
  // The management account is authorized solely through project ownership;
  // this preview never impersonates a client or adds tenant membership.
  const {data:project,error:projectError}=await supabase.from("gie360_projects")
    .select("id,title,status,organization_id")
    .eq("id",id).eq("manager_user_id",user.id).maybeSingle();
  if (projectError || !project) notFound();
  const [{data:organization,error:orgError},{data:tasks,error:workError}]=await Promise.all([
    supabase.from("gie360_organizations")
      .select("name").eq("id",project.organization_id).eq("manager_user_id",user.id).maybeSingle(),
    supabase.from("gie360_work_items")
      .select("id,title,status,completion_criterion,evidence_reference")
      .eq("project_id",id).eq("organization_id",project.organization_id)
      .eq("manager_user_id",user.id).order("created_at",{ascending:true}),
  ]);
  if (orgError || !organization) notFound();
  return <main className="mx-auto max-w-4xl p-4 sm:p-8">
    <Gie360ClientProjectView title={project.title} organizationName={organization.name}
      status={project.status} tasks={tasks??[]} workError={Boolean(workError)}
      preview backHref={`/gie360/project/${id}`}/>
  </main>;
}
