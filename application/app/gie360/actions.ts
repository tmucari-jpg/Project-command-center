"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireGIE360User } from "@/lib/gie360-auth";
import { gie360AnswersSchema } from "@/lib/gie360";

export async function gie360Login(_previous: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  const result = z.object({ email: z.string().trim().email().max(254), password: z.string().min(8).max(128) }).safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!result.success) return { error: "Introduza um email válido e a palavra-passe com pelo menos 8 caracteres." };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(result.data);
  if (error || !data.user) return { error: "Não foi possível entrar. Confirme as credenciais e a confirmação do email." };
  const { data: membership, error: accessError } = await supabase.from("gie360_memberships").select("organization_id").eq("client_user_id", data.user.id).limit(1);
  if (accessError || !membership?.length) {
    await supabase.auth.signOut();
    return { error: "Esta conta não tem acesso GIE360°. Solicite ao gestor a associação à sua empresa." };
  }
  redirect("/gie360");
}
export async function gie360Logout() {
  const { supabase } = await requireGIE360User();
  await supabase.auth.signOut();
  redirect("/gie360/login");
}
const saveSchema = z.object({ assessmentId: z.uuid(), revision: z.number().int().nonnegative(), answers: gie360AnswersSchema, submit: z.boolean(), requestKey: z.uuid().nullable() });
export async function saveGIE360Assessment(input: unknown): Promise<{ error?: string; revision?: number; status?: string; informationGaps?: string[] }> {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { error: "Os dados não são válidos. Reveja as respostas e tente novamente." };
  const { supabase } = await requireGIE360User();
  const { data, error } = await supabase.rpc("gie360_save_assessment", {
    p_assessment_id: parsed.data.assessmentId, p_expected_revision: parsed.data.revision,
    p_answers: parsed.data.answers, p_submit: parsed.data.submit, p_request_key: parsed.data.requestKey,
  });
  if (error) {
    if (error.message.includes("Revision conflict")) return { error: "Existe uma versão mais recente. Recarregue a página antes de guardar; conserve as suas respostas para as comparar." };
    if (error.message.includes("expired") || error.message.includes("revoked")) return { error: "O diagnóstico expirou ou foi revogado. Solicite a renovação ao gestor." };
    return { error: "Não foi possível confirmar a gravação no servidor. Conserve as respostas e tente novamente; se persistir, contacte o gestor." };
  }
  revalidatePath("/gie360");
  return { revision: data.revision, status: data.status, informationGaps: data.information_gaps };
}
