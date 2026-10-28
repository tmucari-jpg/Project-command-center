"use client";
import { useActionState, useState } from "react";
import { GIE360_MODULES } from "@/lib/gie360";
import { provisionGIE360, configureGIE360 } from "@/lib/gie360-management-actions";
export function GIE360ProvisionForm({ cases }: { cases: { id: string; title: string }[] }) {
  const [state, action, pending] = useActionState(provisionGIE360, {});
  return <section className="rounded-xl border bg-white p-6"><h2 className="text-xl font-semibold">Associar empresa ao GIE360°</h2><p className="my-3 text-sm text-slate-600">Escolha um caso de que é proprietário e uma conta de cliente separada, já registada e com email confirmado. A associação é idempotente e não atribui permissões de gestão PCC. Pacote, preço e âmbito continuam por aprovar.</p>
    {!cases.length ? <p>Crie ou seleccione um caso PCC antes de associar um cliente.</p> : <form action={action} className="grid gap-4 md:grid-cols-2">
      <label className="block text-sm">Caso PCC<select aria-label="Caso PCC" name="caseId" required className="mt-2 w-full rounded-lg border p-3"><option value="">Seleccione o caso</option>{cases.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      <label className="block text-sm">Empresa<input name="name" minLength={2} maxLength={200} required className="mt-2 w-full rounded-lg border p-3" /></label>
      <label className="block text-sm">Email confirmado do cliente<input name="email" type="email" required maxLength={254} className="mt-2 w-full rounded-lg border p-3" /></label>
      <div className="flex items-end"><button disabled={pending} className="rounded-lg bg-[#073F36] px-4 py-3 text-white disabled:opacity-50">{pending ? "A associar…" : "Associar cliente e diagnóstico"}</button></div>
      {state.error && <p role="alert" className="text-red-800 md:col-span-2">{state.error}</p>}{state.success && <p role="status" className="text-green-900 md:col-span-2">{state.success}</p>}
    </form>}
  </section>;
}

type PackageOption = { code: string; name: string; modules: string[] };
type ScopeOrganization = { id: string; name: string; package_code: string | null; approved_modules: string[]; ai_cloud_authorized: boolean; contract_reference: string | null };
export function GIE360SettingsForm({ organization, packages }: { organization: ScopeOrganization; packages: PackageOption[] }) {
  const [state, action, pending] = useActionState(configureGIE360, {});
  const [packageCode, setPackageCode] = useState(organization.package_code ?? "");
  const allowed = packages.find((item) => item.code === packageCode)?.modules ?? [];
  return <form action={action} className="space-y-4 rounded-xl border bg-white p-6">
    <h2 className="text-xl font-semibold">Âmbito de {organization.name}</h2>
    <input type="hidden" name="organizationId" value={organization.id} />
    <label className="block text-sm">Pacote acordado<select aria-label="Pacote acordado" name="packageCode" required value={packageCode} onChange={(event) => setPackageCode(event.target.value)} className="mt-2 w-full rounded-lg border p-3"><option value="">Seleccione o pacote</option>{packages.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
    <fieldset className="grid gap-2 md:grid-cols-2" key={packageCode}><legend className="mb-2 text-sm font-medium">Módulos com âmbito aprovado</legend>{GIE360_MODULES.filter((module) => allowed.includes(module.code)).map((module) => <label key={module.code} className="flex gap-2 text-sm"><input type="checkbox" name="modules" value={module.code} defaultChecked={organization.approved_modules.includes(module.code)} />{module.label}</label>)}</fieldset>
    <label className="block text-sm">Referência do acordo aprovado<input name="contract" required minLength={3} maxLength={500} defaultValue={organization.contract_reference ?? ""} className="mt-2 w-full rounded-lg border p-3" /><span className="mt-1 block text-xs text-slate-500">Introduza a referência real da aprovação comercial ou piloto. Este formulário não define nem cobra preços.</span></label>
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="ai" defaultChecked={organization.ai_cloud_authorized} className="mt-1" />Autorizo o tratamento dos dados desta empresa pelos fornecedores de IA cloud aprovados na configuração PCC, incluindo fallback compatível. Confirmo a informação e autorização do cliente.</label>
    <button disabled={pending} className="rounded-lg bg-[#073F36] px-4 py-3 text-white disabled:opacity-50">{pending ? "A registar…" : "Registar âmbito e autorização"}</button>
    {state.error && <p role="alert" className="text-red-800">{state.error}</p>}{state.success && <p role="status" className="text-green-900">{state.success}</p>}
  </form>;
}
