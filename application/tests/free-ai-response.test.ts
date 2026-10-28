import {afterEach, describe, expect, it, vi} from 'vitest';
vi.mock('@/lib/browser-local-ai',()=>({generateBrowserLocalText:vi.fn()}));
import {generateBrowserLocalText} from '@/lib/browser-local-ai';
import {generateFreeAssistance,validateAssistanceText} from '@/lib/free-ai-assist';
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
describe('structured free assistance',()=>{
 it('accepts fenced JSON but rejects prose and primitive values',()=>{
  expect(validateAssistanceText('```json\n{"title":"Facto"}\n```','JSON')).toBe('{"title":"Facto"}');
  expect(()=>validateAssistanceText('Invented prose','JSON')).toThrow();
  expect(()=>validateAssistanceText('null','JSON')).toThrow();
  expect(()=>validateAssistanceText('[]','JSON')).toThrow();
 });
 it('tries a free provider if the local model returns invalid structured output',async()=>{
  vi.mocked(generateBrowserLocalText).mockResolvedValue('not JSON');
  const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({text:'{"title":"Dados fornecidos"}'}),{status:200}));vi.stubGlobal('fetch',fetch);
  const r=await generateFreeAssistance('Input factual','Devolve JSON');
  expect(r.source).toBe('free_provider');expect(fetch).toHaveBeenCalledTimes(1);
 });
 it('does not present malformed complementary output as success',async()=>{
  vi.mocked(generateBrowserLocalText).mockRejectedValue(new Error('No GPU'));
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({text:'incorrect'}),{status:200})));
  await expect(generateFreeAssistance('Input','JSON')).rejects.toThrow('JSON inválido');
 });
});
