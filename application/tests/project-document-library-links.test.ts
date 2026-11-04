import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const page=readFileSync(join(process.cwd(),"app/(protected)/factory-library/page.tsx"),"utf8");
const actions=readFileSync(join(process.cwd(),"app/(protected)/projects/[id]/library/actions.ts"),"utf8");
const hub=readFileSync(join(process.cwd(),"app/(protected)/projects/[id]/page.tsx"),"utf8");

describe("Project document library is a deliverable index, not duplicate storage",()=>{
  it("only presents documents belonging to the user's project",()=>{
    expect(page).toContain('.from("projects")');
    expect(page).toContain('.eq("user_id", user.id)');
    expect(page).toContain('.from("deliverables")');
    expect(page).toContain("item.project_id === project.id");
    expect(hub).toContain('/factory-library?project_id=${project.id}');
    const redirectPage=readFileSync(join(process.cwd(),"app/(protected)/projects/[id]/library/page.tsx"),"utf8");
    expect(redirectPage).toContain("/factory-library?project_id=");
  });
  it("saves the edit link against the existing deliverable, without copying bytes",()=>{
    expect(actions).toContain('.from("deliverables")');
    expect(actions).toContain('.eq("project_id",projectId.data)');
    expect(actions).toContain('.eq("user_id",user.id)');
    expect(actions).toContain("https://");
    expect(actions).toContain("working_edit_url:artifactUrl.data");
    expect(actions).not.toContain("artifact_url:artifactUrl.data");
    expect(page).toContain("Editar documento (gestor)");
    expect(page).toContain("Abrir link de entrega");
    expect(actions).not.toContain(".storage.");
  });
  it("keeps accepted versions immutable and client distribution separate",()=>{
    expect(actions).toContain('"accepted_with_reservations"');
    expect(actions).toContain('deliverable.status==="completed"');
    expect(page).not.toContain("client_diagnostic_requests");
  });
});
