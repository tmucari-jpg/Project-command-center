import {it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
it('runs actual expiry lookup SQL against isolated Postgres and rejects expired, revoked, malformed tokens and rate exhaustion',async()=>{
 const db=new PGlite();try{
 await db.exec(`create schema private;
 create table client_diagnostic_requests(id uuid primary key default gen_random_uuid(),token_hash text,status text,expires_at timestamptz,updated_at timestamptz,opened_at timestamptz,client_name text,client_organization text,public_context text,questionnaire_version text);
 create function private.consume_client_diagnostic_rate_limit(uuid,text,integer,integer) returns boolean language sql as $$select coalesce(current_setting('test.rate_allowed',true),'true')<>'false'$$;
 insert into client_diagnostic_requests(token_hash,status,expires_at) values(repeat('a',64),'active',now()+interval '1 hour'),(repeat('b',64),'active',now()-interval '1 second'),(repeat('c',64),'revoked',now()+interval '1 day');`);
 await db.exec(await readFile('../supabase/migrations/20261030162500_diagnostic_expired_tokens.sql','utf8'));
 const lookup=(hash:string)=>db.query<{status:string}>('select * from client_diagnostic_lookup($1)',[hash]);
 expect((await lookup('a'.repeat(64))).rows[0].status).toBe('opened');
 expect((await lookup('b'.repeat(64))).rows).toHaveLength(0);
 expect((await lookup('c'.repeat(64))).rows).toHaveLength(0);
 expect((await lookup('invalid')).rows).toHaveLength(0);
 await db.exec("set test.rate_allowed='false'");expect((await lookup('a'.repeat(64))).rows).toHaveLength(0);
 }finally{await db.close();}
},30000);
