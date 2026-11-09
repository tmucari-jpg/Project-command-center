"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";

const schema = z.object({
  case_id: z.string().uuid(),
  organization_name: z.string().trim().min(2).max(200),
  client_email: z.string().trim().email().max(320),
});

export async function createGie360Assessment(formData: FormData) {
  const parsed = schema.safeParse({
    case_id: formData.get("case_id"),
    organization_name: formData.get("organization_name"),
    client_email: formData.get("client_email"),
  });
  const back = "/gie360";
  if (!parsed.success) {
    redirect(back + "?error=" + encodeURIComponent("Preencha o nome da organização e o email de uma conta de cliente existente."));
  }

  const { supabase, user } = await requireUser();
  const { case_id, organization_name, client_email } = parsed.data;

  const [{ data: factoryCase, error: caseError }, { data: existing, error: existingError }, { data: requests, error: requestError }] = await Promise.all([
    supabase.from("project_factory_cases").select("id").eq("id", case_id).eq("user_id", user.id).maybeSingle(),
    supabase.from("gie360_assessments").select("organization_id").eq("factory_case_id", case_id).limit(1),
    supabase.from("client_diagnostic_requests").select("id,status,submitted_at,questionnaire_version").eq("factory_case_id", case_id).eq("user_id", user.id).in("questionnaire_version", ["executive-v3", "executive-v3-gie360"]).order("created_at", { ascending: false }),
  ]);

  if (caseError || !factoryCase || existingError || requestError) {
    redirect(back + "?error=" + encodeURIComponent("Não foi possível verificar a associação deste caso PCC."));
  }
  // The original PCC decision is authoritative. A reviewed request can also
  // have "clarification_needed" or a subsequently rejected scope: check the
  // actual recorded approval, not just its generic status.
  const candidates = (requests ?? []).filter((request) =>
    request.submitted_at && ["reviewed", "incorporated"].includes(request.status),
  );
  const { data: reviews, error: reviewError } = await supabase
    .from("client_diagnostic_reviews")
    .select("request_id,review_status")
    .eq("user_id", user.id)
    .in("request_id", candidates.length ? candidates.map((request) => request.id) : ["00000000-0000-0000-0000-000000000000"]);
  if (reviewError || !reviews?.some((review) =>
    ["accepted", "partially_accepted"].includes(review.review_status)
  )) {
    redirect(back + "?error=" + encodeURIComponent("O encaminhamento exige decisão de aceitação total ou parcial registada no diagnóstico PCC."));
  }

  // Reuse a provisioned organization if the previous attempt created the
  // assessment but could not yet complete the handoff. No duplicate case.
  let organizationId: string | null = existing?.[0]?.organization_id ?? null;
  if (!organizationId) {
    const provision = await supabase.rpc("gie360_provision", {
      p_case_id: case_id,
      p_client_email: client_email,
      p_name: organization_name,
      p_profile: {},
    });
    if (provision.error || !provision.data) {
      redirect(back + "?error=" + encodeURIComponent("Não foi possível activar o GIE360°. Confirme que o cliente tem uma conta própria validada, distinta da conta gestora PCC."));
    }
    organizationId = String(provision.data);
  }

  // A distinct GIE project owns execution. Its source case remains PCC audit
  // history only, and the transaction is idempotent for this factory case.
  const { data: gieProjectId, error: transferError } = await supabase.rpc(
    "gie360_transfer_approved_case",
    { p_case_id: case_id, p_organization_id: organizationId },
  );
  if (transferError || !gieProjectId) {
    redirect(back + "?error=" + encodeURIComponent("A avaliação existe, mas o encaminhamento ainda não foi concluído. Volte a tentar sem criar outro diagnóstico."));
  }
  redirect(`/gie360/project/${gieProjectId}?handoff=created`);
}


const scopeSchema = z.object({
  organization_id: z.string().uuid(),
  package_code: z.string().trim().min(3).max(100),
  contract_reference: z.string().trim().min(3).max(500),
  approved_modules: z.array(z.string().trim().min(1).max(80)).min(1).max(30),
  ai_cloud_authorized: z.boolean(),
  explicitly_approved: z.literal(true),
});

