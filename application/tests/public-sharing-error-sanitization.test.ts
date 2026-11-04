import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const code=readFileSync(join(process.cwd(),"app/(protected)/mutations.ts"),"utf8");
const publication=code.slice(code.indexOf("export async function publishProjectClientStatus("),code.indexOf("export async function createClientDiagnosticRequest("));
const diagnostic=code.slice(code.indexOf("export async function createClientDiagnosticRequest("),code.indexOf("export async function importClientDiagnosticLink("));
describe("Public sharing endpoints do not leak provider/database errors",()=>{
  it("sanitizes failures from project, deliverable and metric queries",()=>{
    expect(publication).not.toMatch(/error:\s*(?:projectError|deliverableError|metricError|publicationError)(?:\?\.)?\.message/);
    expect(publication).toContain("Não foi possível verificar o projecto para publicação.");
    expect(publication).toContain("Não foi possível preparar o acompanhamento para partilha.");
  });
  it("sanitizes diagnostic case lookup errors",()=>{
    expect(diagnostic).not.toMatch(/error:\s*caseError\?\.message/);
    expect(diagnostic).toContain("Não foi possível verificar o caso para o diagnóstico.");
  });
});
