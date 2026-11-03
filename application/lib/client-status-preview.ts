import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
export async function buildClientStatusPreview(db: SupabaseClient, ownerId: string, projectId: string, publicNote: string) {
 const [p,d,m]=await Promise.all([
 db.from("projects").select("id,title,status,expected_result,next_action").eq("id",projectId).eq("user_id",ownerId).maybeSingle(),
 db.from("deliverables").select("id,title,status,due_date,completion_criteria,artifact_url,artifact_reference,artifact_version,acceptance_status,accepted_at").eq("project_id",projectId).eq("user_id",ownerId).neq("status","cancelled").order("due_date",{ascending:true,nullsFirst:false}),
 db.from("metrics").select("id,name,unit,current_value,target_value,measurement_date").eq("project_id",projectId).eq("user_id",ownerId).order("measurement_date",{ascending:false,nullsFirst:false}),
 ]);
 if(p.error||!p.data||d.error||m.error)throw new Error("PREVIEW_UNAVAILABLE");
 const deliverables=(d.data??[]).map(x=>({id:x.id,title:x.title,status:x.status,due_date:x.due_date,completion_criteria:x.completion_criteria,acceptance_status:x.acceptance_status,accepted_at:x.accepted_at,artifact_version:x.artifact_version,artifact_url:["accepted","accepted_with_reservations"].includes(x.acceptance_status??"")?x.artifact_url:null,artifact_reference:["accepted","accepted_with_reservations"].includes(x.acceptance_status??"")?x.artifact_reference:null}));
 const byName=new Map<string,(typeof m.data extends Array<infer T> ? T : never)>();
 for(const item of m.data??[])if(!byName.has(item.name))byName.set(item.name,item);
 const kpis=Array.from(byName.values()).map(x=>({name:x.name,unit:x.unit,current_value:x.current_value,target_value:x.target_value,measurement_date:x.measurement_date}));
 return {project:p.data,deliverables,kpis,public_note:publicNote||null};
}
export function clientStatusFingerprint(value:Awaited<ReturnType<typeof buildClientStatusPreview>>) {
 return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
