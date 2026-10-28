import Link from "next/link";
import {requireGIE360User} from "@/lib/gie360-auth";
import type {GIEImportSnapshot} from "@/lib/gie360-import";
import {Card,inputClass,primaryButtonClass,secondaryButtonClass} from "@/components/ui";
export default async function GIE360ImportsPage({searchParams}:{searchParams:Promise<{error?:string;success?:string;page?:string;organization?:string}>}){
 const {supabase,user}=await requireGIE360User();const search=await searchParams;
 const page=Math.max(1,Math.min(1000,Number.parseInt(search.page||"1",10)||1));
 const [{data:orgs,error:orgError},{data:batches,error:batchError,count},{data:packages}]=await Promise.all([
  supabase.from("gie360_organizations").select("id,name,manager_user_id,package_code").order("name"),
  supabase.from("gie360_import_batches").select("id,organization_id,source_name,snapshot,state,created_at,original_sha256,review_reason,reconciliation,overlap_batch_ids,overlap_batch_count",{count:"exact"}).order("created_at",{ascending:false}).range((page-1)*20,page*20-1),
  supabase.from("pcc_product_packages").select("code,export_rights"),
 ]);
 const states:Record<string,string>={received:"Recebido",in_review:"Em revisão",approved:"Aprovado",rejected:"Rejeitado"};
 const money=(value:number|null|undefined)=>value==null?"Não disponível":new Intl.NumberFormat("pt-MZ",{style:"currency",currency:"MZN"}).format(value);
 return <div className="space-y-6">
  <div><h1 className="text-2xl font-semibold text-[#073F36]">Dados e validação</h1><p className="mt-2 text-sm">Importe o extracto do seu sistema. Não é necessário enviar cada factura individualmente. O original é preservado e os dados aguardam revisão humana.</p></div>
  {search.error&&<p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900">{search.error}</p>}
  {search.success&&<p role="status" className="rounded-xl border border-green-300 bg-green-50 p-4 text-green-900">{search.success}</p>}
  {(orgError||batchError)&&<p role="alert">Não foi possível consultar os dados. Confirme a ligação e contacte o gestor se o problema continuar.</p>}
  <Card className="p-5"><h2 className="text-lg font-semibold">Enviar extracto CSV ou XLSX</h2>
   {!orgs?.length?<p className="mt-3">Ainda não tem uma empresa associada. O gestor do PCC deve criar o acesso antes da importação.</p>:<form method="post" action="/gie360/imports/upload" encType="multipart/form-data" className="mt-4 space-y-4">
    <label className="block">Empresa<select name="organization_id" required defaultValue={orgs.find(o=>o.id===search.organization)?.id||orgs[0].id} className={inputClass}>{orgs.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
    <label className="block">Ficheiro original (máximo 3 MB)<input name="file" type="file" required accept=".csv,.xlsx" className={inputClass}/></label>
    <p className="text-sm">Colunas: documento, tipo, data, moeda, base_tributavel, imposto e total. Tipo: factura ou nota_credito. Notas de crédito exigem documento_original. Linhas repetidas do mesmo documento exigem identificador linha. Datas AAAA-MM-DD; os valores em falta ficam sinalizados. <Link href="/gie360/imports/template" className="underline">Descarregar cabeçalho CSV</Link></p>
    <details className="rounded-xl border border-[#C99439]/40 p-3"><summary className="cursor-pointer font-medium">Conversão para MZN (se o extracto tiver outra moeda)</summary><p className="mt-2 text-sm">Introduza a taxa efectiva com data e fonte. Esta taxa aplica-se apenas aos documentos dessa moeda na data indicada. Outras datas ou moedas ficam pendentes de conversão.</p><div className="mt-3 grid gap-3 sm:grid-cols-2">
     <label>Moeda de origem<input name="rate_currency" maxLength={3} placeholder="EUR" className={inputClass}/></label>
     <label>MZN por unidade da moeda<input name="rate" inputMode="decimal" placeholder="Taxa documentada" className={inputClass}/></label>
     <label>Data da taxa<input name="rate_date" type="date" className={inputClass}/></label>
     <label>Fonte / referência<input name="rate_source" maxLength={500} placeholder="Banco e referência do comprovativo" className={inputClass}/></label>
    </div></details>
    <button className={primaryButtonClass}>Importar e validar dados</button>
   </form>}
  </Card>
  <div className="space-y-4"><h2 className="text-lg font-semibold">Lotes e revisões</h2>
   {!batches?.length&&!batchError&&<p>Nenhum lote recebido. Envie o extracto para iniciar a validação.</p>}
   {batches?.map(batch=>{const snapshot=batch.snapshot as GIEImportSnapshot;const org=orgs?.find(o=>o.id===batch.organization_id);const manager=org?.manager_user_id===user.id;const errors=snapshot.alerts.filter(a=>a.severity==="error");const csv=packages?.find(p=>p.code===org?.package_code)?.export_rights?.includes("csv");return <Card key={batch.id} className="space-y-4 p-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{batch.source_name}</h3><span className="rounded-full bg-[#073F36]/10 px-3 py-1 text-sm">{states[batch.state]||batch.state}</span></div>
    <p className="text-sm">{org?.name} · {snapshot.coverage.rows} linhas · {snapshot.coverage.periodFrom||"Período em falta"} até {snapshot.coverage.periodTo||"—"}</p>
    <p className="text-sm">{batch.state==="approved"?"Soma do lote aprovado":"Prévia do lote; não usar como avaliação aprovada"}: base {money(snapshot.totals.mzn.net)} · imposto {money(snapshot.totals.mzn.tax)} · total {money(snapshot.totals.mzn.gross)}.</p>
    {batch.overlap_batch_count>0&&<p className="rounded-xl border border-[#C99439] p-3 text-sm">Atenção: período sobreposto com {batch.overlap_batch_count} lote(s). Não some estes lotes sem reconciliar documentos e períodos. Referências (até 100): {batch.overlap_batch_ids.join(", ")}.</p>}
    <p className="text-sm font-medium">{errors.length} alertas bloqueantes · {snapshot.alerts.length-errors.length} avisos. {errors.length>0?"Corrija a origem e envie uma nova versão; este lote não pode ser aprovado.":"A ausência de erros automáticos não substitui a revisão do gestor."}</p>
    {snapshot.alerts.length>0&&<details><summary className="cursor-pointer underline">Ver informação em falta e divergências</summary><ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{snapshot.alerts.slice(0,50).map((a,i)=><li key={i}>{a.row?`Linha ${a.row}: `:""}{a.message}</li>)}</ul>{snapshot.alerts.length>50&&<p className="mt-2 text-sm">A lista completa está no relatório de validação.</p>}</details>}
    <details><summary className="cursor-pointer text-sm underline">Origem, integridade e limites da análise</summary><p className="mt-2 break-all text-xs">SHA-256: {batch.original_sha256}</p><ul className="mt-2 list-disc pl-5 text-sm">{snapshot.limitations.map(l=><li key={l}>{l}</li>)}</ul></details>
    {batch.reconciliation&&<p className="text-sm">Referência contabilística: {batch.reconciliation.reference?.sourceReference}. Campos comparados: {batch.reconciliation.comparedFields?.join(", ")}. {batch.reconciliation.limitation}</p>}
    {batch.review_reason&&<p className="rounded-xl bg-[#F8F6F0] p-3 text-sm">Motivo da revisão: {batch.review_reason}</p>}
    <div className="flex flex-wrap gap-2"><a href={`/gie360/imports/${batch.id}/download`} className={secondaryButtonClass}>Descarregar original</a><a href={`/gie360/imports/${batch.id}/download?format=report`} className={secondaryButtonClass}>Relatório de validação</a>{csv?<a href={`/gie360/imports/${batch.id}/download?format=csv`} className={secondaryButtonClass}>Exportar dados CSV</a>:<span className="self-center text-sm">Exportação CSV não contratada.</span>}</div>
    {manager&&!["approved","rejected"].includes(batch.state)&&<form method="post" action={`/gie360/imports/${batch.id}/review`} className="space-y-3 border-t border-[#C99439]/30 pt-4">{batch.state==="in_review"&&<fieldset className="space-y-3 rounded-xl border border-[#C99439]/40 p-3"><legend className="px-1 font-medium">Reconciliação com referência contabilística</legend><p className="text-sm">Para aprovar, indique a fonte e pelo menos um total MZN do mesmo período. A comparação é determinística; divergências bloqueiam a aprovação. Confirma apenas os campos comparados e não comprova lucro nem conformidade fiscal.</p><label className="block text-sm">Fonte e referência do registo<input name="ledger_reference" maxLength={500} className={inputClass}/></label><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Início do período<input name="ledger_period_from" type="date" defaultValue={snapshot.coverage.periodFrom||""} className={inputClass}/></label><label className="text-sm">Fim do período<input name="ledger_period_to" type="date" defaultValue={snapshot.coverage.periodTo||""} className={inputClass}/></label></div><div className="grid gap-3 sm:grid-cols-3">{(["net","tax","gross"] as const).map(field=><label key={field} className="text-sm">{{net:"Base MZN",tax:"Imposto MZN",gross:"Total MZN"}[field]}<input name={`ledger_${field}`} inputMode="decimal" className={inputClass}/></label>)}</div></fieldset>}<label className="block text-sm">Motivo da revisão<textarea name="reason" minLength={3} maxLength={2000} required className={inputClass}/></label><div className="flex flex-wrap gap-2">{batch.state==="received"?<button name="target" value="in_review" className={primaryButtonClass}>Iniciar revisão</button>:errors.length===0?<button name="target" value="approved" className={primaryButtonClass}>Aprovar lote verificado</button>:<p className="self-center text-sm">Aprovação bloqueada pelos alertas acima.</p>}<button name="target" value="rejected" className={secondaryButtonClass}>Rejeitar e registar motivo</button></div></form>}
   </Card>;})}
   <nav aria-label="Páginas dos lotes" className="flex gap-3">{page>1&&<Link href={`/gie360/imports?page=${page-1}`} className={secondaryButtonClass}>Página anterior</Link>}{(count||0)>page*20&&<Link href={`/gie360/imports?page=${page+1}`} className={secondaryButtonClass}>Página seguinte</Link>}</nav>
  </div>
 </div>;
}
