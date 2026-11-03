"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";

/**
 * Create a diagnostic intake case linked to an existing PCC project.
 * This does not create a new project, alter governance approvals or send a client link.
 */
export async function openExistingProjectDiagnostic(formData: FormData) {
  const parsed = z.string().uuid().safeParse(formData.get("project_id"));
  if (!parsed.success) redirect("/projects");
  const { supabase, user } = await requireUser();
  const { data: project, error: projectError } = await supabase.from("projects")
    .select("id,title,description,expected_result,priority")
    .eq("id", parsed.data).eq("user_id", user.id).maybeSingle();
  if (projectError || !project) redirect("/projects");

  const { data: linked, error: linkedError } = await supabase.from("project_factory_cases")
    .select("id").eq("project_id", project.id).eq("user_id", user.id).limit(1).maybeSingle();
  if (linkedError) redirect(`/projects/${project.id}?diagnostic_error=lookup`);
  if (linked) redirect(`/project-factory/${linked.id}`);

  // A factory case is a diagnostic record only. The existing project is reused.
  const { data: created, error: createError } = await supabase.from("project_factory_cases").insert({
    user_id: user.id,
    project_id: project.id,
    title: project.title,
    description: project.description || null,
    problem: project.description?.trim() || project.expected_result?.trim() || "Diagnosticar necessidades do projecto existente.",
    project_type: "non_commercial",
    expected_value: project.expected_result || null,
    source: "existing_project_diagnostic",
    stage: "converted_to_project",
  }).select("id").single();
  if (createError || !created) redirect(`/projects/${project.id}?diagnostic_error=create`);
  redirect(`/project-factory/${created.id}`);
}
