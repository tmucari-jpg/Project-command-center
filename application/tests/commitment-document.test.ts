// Route + native render integration. Database reads are synthetic fixtures, not a Supabase acceptance test.
import { it, expect, vi } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
const fixture=vi.hoisted(()=>({status:'internal_approved'}));
vi.mock('@/lib/auth',()=>({resolveWorkspaceUser:async()=>({id:'10000000-0000-4000-8000-000000000001'})}));
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({
 auth:{getUser:async()=>({data:{user:{id:'10000000-0000-4000-8000-000000000001'}},error:null})},
 from:(table:string)=>{
  const result=table==='projects'?{id:'20000000-0000-4000-8000-000000000001',title:'Empresa QA Sintética',expected_result:'Validar documentos de ensaio',currency:'MZN'}:
  [{id:'30000000-0000-4000-8000-000000000001',version:1,status:fixture.status,expected_result:'Validar documentos de ensaio',scope:'Diagnóstico sintético',exclusions:'Sem dados ou serviços de produção',deliverables_summary:'DOCX e PDF de ensaio',pcc_responsibilities:'Gerar ficheiros verificáveis',client_responsibilities:'Rever dados sintéticos',external_costs_terms:'Sem custo adicional',acceptance_terms:'Ficheiros com conteúdo coerente',security_conditions:'Sem dados pessoais reais'}];
  const q:Record<string,unknown>={};for(const k of ['select','eq','in','order'])q[k]=()=>q;
  q.maybeSingle=async()=>({data:result,error:null});q.limit=async()=>({data:result,error:null});return q;
 }
})}));
import {GET} from '@/app/api/projects/[id]/commitment-draft/route';
const id='20000000-0000-4000-8000-000000000001';
it('does not generate an unapproved draft, and returns real native files after synthetic internal approval',async()=>{
 fixture.status='draft';expect((await GET(new Request(`http://localhost/api/projects/${id}/commitment-draft`),{params:Promise.resolve({id})})).status).toBe(409);
 fixture.status='internal_approved';
 for(const format of ['docx','pdf']){
   const r=await GET(new Request(`http://localhost/api/projects/${id}/commitment-draft?format=${format}`),{params:Promise.resolve({id})});
   expect(r.status).toBe(200);expect(r.headers.get('cache-control')).toBe('private, no-store');
   expect(r.headers.get('content-disposition')).toContain(`Carta_de_Compromisso_Empresa_QA_Sintetica_v1.${format}`);
   const bytes=Buffer.from(await r.arrayBuffer());expect(bytes.length).toBeGreaterThan(1000);
   expect(bytes.subarray(0,format==='pdf'?4:2).toString()).toBe(format==='pdf'?'%PDF':'PK');
   if(process.env.PCC_WRITE_QA_FIXTURES==='true'){
     await mkdir('../evidence/documents',{recursive:true});await writeFile(`../evidence/documents/Carta_G3_ENSAIO_SINTETICO.${format}`,bytes);
   }
 }
},30000);
