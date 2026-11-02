import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceUser } from "@/lib/auth";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {
  const {id}=await params;if(!z.string().uuid().safeParse(id).success)return NextResponse.json({error:"ID inválido."},{status:400});
  const db=await createClient();const auth=await db.auth.getUser();
  if(auth.error||!auth.data.user)return NextResponse.json({error:"Sessão necessária."},{status:401});
  const user=await resolveWorkspaceUser(db,auth.data.user);
  const {data,error}=await db.from("generated_deliverable_artifacts").select("files,source_snapshot").eq("id",id).eq("user_id",user.id).maybeSingle();
  if(error||!data)return NextResponse.json({error:"Arquivo não encontrado."},{status:404});
  const files=data.files as Record<string,{path:string;sha256:string;mime:string}>;
  const format=new URL(request.url).searchParams.get("format")??(files.pdf?"pdf":files.xlsx?"xlsx":"pptx");
  if(!["pdf","docx","xlsx","pptx"].includes(format)||!files[format])return NextResponse.json({error:"Formato não disponível."},{status:400});
  const file=files[format];const stored=await db.storage.from("pcc-deliverable-artifacts").download(file.path);
  if(stored.error||!stored.data)return NextResponse.json({error:"Ficheiro indisponível."},{status:503});
  const bytes=Buffer.from(await stored.data.arrayBuffer());
  if(createHash("sha256").update(bytes).digest("hex")!==file.sha256)return NextResponse.json({error:"A integridade do ficheiro não foi confirmada."},{status:409});
  const snapshot=data.source_snapshot as {deliverable?:{title?:string};project?:{title?:string}}|null;
  const actualTitle=snapshot?.deliverable?.title?.trim()||snapshot?.project?.title?.trim()||"Entregavel";
  const fileName=actualTitle.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9 _-]/g,"").trim().replace(/\s+/g,"_").slice(0,100)||"Entregavel";
  return new NextResponse(new Uint8Array(bytes),{headers:{"Content-Type":file.mime,"Content-Disposition":`attachment; filename="${fileName}.${format}"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
}
