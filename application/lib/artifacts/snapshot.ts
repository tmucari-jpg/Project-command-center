import type { SupabaseClient } from "@supabase/supabase-js";
import type { ArtifactSnapshot, DocumentKind } from "@/lib/artifacts/model";
export async function loadArtifactSnapshot(db:SupabaseClient, userId:string, deliverableId:string, version:string, kind:DocumentKind, reviewedContent?:string):Promise<ArtifactSnapshot> {
  const {data:deliverable,error}=await db.from("deliverables").select("id,project_id,title,description,status,completion_criteria,artifact_type,artifact_url,artifact_reference,artifact_version,qa_status,acceptance_status,locked_at").eq("user_id",userId).eq("id",deliverableId).maybeSingle();
  if(error||!deliverable)throw new Error("DELIVERABLE_NOT_FOUND");
  if(deliverable.status==="completed"||deliverable.locked_at)throw new Error("DELIVERABLE_LOCKED");
  const {data:project,error:projectError}=await db.from("projects").select("id,title,description,expected_result,status,priority,next_action,budget,currency,due_date,notes,governance_gate,governance_gate_status").eq("id",deliverable.project_id).eq("user_id",userId).maybeSingle();
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
  // GIE360° originates from a recorded assessment linked to this project's factory case.
  // Never infer branding from a title, free-text description or a client-supplied flag.
  let documentBrand: "PCC" | "GIE360°" = "PCC";
  if (cases.data.length) {
    const assessment = await db.from("gie360_assessments")
      .select("id").in("factory_case_id", cases.data.map(item => item.id)).limit(1);
    if (assessment.error) throw new Error("DOCUMENT_ORIGIN_LOOKUP_FAILED");
    if (assessment.data.length) documentBrand = "GIE360°";
  }
  if (kind === "commitment") {
    if (!String(deliverable.title ?? "").startsWith("Carta de Compromisso")) {
      throw new Error("COMMITMENT_DELIVERABLE_REQUIRED");
    }
    const baselineResult = await db.from("project_commitment_baselines")
      .select("id,version,status,expected_result,scope,exclusions,deliverables_summary,pcc_responsibilities,client_responsibilities,external_costs_terms,acceptance_terms,security_conditions,client_validation_reference")
      .eq("project_id",project.id).eq("user_id",userId)
      .in("status",["internal_approved","client_approved"])
      .order("version",{ascending:false}).limit(1).maybeSingle();
    if (baselineResult.error || !baselineResult.data ||
        !["internal_approved","client_approved"].includes(baselineResult.data.status)) {
      throw new Error("COMMITMENT_BASELINE_NOT_APPROVED");
    }
    const baseline = baselineResult.data;
    sections.unshift({title:`Carta de Compromisso G3 — baseline v${baseline.version} (minuta não assinada)`,rows:[{
      "Identificação das partes":"PENDENTE DE CONFIRMAÇÃO",
      "Resultado esperado":baseline.expected_result ?? "PENDENTE DE CONFIRMAÇÃO",
      "Objecto e âmbito":baseline.scope ?? "PENDENTE DE CONFIRMAÇÃO",
      "Exclusões":baseline.exclusions ?? "PENDENTE DE CONFIRMAÇÃO",
      "Entregáveis":baseline.deliverables_summary ?? "PENDENTE DE CONFIRMAÇÃO",
      "Responsabilidades PCC":baseline.pcc_responsibilities ?? "PENDENTE DE CONFIRMAÇÃO",
      "Responsabilidades cliente":baseline.client_responsibilities ?? "PENDENTE DE CONFIRMAÇÃO",
      "Custos externos":baseline.external_costs_terms ?? "PENDENTE DE CONFIRMAÇÃO",
      "Critérios de aceitação":baseline.acceptance_terms ?? "PENDENTE DE CONFIRMAÇÃO",
      "Segurança":baseline.security_conditions ?? "PENDENTE DE CONFIRMAÇÃO",
      "Referência de validação":baseline.client_validation_reference ?? "PENDENTE DE CONFIRMAÇÃO",
      "Preço, impostos e assinatura":"PENDENTE DE REVISÃO E ACEITAÇÃO EXPRESSA",
    }]});
  }
  return {version,generatedAt:new Date().toISOString(),kind,documentBrand,deliverable,project,sections,reviewedContent};
}
