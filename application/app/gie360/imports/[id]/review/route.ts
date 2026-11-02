import {createHash} from "node:crypto";
import {NextResponse} from "next/server";
import {parseGIE360Import,parseImportAmount,reconcileGIE360Ledger,type GIEImportSnapshot} from "@/lib/gie360-import";
import {createServiceClient} from "@/lib/supabase/service";
import {createClient} from "@/lib/supabase/server";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 const origin=new URL(process.env.NEXT_PUBLIC_SITE_URL||request.url).origin;
 if(request.headers.get("origin")!==origin)return NextResponse.json({error:"Origem inválida."},{status:403});
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"Sessão expirada."},{status:401});
 const back=(message:string,ok=false)=>NextResponse.redirect(new URL(`/gie360/imports?${ok?"success":"error"}=${encodeURIComponent(message)}`,origin),303);
 const {id}=await params;const {data:batch}=await supabase.from("gie360_import_batches").select("organization_id,source_name,source_path,original_sha256,snapshot").eq("id",id).maybeSingle();
 if(!batch)return back("Lote indisponível ou sem permissão.");
 const {data:org}=await supabase.from("gie360_organizations").select("manager_user_id").eq("id",batch.organization_id).maybeSingle();
 if(org?.manager_user_id!==user.id)return back("A revisão só pode ser efectuada pelo gestor responsável.");
 const form=await request.formData();const target=String(form.get("target")||"");const reason=String(form.get("reason")||"").trim();
 if(reason.length<3||reason.length>2000)return back("Indique o motivo da revisão, entre 3 e 2000 caracteres.");
 let reconciliation:ReturnType<typeof reconcileGIE360Ledger>|null=null;
 if(target==="approved"){
  const service=createServiceClient();if(!service)return back("A revisão segura não está configurada no servidor.");
  const {data:file,error}=await service.storage.from("gie360-import-originals").download(batch.source_path);
  if(error||!file)return back("O original não está disponível. Aprovação bloqueada.");
  const buffer=Buffer.from(await file.arrayBuffer());
  if(createHash("sha256").update(buffer).digest("hex")!==batch.original_sha256)return back("O hash do original diverge. Aprovação bloqueada.");
  const saved=batch.snapshot as GIEImportSnapshot;
  const amounts:Record<"net"|"tax"|"gross",number|null>={net:null,tax:null,gross:null};
  for(const field of ["net","tax","gross"] as const){const raw=String(form.get(`ledger_${field}`)||"").trim();if(raw){const n=parseImportAmount(raw);if(n===null)return back("Os totais da referência contabilística devem ter valores válidos, até duas casas decimais.");amounts[field]=n;}}
  reconciliation=reconcileGIE360Ledger(saved,{sourceReference:String(form.get("ledger_reference")||"").trim(),periodFrom:String(form.get("ledger_period_from")||""),periodTo:String(form.get("ledger_period_to")||""),currency:"MZN",...amounts});
  if(reconciliation.status!=="matched")return back(reconciliation.alerts.length?reconciliation.alerts.join(" "):"Os totais importados divergem da referência contabilística. Corrija a origem ou a referência antes de aprovar.");
  try {
   const verified=await parseGIE360Import(buffer,batch.source_name,saved.exchangeRates||[]);
   function canonical(value:unknown):unknown {if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,v])=>[key,canonical(v)]));return value;}
   if(JSON.stringify(canonical(verified))!==JSON.stringify(canonical(saved)))return back("A normalização difere do original. Aprovação bloqueada; envie nova versão.");
  }catch{return back("Não foi possível verificar novamente o original. Aprovação bloqueada.");}
 }
 const admin=createServiceClient();if(!admin)return back("A revisão segura não está configurada no servidor. Contacte o gestor.");
 const {error}=await admin.rpc("review_gie360_import",{p_import_id:id,p_target:target,p_reason:reason,p_actor_id:user.id,p_reconciliation:reconciliation});
 if(error)return back("Transição recusada. Confirme o estado actual, os alertas bloqueantes e as suas permissões.");
 return back(target==="approved"?"Lote aprovado e versão preservada.":target==="rejected"?"Lote rejeitado com motivo registado. O original foi preservado.":"Lote colocado em revisão.",true);
}
