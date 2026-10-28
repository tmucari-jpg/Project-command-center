import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
import {randomUUID,createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
async function main(){
const url=process.env.NEXT_PUBLIC_SUPABASE_URL!;
assert(['localhost','127.0.0.1'].includes(new URL(url).hostname)&&new URL(url).protocol==='http:'&&new URL(url).port==='54321','Local backend only');
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const admin=createClient(url,process.env.PCC_LOCAL_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});
const checks:Array<{name:string;status:string}>=[];
async function check(name:string,fn:()=>Promise<void>){await fn();checks.push({name,status:'passed'});}
const password=`Pcc-Local-${randomUUID()}!`;
const users=[];
try{
 for(let i=0;i<2;i++){
  const email=`pcc-${randomUUID()}@example.test`;
  const user=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(user.error);
  const client=createClient(url,key,{auth:{persistSession:false}});
  const login=await client.auth.signInWithPassword({email,password});assert.ifError(login.error);
  users.push({id:user.data.user!.id,client});
 }
 checks.push({name:'two-real-auth-sessions',status:'passed'});
 const owner=users[0],outsider=users[1];
 const project=await owner.client.from('projects').insert({user_id:owner.id,owner_id:owner.id,title:'PCC isolated validation',expected_result:'Verify factual artifact archive',status:'planning',priority:'medium',progress:0,currency:'MZN'}).select('id').single();assert.ifError(project.error);
 const deliverable=await owner.client.from('deliverables').insert({user_id:owner.id,project_id:project.data!.id,title:'Smoke artifact',status:'pending',priority:'medium',progress:0,artifact_type:'document',completion_criteria:'Real private file, readable only by authorized owner'}).select('id').single();assert.ifError(deliverable.error);
 await check('cross-user-project-isolation',async()=>{const r=await outsider.client.from('projects').select('id').eq('id',project.data!.id);assert.ifError(r.error);assert.equal(r.data!.length,0);});
 const origin='http://127.0.0.1:3000';
 for(let i=0;i<30;i++){try{const r=await fetch(origin+'/manifest.webmanifest');if(r.ok)break;}catch{}if(i===29)throw Error('Application did not start');await new Promise(r=>setTimeout(r,1000));}
 const cookies=new Map<string,string>();
 const session=createServerClient(url,key,{cookies:{getAll:()=>Array.from(cookies,([name,value])=>({name,value})),setAll:values=>{for(const c of values)cookies.set(c.name,c.value);}}});
 const userInfo=await admin.auth.admin.getUserById(owner.id);assert.ifError(userInfo.error);
 const login=await session.auth.signInWithPassword({email:userInfo.data.user.email!,password});assert.ifError(login.error);
 const cookie=Array.from(cookies,([name,value])=>`${name}=${encodeURIComponent(value)}`).join('; ');
 const version=randomUUID();
 const endpoint=`${origin}/api/deliverables/${deliverable.data!.id}/generate`;
 await check('authenticated-document-generation-and-idempotency',async()=>{
  for(let i=0;i<2;i++){
   const r=await fetch(endpoint,{method:'POST',headers:{origin,cookie,'Content-Type':'application/json'},body:JSON.stringify({kind:'document',requestId:version,reviewedContent:'Conteúdo factual de teste, sem dados de produção.'})});
   assert(r.ok,`Generation failed HTTP ${r.status}: ${await r.text()}`);
  }
  const e=await owner.client.from('evidence').select('id').eq('deliverable_id',deliverable.data!.id);assert.ifError(e.error);assert.equal(e.data!.length,1);
 });
 await check('authenticated-pdf-docx-download-and-private-storage',async()=>{
  for(const format of ['pdf','docx']){
   const r=await fetch(`${origin}/api/deliverables/artifacts/${version}/download?format=${format}`,{headers:{cookie}});assert.equal(r.status,200);
   const bytes=Buffer.from(await r.arrayBuffer());assert(bytes.length>1000);assert.equal(bytes.subarray(0,format==='pdf'?4:2).toString(),format==='pdf'?'%PDF':'PK');
  }
  const denied=await fetch(`${origin}/api/deliverables/artifacts/${version}/download`);assert.equal(denied.status,401);
  const row=await owner.client.from('generated_deliverable_artifacts').select('files').eq('id',version).single();assert.ifError(row.error);
  for(const file of Object.values(row.data!.files) as Array<{path:string;sha256:string}>){
   const downloaded=await owner.client.storage.from('pcc-deliverable-artifacts').download(file.path);assert.ifError(downloaded.error);
   assert.equal(createHash('sha256').update(Buffer.from(await downloaded.data!.arrayBuffer())).digest('hex'),file.sha256);
   const other=await outsider.client.storage.from('pcc-deliverable-artifacts').download(file.path);assert(other.error);
  }
 });

}catch(error){checks.push({name:error instanceof Error?error.message:'unknown failure',status:'failed'});throw error;}
finally{await writeFile('../validation-backend.json',JSON.stringify({scope:'throwaway-local-only',checks,physicalDeviceValidated:false,realAIValidated:false},null,2));}

}
main().catch(error=>{console.error(error);process.exitCode=1;});