export async function configureGie360Scope(formData: FormData) {
  const parsed = scopeSchema.safeParse({
    organization_id: formData.get("organization_id"),
    package_code: formData.get("package_code"),
    contract_reference: formData.get("contract_reference"),
    approved_modules: formData.getAll("approved_modules"),
    ai_cloud_authorized: formData.get("ai_cloud_authorized") === "on",
    explicitly_approved: formData.get("explicitly_approved") === "on",
  });
  if (!parsed.success) redirect("/gie360?error=" + encodeURIComponent("Defina o contrato e confirme expressamente os módulos autorizados."));
  const { supabase, user } = await requireUser();
  const { organization_id, package_code, contract_reference, approved_modules, ai_cloud_authorized } = parsed.data;
  const back = "/gie360/" + organization_id;
  const { data: organization } = await supabase.from("gie360_organizations")
    .select("id").eq("id", organization_id).eq("manager_user_id", user.id).maybeSingle();
  if (!organization) redirect("/gie360?error=" + encodeURIComponent("Organização não autorizada."));
  const { data, error } = await supabase.rpc("gie360_configure_organization", {
    p_organization_id: organization_id,
    p_package_code: package_code,
    p_approved_modules: approved_modules,
    p_ai_cloud_authorized: ai_cloud_authorized,
    p_contract_reference: contract_reference,
  });
  if (error || !data) redirect(back + "?error=" + encodeURIComponent("O âmbito não foi aprovado. Confirme contrato, pacote e módulos permitidos."));
  const returnId = z.string().uuid().safeParse(formData.get("return_project_id"));
  if (returnId.success) {
    const { data: linkedProject } = await supabase.from("gie360_projects")
      .select("id").eq("id", returnId.data)
      .eq("organization_id", organization_id)
      .eq("manager_user_id", user.id).maybeSingle();
    if (linkedProject) redirect("/gie360/project/" + linkedProject.id + "?scope=approved");
  }
  redirect(back + "?scope=approved");
}


export async function activateGie360Project(formData: FormData) {
  const projectId = z.string().uuid().safeParse(formData.get("project_id"));
  const explicitlyApproved = formData.get("explicitly_approved") === "on";
  if (!projectId.success || !explicitlyApproved) {
    const destination = projectId.success ? "/gie360/project/" + projectId.data : "/gie360";
    redirect(destination + "?error=" + encodeURIComponent("É necessária uma aprovação explícita para activar a execução GIE360°."));
  }
  const { supabase, user } = await requireUser();
  const { data: project, error: projectError } = await supabase
    .from("gie360_projects")
    .select("id,organization_id,manager_user_id")
    .eq("id", projectId.data)
    .eq("manager_user_id", user.id)
    .maybeSingle();
  if (projectError || !project) redirect("/gie360?error=" + encodeURIComponent("Projecto GIE360° não autorizado."));
  const back = "/gie360/project/" + project.id;
  const { data, error } = await supabase.rpc("gie360_activate_project", {
    p_project_id: project.id,
  });
  if (error || !data) {
    redirect(back + "?error=" + encodeURIComponent("A execução não foi activada: confirme contrato e âmbito aprovados."));
  }
  redirect("/gie360/project/" + project.id + "?project=activated");
}


