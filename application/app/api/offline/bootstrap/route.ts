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

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    isAdmin,
    projects: projectsResult.data ?? [],
    objectives: objectivesResult.data ?? [],
    deliverables: deliverablesResult.data ?? [],
    actions: actionsResult.data ?? [],
    blockers: blockersResult.data ?? [],
    metrics: metricsResult.data ?? [],
    evidence: evidenceResult.data ?? [],
    ideas: ideasResult.data ?? [],
    factoryCases: factoryCasesResult.data ?? [],
    dependencies: dependenciesResult.data ?? [],
    risks: risksResult.data ?? [],
    decisions: decisionsResult.data ?? [],
    strategyPlans: isAdmin ? strategyPlansResult.data ?? [] : [],
    commercialProfiles: isAdmin ? commercialProfilesResult.data ?? [] : [],
    financialEntries: isAdmin ? financialEntriesResult.data ?? [] : [],
    commercialLeads: isAdmin ? commercialLeadsResult.data ?? [] : [],
  });
}
