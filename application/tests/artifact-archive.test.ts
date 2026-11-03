import {beforeAll,afterAll,describe,it,expect} from "vitest";
import {PGlite} from "@electric-sql/pglite";
import {readFile} from "node:fs/promises";
const owner="10000000-0000-4000-8000-000000000001",other="10000000-0000-4000-8000-000000000002",admin="10000000-0000-4000-8000-000000000003";
const deliverable="20000000-0000-4000-8000-000000000001",version="30000000-0000-4000-8000-000000000001";
const path=`${owner}/${deliverable}/${version}/PCC_document.pdf`;
let db:PGlite;
async function as(user:string){await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub='${user}';`);}
const files={pdf:{path,sha256:"a".repeat(64),mime:"application/pdf",size:123}};
const finalize=()=>db.query("select public.finalize_generated_deliverable($1,$2,'document',$3::jsonb,'{}'::jsonb)",[version,deliverable,JSON.stringify(files)]);
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(`create role anon; create role authenticated;
 create schema auth;create schema private;create schema storage;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create function private.is_global_admin() returns boolean language sql stable as $$ select auth.uid()='${admin}'::uuid $$;
 create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
 grant usage on schema auth,private,storage to authenticated;
 create table public.profiles(id uuid primary key);
 insert into public.profiles values('${owner}'),('${other}'),('${admin}');
 create table public.deliverables(id uuid primary key,user_id uuid,project_id uuid,title text,status text default 'pending',locked_at timestamptz,artifact_url text,artifact_reference text,qa_status text,acceptance_status text,accepted_at timestamptz);
 alter table public.deliverables enable row level security;
 create policy own_deliverables on public.deliverables for all to authenticated using (user_id=auth.uid() or private.is_global_admin()) with check (user_id=auth.uid() or private.is_global_admin());
 create table public.evidence(user_id uuid,project_id uuid,deliverable_id uuid,evidence_type text,title text,description text,url text);
 alter table public.evidence enable row level security;
 create policy own_evidence on public.evidence for all to authenticated using(user_id=auth.uid() or private.is_global_admin()) with check(user_id=auth.uid() or private.is_global_admin());
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint);
 create table storage.objects(bucket_id text,name text);
 alter table storage.objects enable row level security;
 grant select,insert,update on public.deliverables to authenticated;
 grant select,insert on public.evidence,storage.objects to authenticated;
 insert into public.deliverables(id,user_id,title) values('${deliverable}','${owner}','Documento de teste');`);
 await db.exec(await readFile('../supabase/migrations/20261028065323_generated_deliverable_artifacts.sql','utf8'));
},30000);
afterAll(async()=>db?.close());
describe("additive artifact archive in isolated Postgres",()=>{
 it("rejects missing objects and leaves no archive or evidence behind",async()=>{
  await as(owner);await expect(finalize()).rejects.toThrow("missing archived file");
  expect((await db.query('select * from public.generated_deliverable_artifacts')).rows).toHaveLength(0);
  expect((await db.query('select * from public.evidence')).rows).toHaveLength(0);
 });
 it("archives and links evidence atomically without marking accepted or completed",async()=>{
  await as(owner);await db.query("insert into storage.objects values('pcc-deliverable-artifacts',$1)",[path]);await finalize();
  const d=(await db.query<{status:string;acceptance_status:string;artifact_reference:string}>('select * from public.deliverables')).rows[0];
  expect(d.status).toBe('pending');expect(d.acceptance_status).toBe('pending');expect(d.artifact_reference).toBe(`generated:${version}`);
  expect((await db.query('select * from public.evidence')).rows).toHaveLength(1);
 });
 it("retries without duplicate evidence",async()=>{
  await as(owner);await finalize();expect((await db.query('select * from public.evidence')).rows).toHaveLength(1);
 });
 it("isolates another user even with a known artifact id",async()=>{
  await as(other);expect((await db.query('select * from public.generated_deliverable_artifacts')).rows).toHaveLength(0);
  expect((await db.query('select * from storage.objects')).rows).toHaveLength(0);
  await expect(finalize()).rejects.toThrow('inaccessible');
 });
 it("keeps archives append-only even for the global admin",async()=>{
  await as(admin);expect((await db.query('select * from public.generated_deliverable_artifacts')).rows).toHaveLength(1);
  await expect(db.exec('delete from public.generated_deliverable_artifacts')).rejects.toThrow();
  await expect(db.exec('update public.generated_deliverable_artifacts set document_kind=\'closure\'')).rejects.toThrow();
 });
 it("rejects a new generation for a locked deliverable",async()=>{
  await db.exec('reset role');await db.exec(`update public.deliverables set status='completed',locked_at=now()`);await as(owner);
  await expect(finalize()).rejects.toThrow('immutable');
 });
});
