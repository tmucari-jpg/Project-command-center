import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, EmptyState, primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { decideProposal, runWorkforce } from "./mutations";

type Finding = { agent: string; text: string };
type Proposal = { agent: string; kind: string; title: string; reason: string };

export default async function AgentsPage({ searchParams }: {
  searchParams: Promise<{ error?: string; updated?: string; approved?: string; rejected?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();
  const [reportResult, proposalsResult] = await Promise.all([
    supabase.from("ai_interactions").select("id,response,created_at")
      .eq("user_id", user.id).eq("intent", "workforce_report")
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("ai_commands").select("id,parameters,created_at")
      .eq("user_id", user.id).eq("intent", "agent_proposal").eq("status", "pending")
      .order("created_at", { ascending: false }).limit(100),
  ]);
  let findings: Finding[] = [];
  if (reportResult.data?.response) {
    try {
      const parsed = JSON.parse(reportResult.data.response);
      if (Array.isArray(parsed.findings)) findings = parsed.findings.filter((item: Finding) => typeof item?.text === "string").slice(0, 600);
    } catch { /* An older report can have another format. */ }
  }
  const proposals = (proposalsResult.data ?? []).filter((item) => {
    const p = item.parameters as Proposal | null;
    return p && typeof p.title === "string" && typeof p.reason === "string";
  });

  return <>
    <PageHeader eyebrow="Execução" title="Força agêntica"
      description="Planeamento, prioridades e bloqueios analisam os seus dados. Cada alteração precisa da sua aprovação." />
    {(params.error || reportResult.error || proposalsResult.error) && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">
      {params.error || reportResult.error?.message || proposalsResult.error?.message}
    </p>}
    {(params.updated || params.approved || params.rejected) && <p role="status" className="mb-5 rounded-xl bg-green-50 p-4 text-sm text-green-800">
      {params.updated ? "Análise actualizada." : params.approved ? "Proposta aplicada." : "Proposta rejeitada."}
    </p>}
    <Card className="p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-slate-950">Executar análise</h2>
          <p className="mt-1 text-sm text-slate-600">Usa os projectos, acções e bloqueios actuais. As recomendações seguem regras transparentes.</p>
          {reportResult.data && <p className="mt-2 text-xs text-slate-500">Última análise: {new Date(reportResult.data.created_at).toLocaleString("pt-PT", { timeZone: "Africa/Maputo" })}</p>}
        </div>
        <form action={runWorkforce}><button className={primaryButtonClass}>Analisar agora</button></form>
      </div>
    </Card>
    <div className="mt-6 grid gap-6 xl:grid-cols-2">
      <Card className="p-5">
        <h2 className="font-semibold text-slate-950">Propostas por aprovar ({proposals.length})</h2>
        <div className="mt-4 space-y-4">
          {proposals.length === 0 ? <EmptyState>Sem propostas pendentes. Execute a análise para gerar recomendações.</EmptyState> : proposals.map((item) => {
            const p = item.parameters as Proposal;
            return <article key={item.id} className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{p.agent === "prioridades" ? "Prioridades" : "Planeamento"}</p>
              <h3 className="mt-2 font-medium text-slate-950">{p.kind === "set_next_action" ? "Definir próxima acção: " : "Criar acção: "}{p.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{p.reason}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <form action={decideProposal}><input type="hidden" name="id" value={item.id} /><input type="hidden" name="decision" value="approve" /><button className={primaryButtonClass}>Aprovar</button></form>
                <form action={decideProposal}><input type="hidden" name="id" value={item.id} /><input type="hidden" name="decision" value="reject" /><button className={secondaryButtonClass}>Rejeitar</button></form>
              </div>
            </article>;
          })}
        </div>
      </Card>
      <Card className="p-5">
        <h2 className="font-semibold text-slate-950">Leitura dos agentes</h2>
        <div className="mt-4 space-y-3">
          {!reportResult.data ? <EmptyState>Ainda não existe uma análise.</EmptyState> : findings.length === 0 ? <EmptyState>Nenhum alerta encontrado nos dados analisados.</EmptyState> : findings.map((finding, index) =>
            <div key={index} className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{finding.agent}</p>
              <p className="mt-1 text-sm leading-6 text-slate-700">{finding.text}</p>
            </div>)}
        </div>
        <div className="mt-5 flex gap-4 text-sm font-medium text-blue-700"><Link href="/projects">Projectos</Link><Link href="/blockers">Bloqueios</Link><Link href="/actions">Acções</Link></div>
      </Card>
    </div>
  </>;
}
