import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {createServiceClient} from "@/lib/supabase/service";
import { MAX_IMPORT_BYTES, parseGIE360Import, parseImportExchangeRate, type ExchangeRate } from "@/lib/gie360-import";
export const runtime = "nodejs";
export async function POST(request: Request) {
 const origin = new URL(process.env.NEXT_PUBLIC_SITE_URL || request.url).origin;
 if (request.headers.get("origin") !== origin) return NextResponse.json({error:"Origem inválida."},{status:403});
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser();
 if(!user) return NextResponse.json({error:"Sessão expirada. Entre novamente no GIE360°."},{status:401});
 const back=(message:string,ok=false)=>NextResponse.redirect(new URL(`/gie360/imports?${ok?"success":"error"}=${encodeURIComponent(message)}`,origin),303);
 if(Number(request.headers.get("content-length") || 0)>MAX_IMPORT_BYTES+64*1024) return back("O ficheiro excede 3 MB.");
 try {
  const form=await request.formData();const file=form.get("file");const org=String(form.get("organization_id")||"");
  if(!(file instanceof File)||file.size===0||file.size>MAX_IMPORT_BYTES) return back("Seleccione um ficheiro CSV/XLSX válido, até 3 MB.");
  const {data:organization,error:orgError}=await supabase.from("gie360_organizations").select("id").eq("id",org).maybeSingle();
  if(orgError||!organization) return back("Empresa indisponível ou sem permissão de acesso.");
  const rates:ExchangeRate[]=[];const rawRate=String(form.get("rate")||"").trim();
  if(rawRate){const rate=parseImportExchangeRate(rawRate);if(rate===null||rate<=0) return back("A taxa cambial deve ser um número positivo sem separadores ambíguos.");rates.push({currency:String(form.get("rate_currency")||"").toUpperCase(),date:String(form.get("rate_date")||""),source:String(form.get("rate_source")||"").trim(),rateToMzn:rate});}
  const admin=createServiceClient(); if(!admin)return back("A importação segura ainda não foi configurada no servidor. Contacte o gestor; o ficheiro não foi registado.");
  const buffer=new Uint8Array(await file.arrayBuffer());const snapshot=await parseGIE360Import(buffer,file.name,rates);
  const {data:existing,error:existingError}=await supabase.from("gie360_import_batches").select("id").eq("organization_id",org).eq("original_sha256",snapshot.originalSha256).limit(1).maybeSingle();
  if(existingError)return back("Não foi possível verificar se este original já foi importado. Tente novamente mais tarde.");
  if(existing)return back(`Este ficheiro já foi recebido no lote ${existing.id}. Não foi criada uma cópia nem somados novamente os seus valores.`,true);
  let overlapIds:string[]=[];let overlapCount=0;
  if(snapshot.coverage.periodFrom&&snapshot.coverage.periodTo){
   const {data:priorBatches,error:priorError,count}=await supabase.from("gie360_import_batches").select("id",{count:"exact"}).eq("organization_id",org).in("state",["received","in_review","approved"]).lte("snapshot->coverage->>periodFrom",snapshot.coverage.periodTo).gte("snapshot->coverage->>periodTo",snapshot.coverage.periodFrom).limit(100);
   if(priorError)return back("Não foi possível verificar sobreposições com lotes anteriores. Tente novamente mais tarde.");
   overlapIds=(priorBatches||[]).map(prior=>prior.id);overlapCount=count||overlapIds.length;
  }
  const id=randomUUID();const extension=file.name.toLowerCase().endsWith(".xlsx")?"xlsx":"csv";const path=`${org}/${id}/original.${extension}`;
  const {error:uploadError}=await admin.storage.from("gie360-import-originals").upload(path,buffer,{contentType:extension==="xlsx"?"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":"text/csv",upsert:false});
  if(uploadError) return back("Não foi possível guardar o original. Nenhum lote foi aprovado; tente novamente.");
  const {error:insertError}=await admin.from("gie360_import_batches").insert({id,organization_id:org,created_by:user.id,source_name:file.name.slice(0,255),source_path:path,original_sha256:snapshot.originalSha256,snapshot,overlap_batch_ids:overlapIds,overlap_batch_count:overlapCount});
  if(insertError) return back(`Original preservado sob referência ${id}, mas o registo do lote falhou. Contacte o gestor antes de repetir.`);
  const blockers=snapshot.alerts.filter(a=>a.severity==="error").length;
  return back(`Lote recebido: ${snapshot.records.length} linhas; ${blockers} alertas bloqueantes.${overlapCount?` Atenção: sobreposição de período com ${overlapCount} lote(s); não agregar sem reconciliação.`:""} O gestor deve rever antes de aprovar.`,true);
 } catch(error){const msg=error instanceof Error?error.message:"";return back(msg==="GIE360_IMPORT_SERVER_NOT_CONFIGURED"?"A importação segura ainda não foi configurada no servidor. Contacte o gestor para configurar a chave de serviço; o ficheiro não foi registado.":msg.startsWith("IMPORT_")?`Importação recusada (${msg}). Corrija o formato e volte a enviar.`:"Não foi possível processar o ficheiro. O lote não foi aprovado.");}
}
