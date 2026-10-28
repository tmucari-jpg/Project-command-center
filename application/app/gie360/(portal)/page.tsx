import Link from "next/link";
import { GIE360Assistant } from "@/components/gie360-assistant";
import { requireGIE360User } from "@/lib/gie360-auth";
import { GIE360Questionnaire } from "@/components/gie360-questionnaire";
import { GIE360_MODULES, gie360ModuleState, type GIE360Answers } from "@/lib/gie360";
import { gie360Logout } from "@/app/gie360/actions";
export const dynamic = "force-dynamic";
export default async function GIE360PortalPage() {
  const { supabase, user } = await requireGIE360User();
  const [{ data: organizations, error }, { data: assessments, error: assessmentError }, { data: packages }] = await Promise.all([
    supabase.from("gie360_organizations").select("id,name,package_code,approved_modules,contract_approved,ai_cloud_authorized"),
    supabase.from("gie360_assessments").select("id,organization_id,answers,revision,status"),
    supabase.from("pcc_product_packages").select("code,name,modules,commercial_status"),
  ]);
  return <main className="mx-auto max-w-6xl space-y-8 px-5 py-8">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-semibold text-[#073F36]">A sua empresa, com contexto</h1><p className="mt-2 text-sm text-slate-600">{user.email} · Informação declarada e evidências mantêm estados de validação distintos.</p></div><form action={gie360Logout}><button className="rounded-lg border border-[#073F36]/30 px-4 py-2">Terminar sessão</button></form></header>
    {error || assessmentError ? <p role="alert" className="rounded-lg bg-red-50 p-5 text-red-800">Não foi possível consultar os dados. Tente novamente ou contacte o gestor; nenhum diagnóstico foi marcado como concluído.</p> : !organizations?.length ? <p className="rounded-lg border bg-white p-6">O acesso ainda não está associado a uma empresa. Peça ao gestor a confirmação da associação.</p> : organizations.map((org) => {
      const packageInfo = packages?.find((item) => item.code === org.package_code);
      return <section key={org.id} className="space-y-6"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-2xl font-medium text-[#073F36]">{org.name}</h2><p className="mt-1 text-sm">Pacote: {packageInfo?.name ?? "A definir com o gestor"}. Preços e direitos dependem de aprovação comercial.</p></div><Link className="rounded-lg bg-[#073F36] px-4 py-3 text-white" href={`/gie360/imports?organization=${org.id}`}>Importar e rever dados</Link></div>
        {assessments?.filter((assessment) => assessment.organization_id === org.id).map((assessment) => <GIE360Questionnaire key={assessment.id} id={assessment.id} initialAnswers={assessment.answers as GIE360Answers} initialRevision={assessment.revision} initialStatus={assessment.status} />)}
        <GIE360Assistant organizationId={org.id} authorized={Boolean(org.contract_approved && org.ai_cloud_authorized && org.approved_modules?.includes("ai"))} />
        <details className="rounded-xl border bg-white p-5"><summary className="cursor-pointer font-medium text-[#073F36]">Âmbito dos módulos e condições de avaliação</summary><p className="mt-3 text-sm text-slate-600">A contratação e a aprovação do âmbito não substituem dados aprovados. Estes estados descrevem condições de avaliação; não certificam a conclusão de módulos.</p><dl className="mt-4 grid gap-4 md:grid-cols-2">{GIE360_MODULES.map((module) => {
          const state = gie360ModuleState({ contracted: org.contract_approved && packageInfo?.modules.includes(module.code), scopeApproved: org.approved_modules?.includes(module.code), relevant: org.approved_modules?.includes(module.code), approvedData: false });
          return <div key={module.code} className="rounded-lg bg-[#F8F6F0] p-4"><dt className="font-medium">{module.label} · {state.status}</dt><dd className="mt-1 text-sm text-slate-600">{state.reason}</dd></div>;
        })}</dl></details>
      </section>;
    })}
  </main>;
}
