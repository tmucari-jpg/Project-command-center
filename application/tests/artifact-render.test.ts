import {describe,it,expect} from "vitest";
import {renderArtifact,transparentArtifactLogo} from "@/lib/artifacts/render";
import sharp from "sharp";
import type {ArtifactSnapshot} from "@/lib/artifacts/model";
import {writeFile,mkdir} from "node:fs/promises";
const fixture:ArtifactSnapshot={version:"30000000-0000-4000-8000-000000000001",generatedAt:"2026-10-28T08:00:00Z",kind:"master_plan",deliverable:{title:"Plano de teste",description:"Plano de execução para validação",completion_criteria:"Documento acessível, com critérios e evidência."},project:{title:"Projecto de validação PCC",expected_result:"Verificar exportação sem alterar produção",currency:"MZN"},sections:[{title:"Acções e próximos passos",rows:[{title:"Validar ícones",status:"pending",description:"Instalar num dispositivo de teste e registar a evidência."}]},{title:"Custos",rows:[{amount:0,currency:"MZN",description:"Sem utilização de serviços pagos no teste."}]},{title:"Evidências registadas",rows:[]}]};
describe("real PCC artifact formats",()=>{
 it("produces Unicode PDF and genuine Office archives from one factual snapshot",async()=>{
  const files=await renderArtifact(fixture);expect(files.map(f=>f.extension)).toEqual(["docx","pdf"]);
  expect(files[0].bytes.subarray(0,2).toString()).toBe("PK");expect(files[1].bytes.subarray(0,4).toString()).toBe("%PDF");
  if(process.env.PCC_WRITE_QA_FIXTURES==="true"){
    await mkdir('../tmp/qa-artifacts',{recursive:true});for(const f of files)await writeFile(`../tmp/qa-artifacts/Plano_PCC.${f.extension}`,f.bytes);
  }
 },20000);
 it.each(["spreadsheet","presentation"] as const)("produces a usable %s rather than an HTML file with a false extension",async kind=>{
  const files=await renderArtifact({...fixture,kind});expect(files).toHaveLength(1);expect(files[0].bytes.subarray(0,2).toString()).toBe("PK");expect(files[0].bytes.length).toBeGreaterThan(3000);
  if(process.env.PCC_WRITE_QA_FIXTURES==="true")await writeFile(`../tmp/qa-artifacts/Plano_PCC.${files[0].extension}`,files[0].bytes);
 },20000);
});

it("uses a transparent PNG logo for all generated artifact formats",async()=>{
 const logo=await transparentArtifactLogo();
 const metadata=await sharp(logo).metadata();
 expect(metadata.format).toBe("png");
 expect(metadata.channels).toBe(4);
 expect(metadata.width).toBeGreaterThan(200);
 const {data,info}=await sharp(logo).raw().toBuffer({resolveWithObject:true});
 const alpha=[];for(let i=3;i<data.length;i+=info.channels)alpha.push(data[i]);
 expect(alpha.some(value=>value===0)).toBe(true);
 expect(alpha.some(value=>value===255)).toBe(true);
},20000);
