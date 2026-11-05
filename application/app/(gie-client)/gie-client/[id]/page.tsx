import { notFound, redirect } from "next/navigation";
import { Gie360ClientProjectView } from "@/components/gie360-client-project-view";
import { createClient } from "@/lib/supabase/server";

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

  return <Gie360ClientProjectView
    title={project.title}
    organizationName={organization?.name??null}
    status={project.status}
    tasks={workItems??[]}
    workError={Boolean(workError)}
  />;
}
