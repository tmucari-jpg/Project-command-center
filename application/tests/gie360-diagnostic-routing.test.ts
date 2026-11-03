import { describe, expect, it } from "vitest";
import { canAssociateFromDiagnostic, recommendDiagnosticDestination } from "@/lib/gie360-diagnostic-routing";

describe("GIE360 result-based routing", () => {
  it("routes reviewed corporate diagnostics with identifiable operational needs to GIE360", () => {
    const answers = { respondent_type:"organization", request_nature:"organization_solution", context:"A empresa precisa de automatizar cobrança e controlar clientes", focus:"cash: Frequentemente; sales: Sem controlo definido", desired_result:"melhorar tesouraria e CRM" };
    const result = canAssociateFromDiagnostic({ requestStatus:"reviewed", reviewStatus:"accepted", answers });
    expect(result.eligible).toBe(true);
    expect(result.destination).toBe("gie360");
    expect(result.modules).toContain("billing");
    expect(result.modules).toContain("crm");
  });
  it("does not route merely because a diagnostic is submitted or has an enterprise selection", () => {
    const answers = { request_nature:"organization_solution", context:"Preciso de uma página de divulgação para um evento", desired_result:"publicar um website" };
    expect(canAssociateFromDiagnostic({requestStatus:"submitted",reviewStatus:null,answers}).eligible).toBe(false);
    expect(canAssociateFromDiagnostic({requestStatus:"reviewed",reviewStatus:"accepted",answers}).destination).toBe("projects");
  });
  it("blocks unreviewed or clarification-needed responses even if they match modules", () => {
    const answers = {respondent_type:"organization", context:"Empresa necessita de contabilidade e fiscalidade"};
    expect(canAssociateFromDiagnostic({requestStatus:"submitted",reviewStatus:"accepted",answers}).eligible).toBe(false);
    expect(canAssociateFromDiagnostic({requestStatus:"reviewed",reviewStatus:"clarification_needed",answers}).eligible).toBe(false);
  });
  it("requires organizational context, not keywords alone", () => {
    const result = recommendDiagnosticDestination({request_nature:"problem",context:"Preciso de aprender sobre facturação",desired_result:"curso individual"});
    expect(result.destination).toBe("review");
  });
  it("never guesses when the answer set is blank", () => {
    expect(recommendDiagnosticDestination({}).destination).toBe("review");
    expect(recommendDiagnosticDestination(null).destination).toBe("review");
  });
});