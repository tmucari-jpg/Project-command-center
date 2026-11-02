import {afterEach,describe,it,expect,vi} from "vitest";
vi.mock("@/lib/supabase/server",()=>({createClient:vi.fn()}));
vi.mock("next/navigation",()=>({redirect:vi.fn((path:string)=>{throw new Error(`NEXT_REDIRECT:${path}`);})}));
import {resolveWorkspaceUser} from "@/lib/auth";
import type {createClient} from "@/lib/supabase/server";
afterEach(()=>vi.unstubAllEnvs());
describe("canonical workspace context",()=>{
 it("resolves an authorized secondary administrator to the same owner while retaining its actor externally",async()=>{
  vi.stubEnv("PCC_ADMIN_EMAILS","admin@test.example");
  const query:Record<string,unknown>={};for(const method of ["select","eq","is","order","limit"])query[method]=()=>query;
  query.maybeSingle=async()=>({data:{user_id:"workspace-owner"},error:null});
  const db={from:()=>query} as unknown as Awaited<ReturnType<typeof createClient>>;
  const actor={id:"admin-actor",email:"admin@test.example"};
  expect((await resolveWorkspaceUser(db,actor)).id).toBe("workspace-owner");expect(actor.id).toBe("admin-actor");
 });
 it("does not remap an ordinary account",async()=>{
  vi.stubEnv("PCC_ADMIN_EMAILS","");
  const query:Record<string,unknown>={};for(const method of ["select","eq"])query[method]=()=>query;
  query.limit=async()=>({data:[],error:null});
  query.in=async()=>({data:[],error:null});const db={from:()=>query} as unknown as Awaited<ReturnType<typeof createClient>>;
  expect((await resolveWorkspaceUser(db,{id:"ordinary",email:"user@test.example"})).id).toBe("ordinary");
 });
 it("never remaps a provisioned client even if its email is in the admin configuration",async()=>{
  vi.stubEnv("PCC_ADMIN_EMAILS","client@test.example");
  const query:Record<string,unknown>={};for(const method of ["select","eq"])query[method]=()=>query;
  query.limit=async()=>({data:[{organization_id:"company"}],error:null});
  const db={from:()=>query} as unknown as Awaited<ReturnType<typeof createClient>>;
  await expect(resolveWorkspaceUser(db,{id:"client",email:"client@test.example"})).rejects.toThrow("NEXT_REDIRECT:/gie360");
 });
});
