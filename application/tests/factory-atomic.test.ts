import {it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
it('converts once and rolls back project creation when downstream linkage fails',async()=>{
 const db=new PGlite();const user='10000000-0000-4000-8000-000000000001',id='20000000-0000-4000-8000-000000000001';
 try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema private;
 create function auth.uid() returns uuid language sql as $$select '${user}'::uuid$$;
 create function private.is_global_admin() returns boolean language sql as $$select false$$;
 create table projects(id uuid default gen_random_uuid(),user_id uuid,title text,description text,expected_result text,priority text,status text,progress integer,notes text,owner_id uuid,currency text,governance_gate text,governance_gate_status text);
 create table project_factory_cases(id uuid,user_id uuid,project_id uuid,title text,description text,expected_value text,source text,stage text,governance_gate text,governance_gate_status text,g2_completed_at timestamptz);
 create table factory_validations(factory_case_id uuid,user_id uuid,viability_status text);
 create table project_governance_risks(factory_case_id uuid,user_id uuid,gate text,blocks_progress boolean,status text);
 create table factory_reports(factory_case_id uuid,user_id uuid,status text,final_decision text,decision_rationale text,decided_at timestamptz);
 insert into project_factory_cases(id,user_id,title)values('${id}','${user}','Test');
 insert into factory_validations values('${id}','${user}','viable');insert into factory_reports(factory_case_id,user_id)values('${id}','${user}');
 create function reject_link()returns trigger language plpgsql as $$begin raise exception 'Injected failure';end;$$;
 create trigger reject_link before update on project_factory_cases for each row execute function reject_link();`);
 await db.exec(await readFile('../supabase/migrations/20261028072750_atomic_factory_conversion.sql','utf8'));
 await expect(db.query('select convert_factory_case_atomic($1,$2)',[id,''])).rejects.toThrow('rationale');
 await db.exec(`insert into project_governance_risks values('${id}','${user}','g2_viability',true,'open')`);
 await expect(db.query('select convert_factory_case_atomic($1,$2)',[id,'Explicit decision'])).rejects.toThrow('Blocking governance risk');
 await db.exec(`update project_governance_risks set status='accepted'`);
 const run=()=>db.query('select convert_factory_case_atomic($1,$2) as id',[id,'Explicit decision']);
 await expect(run()).rejects.toThrow('Injected failure');expect((await db.query('select * from projects')).rows).toHaveLength(0);expect((await db.query('select final_decision from factory_reports')).rows[0]).toEqual({final_decision:null});
 await db.exec('drop trigger reject_link on project_factory_cases');const first=await run();const second=await run();expect(first.rows).toEqual(second.rows);expect((await db.query('select * from projects')).rows).toHaveLength(1);
 await db.exec('delete from projects');await expect(run()).rejects.toThrow('Linked project inaccessible');
 }finally{await db.close();}
},30000);
