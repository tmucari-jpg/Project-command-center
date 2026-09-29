import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, primaryButtonClass } from "@/components/ui";
import { portfolio } from "@/lib/project-portfolio";
import { requireUser } from "@/lib/auth";
import { importPortfolio } from "./mutations";

export default async function PortfolioPage({ searchParams }: {
  searchParams: Promise<{ error?: string; imported?: string; actions?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();
  const [projectsResult, actionsResult, blockersResult] = await Promise.all([
    supabase.from("projects").select("id,title,status,updated_at,next_action").eq("user_id", user.id).order("updated_at", { ascending: true }).limit(501),
    supabase.from("actions").select("project_id,status,updated_at").eq("user_id", user.id).limit(1001),
    supabase.from("blockers").select("project_id,status").eq("user_id", user.id).limit(1001),
  ]);
  const projects = projectsResult.data ?? [];
  const actions = actionsResult.data ?? [];
  const blockers = blockersResult.data ?? [];
  return <>
    <PageHeader eyebrow="Crescimento" title="Projectos e monetização"
      description="Acções de arranque e hipóteses comerciais para cada projecto. Confirme o cliente, a oferta e o preço com testes reais." />
    {params.error && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{params.error}</p>}
    {params.imported !== undefined && <p role="status" className="mb-5 rounded-xl bg-green-50 p-4 text-sm text-green-800">
      {params.imported} projectos e {params.actions} acções acrescentados. Os registos já existentes foram preservados.
    </p>}
    <Card className="p-5">
      <h2 className="font-semibold text-slate-950">Colocar o plano em execução</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">Cria os projectos em falta e acrescenta as acções que ainda não existem. Pode repetir a importação; a comparação é feita por nome do projecto e título da acção.</p>
      <form action={importPortfolio} className="mt-4"><button className={primaryButtonClass}>Adicionar projectos e acções</button></form>
    </Card>
    <Card className="mt-6 p-5">
      <h2 className="font-semibold text-slate-950">Todos os projectos da conta ({projects.length})</h2>
      <p className="mt-1 text-sm text-slate-600">Esta lista é lida da base de dados e inclui projectos criados fora deste plano.</p>
      {(projectsResult.error || actionsResult.error || blockersResult.error || projects.length > 500 || actions.length > 1000 || blockers.length > 1000) &&
        <p role="alert" className="mt-4 text-sm text-red-800">Não foi possível mostrar a cobertura completa. Verifique a ligação ou o volume de dados.</p>}
      {projects.length === 0 && !projectsResult.error && <p className="mt-4 text-sm text-slate-500">Ainda não há projectos registados.</p>}
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {projects.slice(0, 500).map((project) => {
          const related = actions.filter((item) => item.project_id === project.id);
          const open = related.filter((item) => ["pending", "in_progress"].includes(item.status));
          const blocked = blockers.filter((item) => item.project_id === project.id && !["resolved", "ignored"].includes(item.status));
          const last = [project.updated_at, ...related.map((item) => item.updated_at)].filter(Boolean).sort().at(-1);
          const needsAttention = !["completed", "cancelled"].includes(project.status) && (open.length === 0 || blocked.length > 0);
          return <div key={project.id} className={`rounded-xl border p-4 ${needsAttention ? "border-amber-300 bg-amber-50" : "border-slate-200"}`}>
            <p className="font-medium text-slate-950">{project.title}</p>
            <p className="mt-1 text-xs text-slate-600">{project.status.replaceAll("_", " ")} · {open.length} acções abertas · {blocked.length} bloqueios</p>
            {needsAttention && <p className="mt-2 text-xs font-medium text-amber-900">{open.length === 0 ? "Sem próxima acção aberta. " : ""}{blocked.length ? "Bloqueio activo." : ""}</p>}
            {last && <p className="mt-2 text-xs text-slate-500">Último movimento: {last.slice(0, 10)}</p>}
            {project.next_action && <p className="mt-2 text-xs text-slate-600">Próximo passo: {project.next_action}</p>}
          </div>;
        })}
      </div>
    </Card>
    <div className="mt-6 grid gap-5 lg:grid-cols-2">
      {portfolio.map((plan) => <Card key={plan.name} className="p-5">
        <h2 className="text-lg font-semibold text-slate-950">{plan.name}</h2>
        <p className="mt-2 text-sm text-slate-600">{plan.description}</p>
        <dl className="mt-4 space-y-2 text-sm leading-6">
          <div><dt className="font-semibold text-slate-900">Cliente</dt><dd className="text-slate-600">{plan.customer}</dd></div>
          <div><dt className="font-semibold text-slate-900">Oferta</dt><dd className="text-slate-600">{plan.offer}</dd></div>
          <div><dt className="font-semibold text-slate-900">Receita</dt><dd className="text-slate-600">{plan.revenue}</dd></div>
          <div><dt className="font-semibold text-slate-900">Validação</dt><dd className="text-slate-600">{plan.validation}</dd></div>
        </dl>
        <h3 className="mt-5 text-sm font-semibold text-slate-900">Acções ({plan.actions.length})</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-700">
          {plan.actions.map((action) => <li key={action.title}>{action.title}</li>)}
        </ol>
      </Card>)}
    </div>
    <Link href="/agents" className="mt-6 inline-block text-sm font-semibold text-blue-700 hover:underline">Analisar prioridades com a força agêntica</Link>
  </>;
}
