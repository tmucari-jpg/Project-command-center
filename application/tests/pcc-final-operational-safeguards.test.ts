import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe,expect,it } from "vitest";

const source=(path:string)=>readFileSync(join(process.cwd(),path),"utf8");
describe("PCC final operational safeguards",()=>{
 const generator=source("components/client-diagnostic-link-generator.tsx");
 const panel=source("components/client-diagnostic-panel.tsx");
 const diagnostic=source("app/client-diagnostic/[token]/actions.ts");
 const questionnaire=source("components/client-diagnostic-gie360-questionnaire.tsx");
 const clientAccess=source("app/(protected)/gie360/actions.ts");
 const scopePage=source("app/(protected)/gie360/[id]/page.tsx");
 const storage=source("../supabase/migrations/20261109090000_gie360_original_read_policy_fix.sql");
 const membership=source("../supabase/migrations/20261109090500_gie360_existing_client_membership.sql");

 it("keeps new bearer token visible until manager shares it",()=>{
  expect(generator).toContain("Preparar email");
  expect(generator).toContain("Partilhar por WhatsApp");
  expect(generator).toContain("Copiar link");
  expect(generator).toContain("Já partilhei o link");
  expect(generator).not.toMatch(/useEffect\s*\(\s*\(\)\s*=>\s*\{\s*if\s*\(state\.ok/);
  expect(panel).toContain("Gerar e partilhar novo link por email ou WhatsApp");
 });
 it("allows a real alternative contact without creating fictitious emails",()=>{
  expect(questionnaire).toContain('name="contact_phone"');
  expect(questionnaire).toContain('name="email"');
  expect(diagnostic).toContain("value.email ||");
  expect(diagnostic).toContain("p_respondent_email: email || null");
  expect(diagnostic).toContain("contact_phone: contact_phone || null");
 });
 it("uses the stored object name and tenant authorization in GIE document read",()=>{
  expect(storage).toContain("storage.foldername(storage.objects.name)");
  expect(storage).toContain("private.gie360_can_access(org.id)");
  expect(storage).not.toContain("storage.foldername(o.name)");
 });
 it("never grants a client a PCC manager role and requires confirmed separate identity",()=>{
  expect(membership).toContain("email_confirmed_at IS NOT NULL");
  expect(membership).toContain("manager_user_id = auth.uid()");
  expect(membership).toContain("public.user_roles");
  expect(membership).toContain("ON CONFLICT (organization_id,client_user_id) DO NOTHING");
  expect(clientAccess).toContain('supabase.rpc("gie360_link_existing_client"');
  expect(scopePage).toContain("Contas de cliente associadas:");
 });
});
