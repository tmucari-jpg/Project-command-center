import {createHash} from "node:crypto";
import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import type {GIEImportSnapshot} from "@/lib/gie360-import";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"Sessão expirada."},{status:401});
 const {id}=await params;const {data:batch}=await supabase.from("gie360_import_batches").select("id,organization_id,source_name,source_path,original_sha256,snapshot,state").eq("id",id).maybeSingle();
 if(!batch)return NextResponse.json({error:"Lote indisponível."},{status:404});
 const headers={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
 if(new URL(request.url).searchParams.get("format")==="report")return NextResponse.json({id:batch.id,state:batch.state,snapshot:batch.snapshot},{headers:{...headers,"Content-Disposition":`attachment; filename="GIE360-validacao-${id}.json"`}});
 if(new URL(request.url).searchParams.get("format")==="csv"){
  const {data:org}=await supabase.from("gie360_organizations").select("package_code").eq("id",batch.organization_id).maybeSingle();
  const {data:pack}=org?.package_code?await supabase.from("pcc_product_packages").select("export_rights").eq("code",org.package_code).maybeSingle():{data:null};
  if(!pack?.export_rights?.includes("csv"))return NextResponse.json({error:"Exportação CSV não contratada neste pacote."},{status:403});
  const snapshot=batch.snapshot as GIEImportSnapshot;
  const fields=["documentId","lineId","kind","occurredOn","currency","net","tax","gross","discount","customer","product","reversesDocumentId"] as const;
  const safe=(v:unknown)=>'"'+(typeof v==="number"?String(v):String(v??"").replace(/^[\s]*[=+\-@]|^[\t\r]/,"'$&")).replace(/"/g,'""')+'"';
  const lines=[fields.join(","),...snapshot.records.map(r=>fields.map(f=>safe(r[f])).join(","))];
  return new Response("\uFEFF"+lines.join("\r\n"),{headers:{...headers,"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="GIE360-${id}-${batch.state}.csv"`}});
 }
 const {data:file,error}=await supabase.storage.from("gie360-import-originals").download(batch.source_path);
 if(error||!file)return NextResponse.json({error:"Original indisponível; contacte o gestor."},{status:503});
 const buffer=Buffer.from(await file.arrayBuffer());if(createHash("sha256").update(buffer).digest("hex")!==batch.original_sha256)return NextResponse.json({error:"Falha de integridade do original."},{status:409});
 const extension=batch.source_path.endsWith(".xlsx")?"xlsx":"csv";
 return new Response(buffer,{headers:{...headers,"Content-Type":extension==="xlsx"?"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="GIE360-original-${id}.${extension}"`}});
}
