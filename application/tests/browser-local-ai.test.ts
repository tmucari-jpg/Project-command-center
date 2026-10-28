import {afterEach,describe,it,expect,vi} from 'vitest';
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();vi.resetModules();});
function runtime(content:string,models=['SmolLM2-360M-Instruct-q4f16_1-MLC']){
 const create=vi.fn().mockResolvedValue({choices:[{message:{content}}]});
 const load=vi.fn().mockResolvedValue({chat:{completions:{create}}});
 vi.stubGlobal('window',{});vi.stubGlobal('navigator',{gpu:{requestAdapter:async()=>({})}});
 const OriginalFunction=Function;
 vi.stubGlobal('Function',vi.fn(function(...args:string[]){if(args[0]==='url'&&args[1]==='return import(url)')return ()=>Promise.resolve({prebuiltAppConfig:{model_list:models.map(model_id=>({model_id}))},CreateMLCEngine:load});return Reflect.construct(OriginalFunction,args);}));
 return {create,load};
}
describe('browser inference validity guards',()=>{
 it('does not execute model inference without a usable GPU adapter',async()=>{
  runtime('{}');vi.stubGlobal('navigator',{gpu:{requestAdapter:async()=>null}});
  const {generateBrowserLocalText}=await import('@/lib/browser-local-ai');
  await expect(generateBrowserLocalText('fact')).rejects.toThrow('adaptador WebGPU');
 });
 it('does not claim a model absent from its pinned runtime catalog is ready',async()=>{
  runtime('{}',[]);const {generateBrowserLocalText}=await import('@/lib/browser-local-ai');
  await expect(generateBrowserLocalText('fact')).rejects.toThrow('modelo local não está disponível');
 });
 it('rejects malformed plans before persistence',async()=>{
  runtime('{"response":"Facto"}');const {generateBrowserLocalBotIAPlan}=await import('@/lib/browser-local-ai');
  await expect(generateBrowserLocalBotIAPlan({})).rejects.toThrow('plano válido');
 });
 it('strips proposed changes from a response classified as a question',async()=>{
  runtime(JSON.stringify({intent:'question',response:'Dados em falta.',summary:'Sem dados',diagnosis:'Necessário confirmar.',operations:[{kind:'create_action',title:'Unexpected write'}]}));
  const {generateBrowserLocalBotIAPlan}=await import('@/lib/browser-local-ai');
  expect((await generateBrowserLocalBotIAPlan({})).operations).toEqual([]);
 });
});
