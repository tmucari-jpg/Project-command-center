import {it,expect} from 'vitest';
import {artifactInformationGaps} from '@/lib/artifacts/readiness';
it('provides causes and next actions instead of hiding an incomplete deliverable',()=>{
 const gaps=artifactInformationGaps({version:'test',generatedAt:'2026-10-28',kind:'document',deliverable:{},project:{},sections:[]});
 expect(gaps.length).toBe(4);expect(gaps.every(g=>g.cause&&g.nextAction)).toBe(true);
});
it('does not treat another deliverable evidence as proof for this result',()=>{
 const snapshot={version:'test',generatedAt:'2026-10-28',kind:'document' as const,deliverable:{id:'deliverable-a',completion_criteria:'Criteria',description:'Content'},project:{expected_result:'Result'},sections:[{title:'Evidências registadas',rows:[{deliverable_id:'deliverable-b',url:'https://example.test'}]}]};
 expect(artifactInformationGaps(snapshot).some(g=>g.field==='evidence')).toBe(true);
 snapshot.sections[0].rows[0].deliverable_id='deliverable-a';
 expect(artifactInformationGaps(snapshot).some(g=>g.field==='evidence')).toBe(false);
});
it('surfaces the unresolved information already collected before the project',()=>{
 const gaps=artifactInformationGaps({version:'test',generatedAt:'2026-10-28',kind:'diagnosis',deliverable:{},project:{},sections:[{title:'Revisão do diagnóstico e informação pendente',rows:[{id:'review-1',missing_information:'Confirmar orçamento',points_to_confirm:'Confirmar responsável'}]}]});
 expect(gaps.some(g=>g.cause==='Confirmar orçamento')).toBe(true);
 expect(gaps.some(g=>g.cause==='Confirmar responsável')).toBe(true);
});

it('identifies missing real budget and deadline before generating an operational plan',()=>{
 const snapshot={version:'test',generatedAt:'2026-10-29',kind:'master_plan' as const,deliverable:{id:'existing',completion_criteria:'Aprovado',description:'Objectivo real'},project:{expected_result:'Resultado registado',budget:null,due_date:null},sections:[]};
 const gaps=artifactInformationGaps(snapshot);
 expect(gaps.map(g=>g.field)).toContain('project.budget');
 expect(gaps.map(g=>g.field)).toContain('project.due_date');
 snapshot.project.budget=0;
 expect(artifactInformationGaps(snapshot).some(g=>g.field==='project.budget')).toBe(false);
});
it('does not invent a budget or deadline for ordinary diagnostic reports',()=>{
 const snapshot={version:'test',generatedAt:'2026-10-29',kind:'diagnosis' as const,deliverable:{id:'existing',completion_criteria:'Aprovado',description:'Conteúdo real'},project:{expected_result:'Resultado registado'},sections:[]};
 const gaps=artifactInformationGaps(snapshot);
 expect(gaps.some(g=>g.field==='project.budget'||g.field==='project.due_date')).toBe(false);
});