export async function createGie360WorkItem(formData: FormData) {
  const parsed = z.object({
    project_id: z.string().uuid(),
    module_code: z.string().trim().min(1).max(80),
    title: z.string().trim().min(5).max(240),
    completion_criterion: z.string().trim().min(5).max(1000),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const id = z.string().uuid().safeParse(formData.get("project_id"));
    redirect((id.success ? "/gie360/project/" + id.data : "/gie360") + "?error=" + encodeURIComponent("Defina módulo, tarefa e critério de conclusão."));
  }
  const { supabase, user } = await requireUser();
  const { data: project } = await supabase.from("gie360_projects")
    .select("organization_id").eq("id", parsed.data.project_id)
    .eq("manager_user_id", user.id).maybeSingle();
  if (!project) redirect("/gie360?error=" + encodeURIComponent("Projecto não autorizado."));
  const back = "/gie360/project/" + parsed.data.project_id;
  const { data, error } = await supabase.rpc("gie360_create_work_item", {
    p_project_id: parsed.data.project_id,
    p_module: parsed.data.module_code,
    p_title: parsed.data.title,
    p_completion_criterion: parsed.data.completion_criterion,
  });
  if (error || !data) redirect(back + "?error=" + encodeURIComponent("Módulo ou projecto ainda não autorizado para execução."));
  redirect("/gie360/project/" + parsed.data.project_id + "?work=created");
}

export async function progressGie360WorkItem(formData: FormData) {
  const parsed = z.object({
    work_item_id: z.string().uuid(),
    status: z.enum(["in_progress", "blocked", "completed"]),
    evidence_reference: z.string().trim().max(1000),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success || (parsed.data.status === "completed" && parsed.data.evidence_reference.length < 5)) {
    const id = z.string().uuid().safeParse(formData.get("project_id"));
    redirect((id.success ? "/gie360/project/" + id.data : "/gie360") + "?error=" + encodeURIComponent("Para concluir uma tarefa, indique a referência da evidência."));
  }
  const { supabase, user } = await requireUser();
  const { data: item } = await supabase.from("gie360_work_items")
    .select("organization_id,project_id").eq("id", parsed.data.work_item_id)
    .eq("manager_user_id", user.id).maybeSingle();
  if (!item) redirect("/gie360?error=" + encodeURIComponent("Tarefa não autorizada."));
  const back = "/gie360/project/" + item.project_id;
  const { data, error } = await supabase.rpc("gie360_progress_work_item", {
    p_work_item_id: parsed.data.work_item_id,
    p_status: parsed.data.status,
    p_evidence_reference: parsed.data.evidence_reference || null,
  });
  if (error || !data) redirect(back + "?error=" + encodeURIComponent("Não foi possível actualizar a tarefa com a evidência indicada."));
  redirect("/gie360/project/" + item.project_id + "?work=updated");
}

/** Retry an already-approved GIE360 intake without recreating the client or case. */
export async function reconcileGie360Intake(formData: FormData) {
  const caseId = z.string().uuid().safeParse(formData.get("case_id"));
  if (!caseId.success) redirect("/gie360?error=" + encodeURIComponent("Caso PCC inválido."));
  const { supabase, user } = await requireUser();
  const { data: owned } = await supabase.from("project_factory_cases")
    .select("id").eq("id", caseId.data).eq("user_id", user.id).maybeSingle();
  if (!owned) redirect("/gie360?error=" + encodeURIComponent("Caso PCC não autorizado."));
  const { data, error } = await supabase.rpc("gie360_intake_from_diagnostic", {
    p_case_id: caseId.data,
  });
  if (error || !data) {
    redirect("/gie360?error=" + encodeURIComponent("O diagnóstico deve estar respondido e aceite para ser encaminhado ao GIE360°."));
  }
  redirect("/gie360/project/" + String(data) + "?handoff=created");
}

/** Associate a separate, already-confirmed GIE360 client login with this organization.
 * No administrative privileges, impersonation, duplicate client or new contract.
 */
export async function linkGie360ExistingClient(formData: FormData) {
  const input = z.object({
    organization_id: z.string().uuid(),
    client_email: z.string().trim().email().max(320),
  }).safeParse({
    organization_id: formData.get("organization_id"),
    client_email: formData.get("client_email"),
  });
  if (!input.success) redirect("/gie360?error=" + encodeURIComponent("Email ou organização inválidos."));
  const {supabase,user} = await requireUser();
  const {data:organization} = await supabase.from("gie360_organizations")
    .select("id").eq("id",input.data.organization_id)
    .eq("manager_user_id",user.id).maybeSingle();
  if (!organization) redirect("/gie360?error=" + encodeURIComponent("Organização não autorizada."));
  const {data,error} = await supabase.rpc("gie360_link_existing_client",{
    p_organization_id:organization.id,
    p_client_email:input.data.client_email,
  });
  if (error || !data) {
    redirect("/gie360/" + organization.id + "?error=" +
      encodeURIComponent("Não foi possível associar. Verifique que existe uma conta de cliente separada, com email confirmado e sem acesso administrativo PCC."));
  }
  redirect("/gie360/" + organization.id + "?client=linked");
}
