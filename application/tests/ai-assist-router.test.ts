import {afterEach,describe,it,expect,vi} from "vitest";
import {generateAssistWithFallback} from "@/lib/ai-assist-router";
import type {SupabaseClient} from "@supabase/supabase-js";
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
function registry(rows:unknown[]){
 const updates:Array<Record<string,unknown>>=[];
 const db={from:()=>{const q:Record<string,unknown>={};for(const m of ["select","eq"])q[m]=()=>q;
 q.order=async()=>({data:rows,error:null});q.update=(value:Record<string,unknown>)=>{updates.push(value);return q;};return q;}};
 return {db:db as unknown as SupabaseClient,updates};
}
describe("assistant free fallback",()=>{
 it("does not execute or reactivate disabled and paid profiles",async()=>{
  vi.stubEnv("PCC_GROQ_FREE_TIER","true");const fetch=vi.fn();vi.stubGlobal("fetch",fetch);
  const {db,updates}=registry([{provider:"groq",enabled:false,cost_class:"free",mode:"cloud"},{provider:"openai",enabled:true,cost_class:"high",mode:"cloud"}]);
  await expect(generateAssistWithFallback(db,"owner","test")).rejects.toThrow("NO_FREE_PROVIDER");expect(fetch).not.toHaveBeenCalled();expect(updates).toEqual([]);
 });
 it("falls back after a failed local generation without changing enabled",async()=>{
  vi.stubEnv("PCC_GROQ_FREE_TIER","true");vi.stubEnv("GROQ_API_KEY","free-key");
  const fetch=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({error:{code:"timeout",message:"offline"}}),{status:503})).mockResolvedValueOnce(new Response(JSON.stringify({choices:[{message:{content:"Factual answer"}}]}),{status:200}));vi.stubGlobal("fetch",fetch);
  const {db,updates}=registry([{id:"local",provider:"qwen_local",label:"Local",mode:"local",enabled:true,endpoint_hint:"http://localhost:8080",model_hint:"model"},{id:"groq",provider:"groq",label:"Free Groq",mode:"cloud",enabled:true,cost_class:"free",model_hint:"model"}]);
  const result=await generateAssistWithFallback(db,"owner","test");expect(result.text).toBe("Factual answer");expect(fetch).toHaveBeenCalledTimes(2);
  expect(updates.every(u=>!("enabled" in u))).toBe(true);expect(result.attempts.map(a=>a.status)).toEqual(["failed","passed"]);
 });
});
