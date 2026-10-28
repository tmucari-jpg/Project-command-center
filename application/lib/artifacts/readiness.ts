import type {ArtifactSnapshot} from "@/lib/artifacts/model";
export function artifactInformationGaps(snapshot:ArtifactSnapshot) {
 const gaps:Array<{field:string;cause:string;nextAction:string}>=[];
 const require=(field:string,value:unknown,nextAction:string)=>{if(value==null||String(value).trim()==='')gaps.push({field,cause:'Informação não registada na fonte canónica.',nextAction});};
 require('deliverable.completion_criteria',snapshot.deliverable.completion_criteria,'Definir o critério de aceitação com o responsável.');
 require('project.expected_result',snapshot.project.expected_result,'Confirmar o resultado esperado do projecto.');
 const evidence=snapshot.sections.find(s=>s.title==='Evidências registadas');
 if(!evidence?.rows.some(row=>row.deliverable_id===snapshot.deliverable.id))gaps.push({field:'evidence',cause:'Ainda não existe evidência directamente associada a este entregável.',nextAction:'Recolher e associar a prova real; manter QA e aceitação pendentes.'});
 if(!snapshot.reviewedContent&&!snapshot.deliverable.description)gaps.push({field:'deliverable.content',cause:'Não há conteúdo revisto nem descrição substantiva registada.',nextAction:'Recolher o conteúdo em falta junto do responsável; o ficheiro factual pode ser gerado como rascunho.'});
 for(const section of snapshot.sections)for(const row of section.rows){
   for(const field of ['missing_information','points_to_confirm','conditions_to_proceed']){
     if(typeof row[field]==='string'&&row[field].trim())gaps.push({field:`${section.title}.${String(row.id??gaps.length)}.${field}`,cause:row[field] as string,nextAction:'Dar seguimento à pendência da recolha/validação e registar a resposta na fonte de origem.'});
   }
 }
 return gaps;
}
