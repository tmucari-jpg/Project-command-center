import { readFileSync } from "node:fs";
import {resolve} from "node:path";
import {PGlite} from "@electric-sql/pglite";
import {describe,it,expect} from "vitest";
import {parseGIE360Import} from "../lib/gie360-import";

describe("GIE360 import SQL permissions and immutable review",()=>{
 it("isolates orgs and originals, requires manager review and preserves terminal version",async()=>{
  const db=new PGlite();
  try {
   await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema private;create schema storage;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table public.gie360_organizations(id uuid primary key,manager_user_id uuid not null);
    create table public.gie360_memberships(organization_id uuid,client_user_id uuid);
    create function private.gie360_can_access(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$select auth.uid() is not null and exists(select 1 from public.gie360_organizations o where o.id=p_id and(o.manager_user_id=auth.uid() or exists(select 1 from public.gie360_memberships m where m.organization_id=o.id and m.client_user_id=auth.uid())))$$;
    create function private.gie360_can_manage(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.gie360_organizations where id=p_id and manager_user_id=auth.uid())$$;
    grant usage on schema auth,private,storage to authenticated,service_role;
    grant select on public.gie360_organizations to authenticated,service_role;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),name text,bucket_id text);
    alter table storage.objects enable row level security;grant select,insert on storage.objects to authenticated;
    create function storage.foldername(name text) returns text[] language sql immutable as $$select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1]$$;
    insert into auth.users values('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002'),('00000000-0000-4000-8000-000000000003');
    insert into public.gie360_organizations values('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001');
    insert into public.gie360_memberships values('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002');`);
   await db.exec(readFileSync(resolve(process.cwd(),"../supabase/migrations/20261028115139_gie360_import_archive.sql"),"utf8"));
   const snapshot=await parseGIE360Import(new TextEncoder().encode("documento,tipo,data,moeda,base_tributavel,imposto,total\nFT1,factura,2026-10-01,MZN,100,16,116"),"vendas.csv");
   await db.exec("set role authenticated;select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false)");
   const id="20000000-0000-4000-8000-000000000001";
   const insertSQL="insert into public.gie360_import_batches(id,organization_id,created_by,source_name,source_path,original_sha256,snapshot) values($1,$2,$3,$4,$5,$6,$7::jsonb)";
   const args=[id,"10000000-0000-4000-8000-000000000001","00000000-0000-4000-8000-000000000002","vendas.csv",`10000000-0000-4000-8000-000000000001/${id}/original.csv`,snapshot.originalSha256,JSON.stringify(snapshot)];
   await expect(db.query(insertSQL,args)).rejects.toThrow("permission denied");
   await db.exec("reset role");await db.query(insertSQL,args);
   await db.query("insert into storage.objects(name,bucket_id) values($1,'gie360-import-originals')",[`10000000-0000-4000-8000-000000000001/${id}/original.csv`]);
   await db.exec("set role authenticated;select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false)");
   const reviewSQL="select public.review_gie360_import($1,$2,$3,$4,$5::jsonb)";
   const manager="00000000-0000-4000-8000-000000000001";
   await expect(db.query(reviewSQL,[id,"approved","verified",manager,null])).rejects.toThrow("permission denied");
   await expect(db.query("update public.gie360_import_batches set state='approved' where id=$1",[id])).rejects.toThrow("permission denied");
   await db.exec("select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',false)");
   expect((await db.query("select * from public.gie360_import_batches")).rows).toEqual([]);
   expect((await db.query("select * from storage.objects")).rows).toEqual([]);
   await db.exec("reset role;set role service_role");
   await expect(db.query(reviewSQL,[id,"approved","verified",manager,null])).rejects.toThrow("REVIEW_REQUIRED");
   await expect(db.query(reviewSQL,[id,"in_review","Verificação iniciada","00000000-0000-4000-8000-000000000002",null])).rejects.toThrow("FORBIDDEN");
   await db.query(reviewSQL,[id,"in_review","Verificação iniciada",manager,null]);
   await expect(db.query(reviewSQL,[id,"approved","Original verificado",manager,null])).rejects.toThrow("RECONCILIATION_REQUIRED");
   const reconciliation={status:"matched",comparedFields:["gross"],reference:{sourceReference:"Livro vendas 123",currency:"MZN",periodFrom:"2026-10-01",periodTo:"2026-10-01",gross:116}};
   await db.query(reviewSQL,[id,"approved","Original e valores verificados",manager,JSON.stringify(reconciliation)]);
   expect((await db.query<{state:string}>("select state from public.gie360_import_batches where id=$1",[id])).rows[0].state).toBe("approved");
   expect((await db.query("select * from public.gie360_import_review_events")).rows).toHaveLength(2);
   await expect(db.query(reviewSQL,[id,"rejected","Changed mind",manager,null])).rejects.toThrow("IMMUTABLE_VERSION");
   await db.exec("reset role;set role authenticated");
   await expect(db.query("delete from public.gie360_import_batches where id=$1",[id])).rejects.toThrow("permission denied");
  } finally {await db.close();}
 },20000);
});
