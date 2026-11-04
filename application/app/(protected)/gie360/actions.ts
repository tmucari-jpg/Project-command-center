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
  redirect(`/gie360/${organizationId}?handoff=${gieProjectId}`);
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
  redirect(back + "?scope=approved");
}


export async function activateGie360Project(formData: FormData) {
  const projectId = z.string().uuid().safeParse(formData.get("project_id"));
  const explicitlyApproved = formData.get("explicitly_approved") === "on";
  if (!projectId.success || !explicitlyApproved) {
    redirect("/gie360?error=" + encodeURIComponent("É necessária uma aprovação explícita para activar a execução GIE360°."));
  }
  const { supabase, user } = await requireUser();
  const { data: project, error: projectError } = await supabase
    .from("gie360_projects")
    .select("id,organization_id,manager_user_id")
    .eq("id", projectId.data)
    .eq("manager_user_id", user.id)
    .maybeSingle();
  if (projectError || !project) redirect("/gie360?error=" + encodeURIComponent("Projecto GIE360° não autorizado."));
  const back = "/gie360/" + project.organization_id;
  const { data, error } = await supabase.rpc("gie360_activate_project", {
    p_project_id: project.id,
  });
  if (error || !data) {
    redirect(back + "?error=" + encodeURIComponent("A execução não foi activada: confirme contrato e âmbito aprovados."));
  }
  redirect(back + "?project=activated");
}
