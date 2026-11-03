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
 it("rejects invalid generated content within the attempt and validates the authorised fallback",async()=>{
  vi.stubEnv("PCC_GROQ_FREE_TIER","true");vi.stubEnv("GROQ_API_KEY","free-key");
  const fetch=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({choices:[{message:{content:'{"total_mzn":999}'}}]}),{status:200})).mockResolvedValueOnce(new Response(JSON.stringify({choices:[{message:{content:'{"total_mzn":120}'}}]}),{status:200}));vi.stubGlobal("fetch",fetch);
  const {db,updates}=registry([{id:"local",provider:"qwen_local",label:"Local",mode:"local",enabled:true,endpoint_hint:"http://localhost:8080",model_hint:"model"},{id:"groq",provider:"groq",label:"Free Groq",mode:"cloud",enabled:true,cost_class:"free",model_hint:"model"}]);
  const validate=vi.fn((text:string)=>{if(JSON.parse(text).total_mzn!==120)throw new Error("UNGROUNDED_TOTAL");});
  const result=await generateAssistWithFallback(db,"owner","Approved sales: MZN 80 + MZN 40","Return factual JSON",validate);
  expect(result.provider.provider).toBe("groq");expect(result.text).toBe('{"total_mzn":120}');expect(validate).toHaveBeenCalledTimes(2);
  expect(result.attempts).toEqual([expect.objectContaining({provider:"qwen_local",status:"failed",error:"UNGROUNDED_TOTAL"}),expect.objectContaining({provider:"groq",status:"passed"})]);
  expect(updates.map(u=>u.last_health_status)).toEqual(["degraded","healthy"]);
  expect(updates.every(u=>!("enabled" in u))).toBe(true);
 });
 it("does not mark any provider healthy when caller validation rejects every answer",async()=>{
  const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:"not JSON"}}]}),{status:200}));vi.stubGlobal("fetch",fetch);
  const {db,updates}=registry([{id:"local",provider:"qwen_local",label:"Local",mode:"local",enabled:true,endpoint_hint:"http://localhost:8080",model_hint:"model"}]);
  await expect(generateAssistWithFallback(db,"owner","test","Return JSON",text=>{JSON.parse(text);})).rejects.toThrow("FREE_PROVIDERS_UNAVAILABLE");
  expect(updates).toHaveLength(1);expect(updates[0].last_health_status).toBe("degraded");
 });

});
