import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Sessão necessária." }, { status: 401 });
  }

  const isAdmin = await isAdminUser(supabase, user.id, user.email);

  const [
    projectsResult,
    objectivesResult,
    deliverablesResult,
    actionsResult,
    blockersResult,
    metricsResult,
    evidenceResult,
    ideasResult,
    factoryCasesResult,
    dependenciesResult,
    risksResult,
    decisionsResult,
    strategyPlansResult,
    commercialProfilesResult,
    financialEntriesResult,
    commercialLeadsResult,
  ] = await Promise.all([
    supabase.from("projects").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(250),
    supabase.from("objectives").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(250),
    supabase.from("deliverables").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(500),
    supabase.from("actions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1000),
    supabase.from("blockers").select("*").eq("user_id", user.id).order("identified_at", { ascending: false }).limit(500),
    supabase.from("metrics").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(500),
    supabase.from("evidence").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1000),
    supabase.from("ideas").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(500),
    supabase.from("project_factory_cases").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(250),
    supabase.from("project_governance_dependencies").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(500),
    supabase.from("project_governance_risks").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(500),
    supabase.from("decisions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(500),
    supabase.from("project_strategy_execution_plans").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(250),
    supabase.from("project_commercial_profiles").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(250),
    supabase.from("financial_entries").select("*").eq("user_id", user.id).order("occurred_on", { ascending: false }).limit(1000),
    supabase.from("commercial_leads").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(1000),
  ]);

  const results = [
    projectsResult,
    objectivesResult,
    deliverablesResult,
    actionsResult,
    blockersResult,
    metricsResult,
    evidenceResult,
    ideasResult,
    factoryCasesResult,
    dependenciesResult,
    risksResult,
    decisionsResult,
    strategyPlansResult,
    commercialProfilesResult,
    financialEntriesResult,
    commercialLeadsResult,
  ];
  const failed = results.find((result) => result.error);
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 });

  const allProjects = projectsResult.data ?? [];
  const offlineProjects = allProjects.filter(
    (project) => !["confidential", "restricted"].includes(project.information_classification ?? "internal"),
  );
  const allowedProjectIds = new Set(offlineProjects.map((project) => project.id));
  const blockedProjects = allProjects.filter((project) => !allowedProjectIds.has(project.id));
  const blockedObjectiveIds = new Set(blockedProjects.map((project) => project.objective_id).filter(Boolean));
  const allowedObjectiveIds = new Set(offlineProjects.map((project) => project.objective_id).filter(Boolean));

  const safeProjectRows = <T extends { project_id?: string | null }>(rows: T[] | null) =>
    (rows ?? []).filter((row) => !row.project_id || allowedProjectIds.has(row.project_id));

  const offlineObjectives = (objectivesResult.data ?? []).filter(
    (objective) => !blockedObjectiveIds.has(objective.id) || allowedObjectiveIds.has(objective.id),
  );

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    isAdmin,
    projects: offlineProjects,
    objectives: offlineObjectives,
    deliverables: safeProjectRows(deliverablesResult.data),
    actions: safeProjectRows(actionsResult.data),
    blockers: safeProjectRows(blockersResult.data),
    metrics: safeProjectRows(metricsResult.data),
    evidence: safeProjectRows(evidenceResult.data),
    ideas: safeProjectRows(ideasResult.data),
    factoryCases: safeProjectRows(factoryCasesResult.data),
    dependencies: safeProjectRows(dependenciesResult.data),
    risks: safeProjectRows(risksResult.data),
    decisions: safeProjectRows(decisionsResult.data),
    strategyPlans: isAdmin ? safeProjectRows(strategyPlansResult.data) : [],
    commercialProfiles: isAdmin ? safeProjectRows(commercialProfilesResult.data) : [],
    financialEntries: isAdmin ? safeProjectRows(financialEntriesResult.data) : [],
    commercialLeads: isAdmin ? safeProjectRows(commercialLeadsResult.data) : [],
  });
}
