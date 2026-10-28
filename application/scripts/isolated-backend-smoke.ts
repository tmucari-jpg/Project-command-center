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
 for(let i=0;i<3;i++){
  const email=`pcc-${randomUUID()}@example.test`;
  const user=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(user.error);
  const client=createClient(url,key,{auth:{persistSession:false}});
  const login=await client.auth.signInWithPassword({email,password});assert.ifError(login.error);
  users.push({id:user.data.user!.id,email,client});
 }
 checks.push({name:'two-real-auth-sessions',status:'passed'});
 const owner=users[0],outsider=users[1];
 const project=await owner.client.from('projects').insert({user_id:owner.id,owner_id:owner.id,title:'PCC isolated validation',expected_result:'Verify factual artifact archive',status:'planning',priority:'medium',progress:0,currency:'MZN'}).select('id').single();assert.ifError(project.error);
 const deliverable=await owner.client.from('deliverables').insert({user_id:owner.id,project_id:project.data!.id,title:'Smoke artifact',status:'pending',priority:'medium',progress:0,artifact_type:'document',completion_criteria:'Real private file, readable only by authorized owner'}).select('id').single();assert.ifError(deliverable.error);
 await check('cross-user-project-isolation',async()=>{const r=await outsider.client.from('projects').select('id').eq('id',project.data!.id);assert.ifError(r.error);assert.equal(r.data!.length,0);});
 // Next normalizes route-handler request.url to localhost even when bound to 127.0.0.1.
 const origin='http://localhost:3000';
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

 const clientA=users[1],clientB=users[2];
 const organizations:string[]=[];
 await check('gie360-provisioning-and-product-catalog',async()=>{
  const catalog=await owner.client.from('pcc_products').select('code').eq('code','gie360');assert.ifError(catalog.error);assert.equal(catalog.data!.length,1);
  const packages=await owner.client.from('pcc_product_packages').select('code,price_mzn').eq('product_code','gie360');assert.ifError(packages.error);assert.equal(packages.data!.length,4);assert.equal(packages.data!.find(row=>row.code==='gie360-enterprise')?.price_mzn,32350);
  for(const client of [clientA,clientB]){
   const factory=await owner.client.from('project_factory_cases').insert({user_id:owner.id,title:`GIE360 synthetic ${client.id}`,problem:'Questionnaire validation',project_type:'commercial'}).select('id').single();assert.ifError(factory.error);
   const args={p_case_id:factory.data!.id,p_client_email:client.email,p_name:'Empresa sintética de testes',p_profile:{sector:'Comércio'}};
   const organization=await owner.client.rpc('gie360_provision',args);assert.ifError(organization.error);assert.equal(typeof organization.data,'string');organizations.push(organization.data);
   const retry=await owner.client.rpc('gie360_provision',args);assert.ifError(retry.error);assert.equal(retry.data,organization.data);
  }
 });
 await check('gie360-cross-tenant-rls-and-forbidden-write',async()=>{
  const own=await clientA.client.from('gie360_organizations').select('id');assert.ifError(own.error);assert.deepEqual(own.data!.map(row=>row.id),[organizations[0]]);
  const other=await clientA.client.from('gie360_assessments').select('id').eq('organization_id',organizations[1]);assert.ifError(other.error);assert.equal(other.data!.length,0);
  const unauthorized=await clientA.client.from('gie360_memberships').insert({organization_id:organizations[1],client_user_id:clientA.id});assert(unauthorized.error,'Client must not grant itself another company membership');
  const pcc=await clientA.client.from('project_factory_cases').select('id').eq('user_id',owner.id);assert.ifError(pcc.error);assert.equal(pcc.data!.length,0);
  const ownPccProject=await clientA.client.from('projects').insert({user_id:clientA.id,owner_id:clientA.id,title:'Forbidden client project',expected_result:'Must fail',status:'planning',priority:'medium',progress:0,currency:'MZN'});assert.equal(ownPccProject.error?.code,'42501','GIE client cannot create a PCC project under its own ID');
  const ownPccCase=await clientA.client.from('project_factory_cases').insert({user_id:clientA.id,title:'Forbidden client case',problem:'Must fail',project_type:'commercial'});assert.equal(ownPccCase.error?.code,'42501','GIE client cannot create a PCC factory case under its own ID');
 });
 await check('gie360-resume-conflict-submit-and-idempotent-notification',async()=>{
  const assessment=await clientA.client.from('gie360_assessments').select('id,revision,answers,request_id,factory_case_id').eq('organization_id',organizations[0]).single();assert.ifError(assessment.error);assert.equal(assessment.data!.answers.sector,'Comércio');
  const a=assessment.data!;
  const answers={sector:'Comércio',problems:'Organizar cobranças',costs:'não sei'};
  const draft=await clientA.client.rpc('gie360_save_assessment',{p_assessment_id:a.id,p_expected_revision:a.revision,p_answers:answers,p_submit:false,p_request_key:null});assert.ifError(draft.error);assert.equal(draft.data.status,'draft');
  const resumed=await clientA.client.from('gie360_assessments').select('answers,revision').eq('id',a.id).single();assert.ifError(resumed.error);assert.deepEqual(resumed.data!.answers,answers);assert.equal(resumed.data!.revision,a.revision+1);
  const stale=await clientA.client.rpc('gie360_save_assessment',{p_assessment_id:a.id,p_expected_revision:a.revision,p_answers:answers,p_submit:false,p_request_key:null});assert(stale.error,'Stale draft must fail with revision conflict');
  const crossTenant=await clientB.client.rpc('gie360_save_assessment',{p_assessment_id:a.id,p_expected_revision:a.revision+1,p_answers:answers,p_submit:false,p_request_key:null});assert(crossTenant.error,'Other company must not edit this assessment');
  const requestKey=randomUUID();
  const submitArgs={p_assessment_id:a.id,p_expected_revision:a.revision+1,p_answers:answers,p_submit:true,p_request_key:requestKey};
  const submit=await clientA.client.rpc('gie360_save_assessment',submitArgs);assert.ifError(submit.error);assert.equal(submit.data.status,'submitted');assert(submit.data.information_gaps.includes('costs'));assert(submit.data.information_gaps.includes('documents'));
  const retry=await clientA.client.rpc('gie360_save_assessment',submitArgs);assert.ifError(retry.error);assert.equal(retry.data.revision,submit.data.revision);
  const responses=await owner.client.from('client_diagnostic_responses').select('id,answers').eq('request_id',a.request_id);assert.ifError(responses.error);assert.equal(responses.data!.length,1);assert.equal(responses.data![0].answers.validation_status,'declared');
  const notifications=await owner.client.from('notifications').select('id').eq('type','gie360_submission').eq('related_entity_id',a.factory_case_id);assert.ifError(notifications.error);assert.equal(notifications.data!.length,1);
 });
 await check('gie360-cannot-open-pcc-shell-or-assistant',async()=>{
  const clientCookies=new Map<string,string>();
  const clientSession=createServerClient(url,key,{cookies:{getAll:()=>Array.from(clientCookies,([name,value])=>({name,value})),setAll:values=>{for(const c of values)clientCookies.set(c.name,c.value);}}});
  const login=await clientSession.auth.signInWithPassword({email:clientA.email,password});assert.ifError(login.error);
  const cookie=Array.from(clientCookies,([name,value])=>`${name}=${encodeURIComponent(value)}`).join('; ');
  const dashboard=await fetch(origin+'/dashboard',{headers:{cookie},redirect:'manual'});assert([303,307,308].includes(dashboard.status));assert.match(dashboard.headers.get('location')??'',/\/gie360/);
  const assistant=await fetch(origin+'/api/ai/assist',{method:'POST',headers:{cookie,origin,'Content-Type':'application/json'},body:JSON.stringify({context:'synthetic'})});assert.equal(assistant.status,403);
  const portal=await fetch(origin+'/gie360',{headers:{cookie}});assert.equal(portal.status,200);const html=await portal.text();assert(html.includes('GIE360'));
 });
 await check('gie360-import-original-review-export-and-tenant-boundary',async()=>{
  async function cookieFor(user:typeof clientA){
   const jar=new Map<string,string>();const session=createServerClient(url,key,{cookies:{getAll:()=>Array.from(jar,([name,value])=>({name,value})),setAll:values=>{for(const c of values)jar.set(c.name,c.value);}}});
   const r=await session.auth.signInWithPassword({email:user.email,password});assert.ifError(r.error);return Array.from(jar,([name,value])=>`${name}=${encodeURIComponent(value)}`).join('; ');
  }
  const clientCookie=await cookieFor(clientA),otherCookie=await cookieFor(clientB);
  const csv='document_id,type,date,currency,net,tax,total,discount,customer,product\nTEST-001,invoice,2026-10-01,MZN,100,16,116,0,Cliente sintético,Serviço sintético\n';
  const upload=new FormData();upload.set('organization_id',organizations[0]);upload.set('file',new File([csv],'synthetic-sales.csv',{type:'text/csv'}));
  const uploaded=await fetch(origin+'/gie360/imports/upload',{method:'POST',headers:{cookie:clientCookie,origin},body:upload,redirect:'manual'});assert.equal(uploaded.status,303);assert(new URL(uploaded.headers.get('location')!,origin).searchParams.has('success'));
  const batch=await owner.client.from('gie360_import_batches').select('id,state,original_sha256,snapshot').eq('organization_id',organizations[0]).single();assert.ifError(batch.error);assert.equal(batch.data!.state,'received');assert.equal(batch.data!.original_sha256,createHash('sha256').update(csv).digest('hex'));assert.equal(batch.data!.snapshot.totals.mzn.gross,116);
  const base=`${origin}/gie360/imports/${batch.data!.id}`;
  const original=await fetch(base+'/download',{headers:{cookie:clientCookie}});assert.equal(original.status,200);assert.equal(await original.text(),csv);
  const forbidden=await fetch(base+'/download',{headers:{cookie:otherCookie}});assert.equal(forbidden.status,404);
  const exportDenied=await fetch(base+'/download?format=csv',{headers:{cookie:clientCookie}});assert.equal(exportDenied.status,403);
  async function review(target:string,cookie:string){const form=new FormData();form.set('target',target);form.set('reason','Synthetic review of original/hash/totals only');if(target==='approved'){form.set('ledger_reference','SYNTHETIC-LEDGER-001');form.set('ledger_period_from','2026-10-01');form.set('ledger_period_to','2026-10-01');form.set('ledger_net','100');form.set('ledger_tax','16');form.set('ledger_gross','116');}return fetch(base+'/review',{method:'POST',headers:{cookie,origin},body:form,redirect:'manual'});}
  const clientReview=await review('approved',clientCookie);assert.equal(clientReview.status,303);assert(new URL(clientReview.headers.get('location')!,origin).searchParams.has('error'));
  const inReview=await review('in_review',cookie);assert.equal(inReview.status,303);assert(new URL(inReview.headers.get('location')!,origin).searchParams.has('success'));
  const missingLedger=new FormData();missingLedger.set('target','approved');missingLedger.set('reason','Synthetic approval without evidence must fail');
  const noEvidence=await fetch(base+'/review',{method:'POST',headers:{cookie,origin},body:missingLedger,redirect:'manual'});assert.equal(noEvidence.status,303);assert(new URL(noEvidence.headers.get('location')!,origin).searchParams.has('error'));
  const approval=await review('approved',cookie);assert.equal(approval.status,303);assert(new URL(approval.headers.get('location')!,origin).searchParams.has('success'));
  const approved=await owner.client.from('gie360_import_batches').select('state').eq('id',batch.data!.id).single();assert.ifError(approved.error);assert.equal(approved.data!.state,'approved');
  const configured=await owner.client.rpc('gie360_configure_organization',{p_organization_id:organizations[0],p_package_code:'gie360-enterprise',p_approved_modules:['data','exports'],p_ai_cloud_authorized:false,p_contract_reference:'SYNTHETIC-VALIDATION-ONLY'});assert.ifError(configured.error);
  const exported=await fetch(base+'/download?format=csv',{headers:{cookie:clientCookie}});assert.equal(exported.status,200);assert((await exported.text()).includes('TEST-001'));
  const report=await fetch(base+'/download?format=report',{headers:{cookie:clientCookie}});assert.equal(report.status,200);assert.equal((await report.json()).state,'approved');
  const immutable=await review('rejected',cookie);assert(new URL(immutable.headers.get('location')!,origin).searchParams.has('error'));
 });

}catch(error){checks.push({name:error instanceof Error?error.message:'unknown failure',status:'failed'});throw error;}
finally{await writeFile('../validation-backend.json',JSON.stringify({scope:'throwaway-local-only',checks,physicalDeviceValidated:false,realAIValidated:false},null,2));}

}
main().catch(error=>{console.error(error);process.exitCode=1;});
