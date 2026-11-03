import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { createGie360Assessment } from "./actions";

type FactoryCase = { id: string; title: string; stage: string; created_at: string };
type ClientRequest = {
  factory_case_id: string;
  status: string;
  submitted_at: string | null;
  client_organization: string | null;
  client_name: string | null;
};
type Organization = { id: string; name: string; contract_approved: boolean; created_at: string };
type Assessment = { organization_id: string; factory_case_id: string; status: string; submitted_at: string | null };

export default async function Gie360Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string; created?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();

  const [orgResult, caseResult, requestResult] = await Promise.all([
    supabase.from("gie360_organizations")
      .select("id,name,contract_approved,created_at")
      .eq("manager_user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.from("project_factory_cases")
      .select("id,title,stage,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.from("client_diagnostic_requests")
      .select("factory_case_id,status,submitted_at,client_organization,client_name")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const organizations = (orgResult.data ?? []) as Organization[];
  const cases = (caseResult.data ?? []) as FactoryCase[];
  const requests = (requestResult.data ?? []) as ClientRequest[];
  const ids = organizations.map((org) => org.id);
  const assessmentResult = ids.length
    ? await supabase.from("gie360_assessments")
        .select("organization_id,factory_case_id,status,submitted_at")
        .in("organization_id", ids)
    : { data: [] as Assessment[], error: null };
  const assessments = (assessmentResult.data ?? []) as Assessment[];
  const byId = new Map(cases.map((item) => [item.id, item]));
  const orgById = new Map(organizations.map((org) => [org.id, org]));
  const linkedCaseIds = new Set(assessments.map((item) => item.factory_case_id));
  const requestByCase = new Map<string, ClientRequest>();
  for (const request of requests) {
    if (!requestByCase.has(request.factory_case_id)) requestByCase.set(request.factory_case_id, request);
  }
  const candidates = cases.filter((item) =>
    !linkedCaseIds.has(item.id) && requests.some((request) => request.factory_case_id === item.id && request.submitted_at),
  );

  return (
    <>
      <PageHeader eyebrow="Gestão Inteligente Empresarial" title="GIE360°" />
      <div className="mb-5 space-y-3">
        <p className="text-sm leading-6 text-[var(--cc-secondary)]">
          O GIE360° recebe os resultados de diagnósticos dos casos PCC. Cada avaliação mantém a ligação ao caso de origem. Não há criação automática de projectos ou alteração de respostas.
        </p>
        {params.error && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">{params.error}</p>}
        {params.notice && <p role="status" className="rounded-xl border border-[var(--cc-border)] p-3 text-sm">{params.notice}</p>}
        {params.created && <p role="status" className="rounded-xl border border-[var(--cc-border)] p-3 text-sm">Avaliação GIE360° criada e associada ao caso PCC.</p>}
        {(orgResult.error || caseResult.error || requestResult.error || assessmentResult.error) && (
          <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            Não foi possível carregar todos os dados GIE360°. Verifique as permissões de acesso.
          </p>
        )}
      </div>

      <Card className="p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Avaliações GIE360°</h2>
        {assessments.length === 0 ? (
          <p className="mt-3 text-sm leading-6 text-[var(--cc-secondary)]">
            Ainda não existe nenhuma avaliação activada. Os diagnósticos já recebidos aparecem abaixo, sem serem repetidos.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {assessments.map((item) => (
              <div key={item.organization_id + item.factory_case_id} className="rounded-xl border border-[var(--cc-border)] p-4">
                <p className="font-semibold">{orgById.get(item.organization_id)?.name ?? "Organização"}</p>
                <p className="mt-1 text-sm text-[var(--cc-secondary)]">
                  {byId.get(item.factory_case_id)?.title ?? "Caso PCC"} · {item.status}
                </p>
                <p className="mt-1 text-xs text-[var(--cc-secondary)]">
                  {orgById.get(item.organization_id)?.contract_approved ? "Contrato aprovado" : "Contrato ainda não aprovado"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link className={primaryButtonClass + " inline-flex"} href={`/gie360/${item.organization_id}`}>Abrir avaliação GIE360°</Link>
                  <Link className={secondaryButtonClass + " inline-flex"} href={`/project-factory/${item.factory_case_id}`}>Ver caso PCC de origem</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="mt-5 p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--cc-foreground)]">Encaminhar diagnóstico para o GIE360°</h2>
        <p className="mt-2 text-sm text-[var(--cc-secondary)]">
          A activação preserva o caso e exige uma resposta revista, aceite e uma conta de cliente existente e confirmada. Não cria outro caso PCC.
        </p>
        {candidates.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--cc-secondary)]">Não há respostas por encaminhar.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {candidates.map((item) => {
              const request = requestByCase.get(item.id);
              const accepted = requests.some((r) => r.factory_case_id === item.id && r.submitted_at && ["reviewed", "incorporated"].includes(r.status));
              return (
                <section key={item.id} className="rounded-xl border border-[var(--cc-border)] p-4">
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="mt-1 text-xs text-[var(--cc-secondary)]">
                    Resposta recebida · {accepted ? "Revista e pronta a encaminhar" : "Aguarda revisão e aceitação"}
                  </p>
                  <Link href={`/project-factory/${item.id}`} className={secondaryButtonClass + " mt-3 inline-flex"}>
                    {accepted ? "Consultar caso PCC" : "Rever diagnóstico no PCC"}
                  </Link>
                  {accepted && (
                    <form action={createGie360Assessment} className="mt-4 grid gap-3 sm:grid-cols-2">
                      <input type="hidden" name="case_id" value={item.id} />
                      <label className="text-sm font-medium">
                        Organização
                        <input name="organization_name" required minLength={2} maxLength={200}
                          defaultValue={request?.client_organization ?? ""}
                          className="mt-1 block w-full rounded-lg border border-[var(--cc-border)] bg-[var(--cc-surface-strong)] p-2.5" />
                      </label>
                      <label className="text-sm font-medium">
                        Email da conta do cliente GIE360°
                        <input name="client_email" required type="email" maxLength={320}
                          className="mt-1 block w-full rounded-lg border border-[var(--cc-border)] bg-[var(--cc-surface-strong)] p-2.5" />
                      </label>
                      <div className="sm:col-span-2">
                        <button className={primaryButtonClass} type="submit">Criar avaliação GIE360° associada</button>
                      </div>
                    </form>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}
