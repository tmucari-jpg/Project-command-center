import { it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
const owner="10000000-0000-4000-8000-000000000001",other="10000000-0000-4000-8000-000000000002";
const project="20000000-0000-4000-8000-000000000001",baseline="30000000-0000-4000-8000-000000000001";
async function setup(){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema private;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function private.is_global_admin() returns boolean language sql as $$select false$$;
 grant usage on schema auth,private to authenticated;
 create table projects(id uuid primary key,user_id uuid,governance_gate text default 'g3_planning',governance_gate_status text default 'in_progress',status text default 'planning');
 create table project_commitment_baselines(id uuid primary key,user_id uuid,project_id uuid,version integer,status text,capacity_summary text,cost_summary text,security_conditions text,internal_approved_at timestamptz,client_validation_reference text,client_approved_at timestamptz);
 create table project_governance_risks(project_id uuid,user_id uuid,gate text,blocks_progress boolean,status text);
 create table project_governance_dependencies(project_id uuid,user_id uuid,gate text,blocks_progress boolean,status text);
 create table project_gate_events(user_id uuid,project_id uuid,gate text,event_type text,decision text,rationale text,created_by uuid);
 create table project_factory_cases(id uuid primary key,user_id uuid);
 create table client_diagnostic_requests(id uuid primary key default gen_random_uuid(),user_id uuid,factory_case_id uuid,token_hash text unique,questionnaire_version text,client_name text,client_organization text,public_context text,status text,expires_at timestamptz);
 create table pcc_external_share_approvals(request_id uuid unique,factory_case_id uuid,manager_user_id uuid,audience_name text,audience_organization text,public_context text,content_sha256 text,expires_at timestamptz);
 grant select,insert,update on all tables in schema public to authenticated;
 insert into projects(id,user_id) values('${project}','${owner}');
 insert into project_factory_cases values('${project}','${owner}');
 insert into project_commitment_baselines(id,user_id,project_id,version,status,capacity_summary,cost_summary,security_conditions)
 values('${baseline}','${owner}','${project}',1,'draft','Equipa de ensaio','Sem custo adicional','Dados sintéticos');
 set request.jwt.claim.sub='${owner}';`);
 await db.exec(await readFile('../supabase/migrations/20261102081522_operational_atomic_transitions.sql','utf8'));
 await db.exec('set role authenticated');return db;
}
it('rolls back G3 state and audit on downstream failure and requires explicit client validation',async()=>{
 const db=await setup();const approve=(client=false,reference:string|null=null)=>db.query('select approve_commitment_atomic($1,$2,$3,$4)',[project,baseline,client,reference]);
 try{
 await db.exec(`reset role;create function reject_event() returns trigger language plpgsql as $$begin raise exception 'Injected audit failure';end;$$;create trigger reject_event before insert on project_gate_events for each row execute function reject_event();set role authenticated;`);
 await expect(approve()).rejects.toThrow('Injected audit failure');
 expect((await db.query('select status from project_commitment_baselines')).rows[0]).toEqual({status:'draft'});
 expect((await db.query('select governance_gate_status from projects')).rows[0]).toEqual({governance_gate_status:'in_progress'});
 await db.exec('reset role;drop trigger reject_event on project_gate_events;set role authenticated');
 await expect(approve(true,'Confirmação de ensaio')).rejects.toThrow('Internal approval required');
 await db.query("insert into project_governance_dependencies values($1,$2,'g3_planning',true,'pending')",[project,owner]);
 await expect(approve()).rejects.toThrow('Blocking G3');await db.exec("update project_governance_dependencies set status='resolved'");
 await approve();await expect(approve()).rejects.toThrow('Draft baseline required');await expect(approve(true)).rejects.toThrow('Explicit client reference required');
 await db.exec(`set request.jwt.claim.sub='${other}'`);await expect(approve(true,'Tentativa externa')).rejects.toThrow('Project inaccessible');
 await db.exec(`set request.jwt.claim.sub='${owner}'`);await approve(true,'ENSAIO — confirmação explícita no teste, sem aprovação de produção');
 expect((await db.query('select status from project_commitment_baselines')).rows[0]).toEqual({status:'client_approved'});
 expect((await db.query('select governance_gate from projects')).rows[0]).toEqual({governance_gate:'g4_execution'});
 expect((await db.query('select * from project_gate_events')).rows).toHaveLength(2);
 }finally{await db.close();}
},30000);
it('keeps the original link valid when share audit fails and denies unreviewed issuance',async()=>{
 const db=await setup();const issue=(reviewed:boolean)=>db.query("select issue_reviewed_diagnostic_atomic($1,$2,$3,$4,$5,now()+interval '7 days',$6,$7)",[project,'b'.repeat(64),'Destinatário sintético','Empresa QA','Contexto aprovado de ensaio','c'.repeat(64),reviewed]);
 try{
 await db.query("insert into client_diagnostic_requests(user_id,factory_case_id,token_hash,status) values($1,$2,$3,'active')",[owner,project,'a'.repeat(64)]);
 await expect(issue(false)).rejects.toThrow('Explicit internal review required');
 await db.exec(`reset role;create function reject_share() returns trigger language plpgsql as $$begin raise exception 'Injected share audit failure';end;$$;create trigger reject_share before insert on pcc_external_share_approvals for each row execute function reject_share();set role authenticated;`);
 await expect(issue(true)).rejects.toThrow('Injected share audit failure');
 expect((await db.query('select status from client_diagnostic_requests')).rows).toEqual([{status:'active'}]);
 await db.exec('reset role;drop trigger reject_share on pcc_external_share_approvals;set role authenticated');
 await db.exec(`set request.jwt.claim.sub='${other}'`);await expect(issue(true)).rejects.toThrow('Case owner required');
 await db.exec(`set request.jwt.claim.sub='${owner}'`);await issue(true);
 expect((await db.query('select status from client_diagnostic_requests order by token_hash')).rows).toEqual([{status:'revoked'},{status:'active'}]);
 expect((await db.query('select * from pcc_external_share_approvals')).rows).toHaveLength(1);
 }finally{await db.close();}
},30000);

it("enforces one change request per client link decision at the database layer",async()=>{
 const db=new PGlite();
 const response="40000000-0000-4000-8000-000000000001";
 try{
  await db.exec(`create table public.project_client_status_decisions(id uuid primary key);
    create table public.project_change_requests(id uuid primary key, description text);
    insert into public.project_client_status_decisions values('${response}');`);
  await db.exec(await readFile("../supabase/migrations/20261103090000_unique_client_change_request_source.sql","utf8"));
  await db.query("insert into public.project_change_requests(id,description,source_client_decision_id) values($1,$2,$3)",["50000000-0000-4000-8000-000000000001","Original",response]);
  await expect(db.query("insert into public.project_change_requests(id,description,source_client_decision_id) values($1,$2,$3)",["50000000-0000-4000-8000-000000000002","Duplicado",response])).rejects.toThrow();
  expect((await db.query("select id from public.project_change_requests")).rows).toHaveLength(1);
  await expect(db.query("insert into public.project_change_requests(id,description,source_client_decision_id) values($1,$2,$3)",["50000000-0000-4000-8000-000000000003","Resposta inexistente","40000000-0000-4000-8000-000000000002"])).rejects.toThrow();
 }finally{await db.close();}
},30000);


it("atomically creates a new G3 revision or rolls back the client change decision",async()=>{
 const db=new PGlite();
 const req="40000000-0000-4000-8000-000000000001";
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema private;
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  create function private.is_global_admin() returns boolean language sql stable as $$select false$$;
  grant usage on schema auth,private to authenticated;
  create table projects(id uuid primary key,user_id uuid,governance_gate text,governance_gate_status text,status text);
  create table project_change_requests(id uuid primary key,user_id uuid,project_id uuid,decision text default 'pending',decision_rationale text,decided_at timestamptz);
  create table project_commitment_baselines(
   id uuid primary key default gen_random_uuid(),user_id uuid,project_id uuid,version integer,
   information_classification text default 'internal',expected_result text,scope text,exclusions text,
   deliverables_summary text,pcc_responsibilities text,client_responsibilities text,
   external_costs_terms text,acceptance_terms text,security_conditions text,
   capacity_summary text,cost_summary text,status text,created_by uuid);
  grant select,insert,update on all tables in schema public to authenticated;
  insert into projects values('${project}','${owner}','g4_execution','ready','active');
  insert into project_change_requests(id,user_id,project_id,decision) values('${req}','${owner}','${project}','pending');
  insert into project_commitment_baselines(id,user_id,project_id,version,expected_result,scope,deliverables_summary,acceptance_terms,status)
    values('${baseline}','${owner}','${project}',1,'Resultado aprovado','Âmbito aprovado','Entregáveis aprovados','Aceitação','client_approved');
  set request.jwt.claim.sub='${owner}';`);
  await db.exec(await readFile("../supabase/migrations/20261103091500_atomic_change_request_decision.sql","utf8"));
  await db.exec("set role authenticated");
  const decide=()=>db.query("select public.decide_project_change_request_atomic($1,$2,'approved','Alteração analisada')",[project,req]);
  await db.exec("reset role; create function fail_revision() returns trigger language plpgsql as $$ begin raise exception 'revision failure injected'; end $$; create trigger fail_revision before insert on project_commitment_baselines for each row execute function fail_revision(); set role authenticated");
  await expect(decide()).rejects.toThrow("revision failure injected");
  expect((await db.query("select decision from project_change_requests")).rows[0]).toEqual({decision:"pending"});
  expect((await db.query("select status from projects")).rows[0]).toEqual({status:"active"});
  await db.exec("reset role; drop trigger fail_revision on project_commitment_baselines; set role authenticated");
  await decide();
  expect((await db.query("select version,status from project_commitment_baselines order by version")).rows).toEqual([{version:1,status:"client_approved"},{version:2,status:"draft"}]);
  expect((await db.query("select decision from project_change_requests")).rows[0]).toEqual({decision:"approved"});
  await expect(decide()).rejects.toThrow("CHANGE_REQUEST_ALREADY_DECIDED");
  expect((await db.query("select count(*)::integer as n from project_commitment_baselines")).rows[0]).toEqual({n:2});
 } finally {await db.close();}
},30000);
