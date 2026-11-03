import {afterEach,describe,it,expect,vi} from "vitest";
import {chatCompletionsUrl,isFreeAIEligible,requestAIText} from "@/lib/ai-runtime";
import {validateAIProviderHealth} from "@/lib/ai-provider-health";
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
describe("free-only AI execution",()=>{
  it("never selects disabled profiles or paid providers",()=>{
    vi.stubEnv("PCC_GROQ_FREE_TIER","true");
    expect(isFreeAIEligible({provider:"openai",mode:"cloud",enabled:true,cost_class:"free"})).toBe(false);
    expect(isFreeAIEligible({provider:"groq",mode:"cloud",enabled:false,cost_class:"free"})).toBe(false);
    expect(isFreeAIEligible({provider:"groq",mode:"cloud",enabled:true,cost_class:"free"})).toBe(true);
    vi.stubEnv("PCC_GROQ_FREE_TIER","false");
    expect(isFreeAIEligible({provider:"groq",mode:"cloud",enabled:true,cost_class:"free"})).toBe(false);
    expect(isFreeAIEligible({provider:"qwen_local",mode:"local",enabled:true})).toBe(true);
  });
  it("normalizes bases and full endpoints consistently",()=>{
    expect(chatCompletionsUrl("https://api.groq.com/openai/v1/")).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(chatCompletionsUrl("https://api.groq.com/openai/v1/chat/completions")).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(()=>chatCompletionsUrl("file:///tmp/a")).toThrow();
  });
  it("uses the Groq credential on a real generation, never a local GET",async()=>{
    vi.stubEnv("GROQ_API_KEY","test-free-only");
    const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:"OK"}}]}),{status:200}));vi.stubGlobal("fetch",fetch);
    const result=await validateAIProviderHealth({provider:"groq",mode:"cloud",model_hint:"openai/gpt-oss-20b",endpoint_hint:"https://api.groq.com/openai/v1/chat/completions"});
    expect(result.status).toBe("healthy");expect(fetch.mock.calls[0][1].method).toBe("POST");expect(fetch.mock.calls[0][1].headers.Authorization).toBe("Bearer test-free-only");
  });
  it("does not mark an empty HTTP 200 or missing model healthy",async()=>{
    const fetch=vi.fn().mockResolvedValue(new Response("<html>OK</html>",{status:200}));vi.stubGlobal("fetch",fetch);
    expect((await validateAIProviderHealth({provider:"qwen_local",mode:"local",endpoint_hint:"http://localhost:8080",model_hint:"local"})).status).not.toBe("healthy");
    expect((await validateAIProviderHealth({provider:"qwen_local",mode:"local",endpoint_hint:"http://localhost:8080"})).status).not.toBe("healthy");
  });
  it("never sends a cloud key to an arbitrary host",async()=>{
    vi.stubEnv("GROQ_API_KEY","secret");const fetch=vi.fn();vi.stubGlobal("fetch",fetch);
    await expect(requestAIText({provider:"groq",mode:"cloud",endpoint_hint:"https://attacker.example/v1",model_hint:"model"},"test")).rejects.toThrow("INVALID_CLOUD_ENDPOINT");expect(fetch).not.toHaveBeenCalled();
  });
});
