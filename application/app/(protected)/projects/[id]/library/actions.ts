"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";

export async function updateProjectDeliverableDocumentLink(formData: FormData) {
  const projectId = z.string().uuid().safeParse(formData.get("project_id"));
  const deliverableId = z.string().uuid().safeParse(formData.get("deliverable_id"));
  const artifactUrl = z.string().trim().url().max(2048)
    .refine(value => value.startsWith("https://"), "Use um link HTTPS.")
    .safeParse(formData.get("artifact_url"));
  const reference = z.string().trim().max(240).safeParse(formData.get("artifact_reference") ?? "");

  const back = projectId.success ? `/projects/${projectId.data}/library` : "/projects";
  if (!projectId.success || !deliverableId.success || !artifactUrl.success || !reference.success) {
    redirect(back + "?error=" + encodeURIComponent("Indique um link HTTPS válido e a referência do entregável."));
  }

  const { supabase,user } = await requireUser();
  const { data: deliverable, error: lookupError } = await supabase
    .from("deliverables")
    .select("id,status,acceptance_status")
    .eq("id",deliverableId.data).eq("project_id",projectId.data)
    .eq("user_id",user.id).maybeSingle();

  if (lookupError || !deliverable) {
    redirect(back + "?error=" + encodeURIComponent("Entregável não encontrado neste projecto."));
  }
  if (deliverable.status==="completed" ||
      ["accepted","accepted_with_reservations"].includes(deliverable.acceptance_status ?? "")) {
    redirect(back + "?error=" + encodeURIComponent("Entregável protegido. Utilize o processo de nova versão."));
  }

  const { error: updateError } = await supabase.from("deliverables")
    .update({artifact_url:artifactUrl.data,artifact_reference:reference.data || null})
    .eq("id",deliverableId.data).eq("project_id",projectId.data)
    .eq("user_id",user.id)
    .neq("status","completed")
    .not("acceptance_status","in", '("accepted","accepted_with_reservations")');

  if (updateError) {
    redirect(back + "?error=" + encodeURIComponent("Não foi possível guardar o link neste entregável."));
  }
  revalidatePath(back);
  revalidatePath(`/deliverables`);
  redirect(back+"?saved=1");
}
