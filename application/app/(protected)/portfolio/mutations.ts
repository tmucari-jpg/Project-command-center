"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { portfolio } from "@/lib/project-portfolio";

function fail(message: string): never {
  redirect(`/portfolio?error=${encodeURIComponent(message)}`);
}

export async function importPortfolio() {
  const { supabase, user } = await requireUser();
  const { data: existing, error: projectsError } = await supabase.from("projects")
    .select("id,title").eq("user_id", user.id).limit(500);
  if (projectsError || !existing) fail("Não foi possível consultar os projectos existentes.");
  if (existing.length === 500) fail("Há demasiados projectos para uma importação segura.");

  const lookup = new Map(existing.map((item) => [item.title.trim().toLocaleLowerCase("pt-PT"), item.id]));
  let projectCount = 0;
  let actionCount = 0;

  for (const plan of portfolio) {
    const names = [plan.name, ...(plan.aliases ?? [])].map((name) => name.toLocaleLowerCase("pt-PT"));
    let projectId = names.map((name) => lookup.get(name)).find(Boolean);
    if (!projectId) {
      const { data, error } = await supabase.from("projects").insert({
        user_id: user.id, title: plan.name, description: plan.description,
        expected_result: plan.validation, status: "planning", priority: "medium", progress: 0,
        next_action: plan.actions[0]?.title,
        notes: `Plano inicial de monetização: ${plan.revenue}`,
      }).select("id").single();
      if (error || !data) fail(`Não foi possível criar «${plan.name}». Pode repetir a importação sem duplicar os anteriores.`);
      projectId = data.id;
      projectCount++;
    }

    const { data: actions, error: actionsError } = await supabase.from("actions")
      .select("title").eq("user_id", user.id).eq("project_id", projectId).limit(500);
    if (actionsError || !actions || actions.length === 500) fail(`Não foi possível conferir as acções de «${plan.name}».`);
    const titles = new Set(actions.map((item) => item.title.trim().toLocaleLowerCase("pt-PT")));
    const missing = plan.actions.filter((item) => !titles.has(item.title.toLocaleLowerCase("pt-PT")));
    if (missing.length) {
      const { error } = await supabase.from("actions").insert(missing.map((item) => ({
        user_id: user.id, project_id: projectId, title: item.title,
        priority: item.priority ?? "medium", status: "pending", completion_criteria: item.evidence,
      })));
      if (error) fail(`Não foi possível acrescentar as acções de «${plan.name}». Pode repetir sem duplicar as anteriores.`);
      actionCount += missing.length;
    }
  }

  // Projects created outside this starter catalogue still receive a first
  // monetisation decision and remain visible in the live portfolio overview.
  const covered = new Set(portfolio.flatMap((plan) => [plan.name, ...(plan.aliases ?? [])].map((name) => name.toLocaleLowerCase("pt-PT"))));
  for (const project of existing.filter((item) => !covered.has(item.title.trim().toLocaleLowerCase("pt-PT")))) {
    const title = "Definir cliente, oferta e modelo de receita";
    const { data, error } = await supabase.from("actions").select("id")
      .eq("user_id", user.id).eq("project_id", project.id).eq("title", title).limit(1);
    if (error || !data) fail(`Não foi possível verificar o plano de «${project.title}».`);
    if (!data.length) {
      const { error: insertError } = await supabase.from("actions").insert({
        user_id: user.id, project_id: project.id, title, status: "pending", priority: "medium",
        completion_criteria: "Uma página com cliente, problema, oferta, canal, preço a testar, custos e primeiro sinal de compra",
      });
      if (insertError) fail(`Não foi possível acrescentar o plano de «${project.title}».`);
      actionCount++;
    }
  }
  revalidatePath("/portfolio");
  revalidatePath("/projects");
  revalidatePath("/actions");
  revalidatePath("/dashboard");
  redirect(`/portfolio?imported=${projectCount}&actions=${actionCount}`);
}
