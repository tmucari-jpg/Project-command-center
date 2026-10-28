"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";

export async function provisionGIE360(_previous: { error?: string; success?: string }, formData: FormData): Promise<{ error?: string; success?: string }> {
  const parsed = z.object({ caseId: z.uuid(), email: z.string().trim().email().max(254), name: z.string().trim().min(2).max(200) }).safeParse({ caseId: formData.get("caseId"), email: formData.get("email"), name: formData.get("name") });
  if (!parsed.success) return { error: "Seleccione um caso, indique a empresa e um email válido do cliente." };
  const { supabase, authUser } = await requireUser();
  const { data: ownedCase, error: caseError } = await supabase.from("project_factory_cases").select("id").eq("id", parsed.data.caseId).eq("user_id", authUser.id).maybeSingle();
  if (caseError || !ownedCase) return { error: "Só o proprietário do caso pode associar o cliente." };
  const { error } = await supabase.rpc("gie360_provision", { p_case_id: parsed.data.caseId, p_client_email: parsed.data.email, p_name: parsed.data.name, p_profile: {} });
  if (error) return { error: error.message.includes("existing client") ? "O cliente precisa de uma conta separada, com email confirmado. Confirme a criação da conta antes de associar." : error.message.includes("management") ? "Use uma conta de cliente separada das contas de gestão do PCC." : "Não foi possível confirmar a associação. Verifique o caso e a conta do cliente e tente novamente." };
  revalidatePath("/products"); revalidatePath("/gie360");
  return { success: "Empresa e diagnóstico associados ao caso. O cliente pode entrar em /gie360/login com a sua conta confirmada; não foi enviado email automaticamente." };
}

export async function configureGIE360(_previous: { error?: string; success?: string }, formData: FormData): Promise<{ error?: string; success?: string }> {
  const parsed = z.object({ organizationId: z.uuid(), packageCode: z.string().min(1).max(100), modules: z.array(z.string().max(50)).max(20), ai: z.boolean(), contract: z.string().trim().min(3).max(500) }).safeParse({ organizationId: formData.get("organizationId"), packageCode: formData.get("packageCode"), modules: formData.getAll("modules"), ai: formData.get("ai") === "on", contract: formData.get("contract") });
  if (!parsed.success) return { error: "Reveja o pacote, o âmbito e a referência do acordo aprovado." };
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("gie360_configure_organization", { p_organization_id: parsed.data.organizationId, p_package_code: parsed.data.packageCode, p_approved_modules: parsed.data.modules, p_ai_cloud_authorized: parsed.data.ai, p_contract_reference: parsed.data.contract });
  if (error) return { error: error.message.includes("AI requires") ? "A IA exige um pacote que a inclua e a aprovação explícita do módulo IA." : "O servidor recusou a configuração. Confirme que é o gestor da empresa e que o âmbito pertence ao pacote." };
  revalidatePath("/products"); revalidatePath("/gie360");
  return { success: "Pacote, âmbito e autorização de IA registados com histórico. A avaliação continua dependente de dados aprovados." };
}
