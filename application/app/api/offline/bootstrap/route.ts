import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Sessão necessária." }, { status: 401 });
  }

  const [{ data: projects, error: projectsError }, { data: deliverables, error: deliverablesError }, { data: actions, error: actionsError }] =
    await Promise.all([
      supabase.from("projects").select("id,title,status").eq("user_id", user.id).order("created_at", { ascending: false }).limit(200),
      supabase.from("deliverables").select("id,title,project_id,status").eq("user_id", user.id).order("created_at", { ascending: false }).limit(300),
      supabase.from("actions").select("id,title,project_id,deliverable_id,status,priority,due_at,is_next_action").eq("user_id", user.id).order("created_at", { ascending: false }).limit(500),
    ]);

  const error = projectsError ?? deliverablesError ?? actionsError;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    projects: projects ?? [],
    deliverables: deliverables ?? [],
    actions: actions ?? [],
  });
}
