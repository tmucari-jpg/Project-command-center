import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source=(path:string)=>readFileSync(join(process.cwd(),path),"utf8");
const mutation=source("app/(protected)/mutations.ts");
const a=mutation.indexOf("export async function publishProjectClientStatus(");
const b=mutation.indexOf("export async function createClientDiagnosticRequest(",a);
const publication=mutation.slice(a,b);
const publicPage=source("app/project-status/[token]/page.tsx");
const action=source("app/(protected)/projects/[id]/library/actions.ts");
const page=source("app/(protected)/factory-library/page.tsx");
const migration=source("../supabase/migrations/20261104140000_deliverable_private_working_edit_url.sql");

describe("Manager editable document links are never used for customer delivery",()=>{
  it("stores a manager URL in a distinct nullable field rather than artifact_url",()=>{
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS working_edit_url text");
    expect(action).toContain("working_edit_url:artifactUrl.data");
    expect(action).not.toContain("artifact_url:artifactUrl.data");
  });
  it("never selects private edit URLs in the public status snapshot or public page",()=>{
    expect(publication).not.toContain("working_edit_url");
    expect(publicPage).not.toContain("working_edit_url");
  });
  it("keeps editing authenticated and scoped to the owner's project",()=>{
    expect(action).toContain("requireUser()");
    expect(action).toContain('.eq("project_id",projectId.data)');
    expect(action).toContain('.eq("user_id",user.id)');
    expect(page).toContain("Editar documento (gestor)");
  });
});
