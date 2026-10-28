import type { SupabaseClient } from "@supabase/supabase-js";
import type { ArtifactSnapshot, DocumentKind } from "@/lib/artifacts/model";
export async function loadArtifactSnapshot(db:SupabaseClient, userId:string, deliverableId:string, version:string, kind:DocumentKind, reviewedContent?:string):Promise<ArtifactSnapshot> {
  const {data:deliverable,error}=await db.from("deliverables").select("id,project_id,title,description,status,completion_criteria,artifact_type,artifact_url,artifact_reference,artifact_version,qa_status,acceptance_status,locked_at").eq("user_id",userId).eq("id",deliverableId).maybeSingle();
  if(error||!deliverable)throw new Error("DELIVERABLE_NOT_FOUND");
  if(deliverable.status==="completed"||deliverable.locked_at)throw new Error("DELIVERABLE_LOCKED");
  const {data:project,error:projectError}=await db.from("projects").select("id,title,description,expected_result,status,priority,next_action,budget,currency,notes,governance_gate,governance_gate_status").eq("id",deliverable.project_id).eq("user_id",userId).maybeSingle();
  if(projectError||!project)throw new Error("PROJECT_NOT_FOUND");
  const specs=[
    ["Entregáveis e validação","deliverables","title,description,status,progress,completion_criteria,artifact_type,artifact_url,artifact_reference,qa_status,acceptance_status"],
    ["Acções e próximos passos","actions","title,description,status,priority,completion_criteria"],
    ["Evidências registadas","evidence","id,deliverable_id,title,description,evidence_type,url,numeric_value"],
    ["Métricas e resultados","metrics","name,current_value,target_value,unit"],
    ["Riscos e bloqueios","blockers","title,description,status,impact,solution"],
    ["Decisões e fundamentação","decisions","title,decision,rationale"],
    ["Custos e receitas (moeda original)","financial_entries","entry_type,description,category,amount,currency,status"],
    ["Perfil comercial","project_commercial_profiles","offer,ideal_customer,price,currency,channel,validation_status"],
    ["Estratégia e plano de execução","project_strategy_execution_plans","strategy,monetization,marketing,sales,execution,measurement"],
  ];
  const sections=await Promise.all(specs.map(async([title,table,fields])=>{
    const {data,error}=await db.from(table).select(fields).eq("project_id",project.id).eq("user_id",userId).limit(201);
    if(error)throw new Error(`SOURCE_QUERY_FAILED:${table}`);
    if(data.length>200)throw new Error(`SOURCE_TOO_LARGE:${table}`);
    return {title,rows:data as unknown as Array<Record<string,unknown>>};
  }));
  // Reuse the pre-project collection; a document must not lose intake/viability context.
  const cases=await db.from("project_factory_cases").select("id,title,description,problem,expected_value,constraints,stage").eq("project_id",project.id).eq("user_id",userId).limit(201);
  if(cases.error)throw new Error("SOURCE_QUERY_FAILED:project_factory_cases");
  if(cases.data.length>200)throw new Error("SOURCE_TOO_LARGE:project_factory_cases");
  if(cases.data.length){
    sections.push({title:"Contexto recolhido antes do projecto",rows:cases.data});
    const ids=cases.data.map(row=>row.id);
    for(const [title,table,fields] of [
      ["Viabilidade e evidência de validação","factory_validations","id,factory_case_id,critical_hypotheses,validation_plan,evidence,result_summary,viability_status,viability_summary,conditions_to_proceed,missing_information"],
      ["Parecer e decisão de origem","factory_reports","id,factory_case_id,problem_identified,market,risks,critical_hypotheses,final_decision,decision_rationale"],
    ]){
      const result=await db.from(table).select(fields).in("factory_case_id",ids).eq("user_id",userId).limit(201);
      if(result.error)throw new Error(`SOURCE_QUERY_FAILED:${table}`);
      if(result.data.length>200)throw new Error(`SOURCE_TOO_LARGE:${table}`);
      sections.push({title,rows:result.data as unknown as Array<Record<string,unknown>>});
    }
    const requests=await db.from("client_diagnostic_requests").select("id,status,questionnaire_version").in("factory_case_id",ids).eq("user_id",userId).limit(201);
    if(requests.error)throw new Error("SOURCE_QUERY_FAILED:client_diagnostic_requests");
    if(requests.data.length>200)throw new Error("SOURCE_TOO_LARGE:client_diagnostic_requests");
    if(requests.data.length){
      const requestIds=requests.data.map(row=>row.id);
      const [responses,reviews]=await Promise.all([
        db.from("client_diagnostic_responses").select("id,request_id,answers,submitted_at").in("request_id",requestIds).limit(201),
        db.from("client_diagnostic_reviews").select("id,request_id,review_status,review_notes,missing_information,points_to_confirm").in("request_id",requestIds).eq("user_id",userId).limit(201),
      ]);
      if(responses.error||reviews.error)throw new Error("SOURCE_QUERY_FAILED:client_diagnostic_context");
      if(responses.data.length>200||reviews.data.length>200)throw new Error("SOURCE_TOO_LARGE:client_diagnostic_context");
      sections.push({title:"Respostas declaradas pelo cliente (validação conforme revisão)",rows:responses.data});
      sections.push({title:"Revisão do diagnóstico e informação pendente",rows:reviews.data});
    }
  }
  return {version,generatedAt:new Date().toISOString(),kind,deliverable,project,sections,reviewedContent};
}
