import { randomUUID, createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceUser } from "@/lib/auth";
import { loadArtifactSnapshot } from "@/lib/artifacts/snapshot";
import { artifactInformationGaps } from "@/lib/artifacts/readiness";
import { verifyArchivedBytes } from "@/lib/artifacts/integrity";
import { renderArtifact } from "@/lib/artifacts/render";
export const runtime="nodejs";
const schema=z.object({ requestId:z.string().uuid().optional(),kind:z.enum(["master_mind","master_plan","commercial_guide","diagnosis","decision","progress","closure","document","spreadsheet","presentation"]),reviewedContent:z.string().trim().max(50000).optional(),confirmNewVersion:z.boolean().default(false) });
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
  if(process.env.PCC_ARTIFACT_GENERATION_ENABLED!=="true")return NextResponse.json({error:"Geração ainda não activada neste ambiente de testes."},{status:503});
  if(request.headers.get("origin")!==new URL(request.url).origin)return NextResponse.json({error:"Origem inválida."},{status:403});
  const {id}=await params;if(!z.string().uuid().safeParse(id).success)return NextResponse.json({error:"ID inválido."},{status:400});
  const db=await createClient();const auth=await db.auth.getUser();
  if(auth.error||!auth.data.user)return NextResponse.json({error:"Sessão necessária."},{status:401});
  const user=await resolveWorkspaceUser(db,auth.data.user);
  const body=schema.safeParse(await request.json().catch(()=>null));
  if(!body.success)return NextResponse.json({error:"Pedido inválido."},{status:400});
  const version=body.data.requestId??randomUUID();
  const prior=await db.from("generated_deliverable_artifacts").select("id,deliverable_id,document_kind,source_snapshot,files").eq("id",version).eq("user_id",user.id).maybeSingle();
  if(prior.error)return NextResponse.json({error:"Arquivo indisponível; verificar a migração do ambiente de testes."},{status:503});
  if(prior.data){
    if(prior.data.deliverable_id!==id)return NextResponse.json({error:"Pedido já utilizado noutro entregável."},{status:409});
    const priorSnapshot=prior.data.source_snapshot as Awaited<ReturnType<typeof loadArtifactSnapshot>>;
    if(prior.data.document_kind!==body.data.kind || priorSnapshot.reviewedContent!==body.data.reviewedContent)return NextResponse.json({error:"A referência pertence a outro conteúdo; inicie uma nova versão."},{status:409});
    return NextResponse.json({informationGaps:artifactInformationGaps(priorSnapshot),formats:Object.keys(prior.data.files),id:version,download:`/api/deliverables/artifacts/${version}/download`,reused:true});
  }
  try {
    let snapshot=await loadArtifactSnapshot(db,user.id,id,version,body.data.kind,body.data.reviewedContent);
    const snapshotPath=`${user.id}/${id}/${version}/snapshot.json`;
    const storage=db.storage.from("pcc-deliverable-artifacts");
    const existingSnapshot=await storage.download(snapshotPath);
    if(existingSnapshot.data){
      const saved=JSON.parse(await existingSnapshot.data.text()) as typeof snapshot;
      if(saved.kind!==body.data.kind||saved.deliverable.id!==id||saved.reviewedContent!==body.data.reviewedContent) return NextResponse.json({error:"A referência pertence a outro conteúdo; inicie uma nova versão."},{status:409});
      // Recheck the live deliverable lock above, but render the immutable source of this operation.
      snapshot=saved;
    }
    const supported=["document","pdf","spreadsheet","presentation"];
    if(!supported.includes(String(snapshot.deliverable.artifact_type)))return NextResponse.json({error:"Este resultado exige um artefacto funcional próprio; não será substituído por um documento."},{status:422});
    const type=snapshot.deliverable.artifact_type;
    if((type==="spreadsheet"&&body.data.kind!=="spreadsheet")||(type==="presentation"&&body.data.kind!=="presentation")||(["document","pdf"].includes(String(type))&&["spreadsheet","presentation"].includes(body.data.kind)))return NextResponse.json({error:"O formato deve corresponder ao entregável registado."},{status:422});
    if(snapshot.deliverable.artifact_url&&!body.data.confirmNewVersion)return NextResponse.json({error:"Confirme a geração de nova versão; o vínculo actual consta do snapshot e o arquivo anterior é preservado."},{status:409});
    if(!existingSnapshot.data){
      const saved=await storage.upload(snapshotPath,Buffer.from(JSON.stringify(snapshot)),{contentType:"application/json",upsert:false});
      if(saved.error)throw new Error("ARCHIVE_SNAPSHOT_FAILED");
    }
    const manifestPath=`${user.id}/${id}/${version}/manifest.json`;
    type ArchivedFile={path:string;sha256:string;mime:string;size:number};
    const files:Record<string,ArchivedFile>={};
    const priorManifest=await storage.download(manifestPath);
    if(priorManifest.data){
      const manifest=JSON.parse(await priorManifest.data.text()) as Record<string,ArchivedFile>;
      const expectedFormats=body.data.kind==="spreadsheet"?["xlsx"]:body.data.kind==="presentation"?["pptx"]:["docx","pdf"];
      if(Object.keys(manifest).sort().join()!==expectedFormats.sort().join())throw new Error("ARCHIVE_INTEGRITY_FAILED");
      for(const [extension,file] of Object.entries(manifest)){
        if(file.path!==`${user.id}/${id}/${version}/PCC_${body.data.kind}.${extension}`||file.size>20*1024*1024)throw new Error("ARCHIVE_INTEGRITY_FAILED");
        const priorFile=await storage.download(file.path);
        // Missing bytes cannot safely be reconstructed with a different checksum under the same version.
        if(priorFile.error||!priorFile.data)throw new Error("ARCHIVE_RETRY_REQUIRES_NEW_VERSION");
        verifyArchivedBytes(new Uint8Array(await priorFile.data.arrayBuffer()),file);
        files[extension]=file;
      }
    }else{
      const generated=await renderArtifact(snapshot);
      for(const file of generated){
        if(file.bytes.length>20*1024*1024)throw new Error("FILE_TOO_LARGE");
        files[file.extension]={path:`${user.id}/${id}/${version}/PCC_${body.data.kind}.${file.extension}`,sha256:createHash("sha256").update(file.bytes).digest("hex"),mime:file.mime,size:file.bytes.length};
      }
      // Reserve the immutable checksums before uploading bytes. A concurrent attempt must retry.
      const manifestUpload=await storage.upload(manifestPath,Buffer.from(JSON.stringify(files)),{contentType:"application/json",upsert:false});
      if(manifestUpload.error)throw new Error("ARCHIVE_MANIFEST_CONFLICT_RETRY");
      for(const file of generated){
        const archived=files[file.extension];
        const uploaded=await storage.upload(archived.path,file.bytes,{contentType:file.mime,upsert:false,metadata:{sha256:archived.sha256}});
        if(uploaded.error){
          const priorFile=await storage.download(archived.path);
          if(priorFile.error||!priorFile.data)throw new Error("ARCHIVE_UPLOAD_FAILED");
          verifyArchivedBytes(new Uint8Array(await priorFile.data.arrayBuffer()),archived);
        }
      }
    }
    const finalized=await db.rpc("finalize_generated_deliverable",{p_id:version,p_deliverable_id:id,p_kind:body.data.kind,p_files:files,p_snapshot:snapshot});
    if(finalized.error)throw new Error("ARCHIVE_FINALIZE_FAILED");
    return NextResponse.json({id:version,download:`/api/deliverables/artifacts/${version}/download`,formats:Object.keys(files),state:"draft",informationGaps:artifactInformationGaps(snapshot),message:"Ficheiros gerados e arquivados; QA e aceitação continuam pendentes."},{status:201});
  } catch(e) {
    const code=e instanceof Error?e.message:"GENERATION_FAILED";
    const status=code==="DELIVERABLE_NOT_FOUND"||code==="PROJECT_NOT_FOUND"?404:code==="DELIVERABLE_LOCKED"?409:500;
    // Do not delete objects on partial failure. The operation can be diagnosed without losing data.
    return NextResponse.json({error:code,requestId:version,message:"Não foi declarada conclusão nem aceitação. Verifique o arquivo antes de repetir."},{status});
  }
}
