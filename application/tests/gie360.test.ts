import { expect, it } from "vitest";
import { GIE360_QUESTIONS, gie360AnswersSchema, gie360InformationGaps, gie360ModuleState } from "@/lib/gie360";

it("keeps twelve questions in three stages and allows truthful missing answers", () => {
  expect(GIE360_QUESTIONS).toHaveLength(12);
  expect([0, 1, 2].map((step) => GIE360_QUESTIONS.filter((q) => q.step === step).length)).toEqual([4, 4, 4]);
  expect(gie360AnswersSchema.safeParse({ sector: "Agricultura", costs: "Não sei" }).success).toBe(true);
  expect(gie360AnswersSchema.safeParse({ forged_gate: "g5" }).success).toBe(false);
  expect(gie360AnswersSchema.safeParse({ costs: 0 }).success).toBe(false);
  expect(gie360InformationGaps({ sector: "Agricultura", costs: "Não sei" })).toHaveLength(11);
});
it("does not equate a purchased module with sufficient evidence", () => {
  expect(gie360ModuleState({ contracted: false, scopeApproved: true, relevant: true, approvedData: true }).status).toBe("não contratado");
  expect(gie360ModuleState({ contracted: true, scopeApproved: false, relevant: true, approvedData: true }).status).toBe("recomendado");
  expect(gie360ModuleState({ contracted: true, scopeApproved: true, relevant: true, approvedData: false }).status).toBe("pendente de dados");
  expect(gie360ModuleState({ contracted: true, scopeApproved: true, relevant: true, approvedData: true }).status).toBe("pronto a avaliar");
});

import {POST as createGieQuestionnaire} from "@/app/api/client-diagnostic/preintake/route";
it("rejects missing and foreign origins before creating an external GIE360 case",async()=>{
 const url="https://pcc.example/api/client-diagnostic/preintake";
 for(const origin of [undefined,"https://other.example","null"]){
  const headers:Record<string,string>={"content-type":"application/json"};
  if(origin!==undefined)headers.origin=origin;
  const response=await createGieQuestionnaire(new Request(url,{method:"POST",headers,body:JSON.stringify({reviewed:true,intent:"gie360",case_title:"Caso GIE360",client_name:"Teste",client_organization:"Teste",public_context:"Questionário de validação"})}));
  expect(response.status).toBe(403);
 }
});
