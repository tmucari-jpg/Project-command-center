import {describe,it,expect,vi,afterEach} from "vitest";
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>({auth:{getUser:async()=>({data:{user:null},error:null})}})}));
import {POST} from "@/app/api/deliverables/[id]/generate/route";
import {GET} from "@/app/api/deliverables/artifacts/[id]/download/route";
const id="20000000-0000-4000-8000-000000000001";
afterEach(()=>vi.unstubAllEnvs());
describe("artifact API guards",()=>{
 it("does not enable generation until staging is configured",async()=>{
  vi.stubEnv("PCC_ARTIFACT_GENERATION_ENABLED","false");expect((await POST(new Request(`http://localhost/api/deliverables/${id}/generate`),{params:Promise.resolve({id})})).status).toBe(503);
 });
 it("rejects cross-origin generation before accessing storage",async()=>{
  vi.stubEnv("PCC_ARTIFACT_GENERATION_ENABLED","true");expect((await POST(new Request(`http://localhost/api/deliverables/${id}/generate`,{method:"POST",headers:{origin:"https://other.example"}}),{params:Promise.resolve({id})})).status).toBe(403);
 });
 it("rejects a missing origin and a foreign origin, even when generation is enabled",async()=>{
  vi.stubEnv("PCC_ARTIFACT_GENERATION_ENABLED","true");
  const endpoint=`http://localhost/api/deliverables/${id}/generate`;
  for(const origin of [undefined,"https://other.example","null"]){
   const headers:Record<string,string>={};
   if(origin!==undefined)headers.origin=origin;
   const response=await POST(new Request(endpoint,{method:"POST",headers}),{params:Promise.resolve({id})});
   expect(response.status).toBe(403);
  }
 });
 it("requires authentication for generation and downloads",async()=>{
  vi.stubEnv("PCC_ARTIFACT_GENERATION_ENABLED","true");expect((await POST(new Request(`http://localhost/api/deliverables/${id}/generate`,{method:"POST",headers:{origin:"http://localhost"}}),{params:Promise.resolve({id})})).status).toBe(401);
  expect((await GET(new Request(`http://localhost/api/deliverables/artifacts/${id}/download`),{params:Promise.resolve({id})})).status).toBe(401);
 });
});
