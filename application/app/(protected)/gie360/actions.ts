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
