import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(),path),"utf8");

describe("GIE360° project continuity", () => {
  const project = source("app/(protected)/gie360/project/[id]/page.tsx");
  const organization = source("app/(protected)/gie360/[id]/page.tsx");
  const actions = source("app/(protected)/gie360/actions.ts");
  const factory = source("app/(protected)/project-factory/[id]/page.tsx");

  it("opens a real authorized project, not the GIE360 home", () => {
    expect(project).toContain('from("gie360_projects")');
    expect(project).toContain('.eq("manager_user_id",user.id)');
    expect(organization).toContain('href={`/gie360/project/${item.id}`}');
    expect(project).toContain('Aprovar âmbito na organização');
    expect(project).toContain('Activar execução deste projecto');
    expect(project).toContain('Criar actividade neste projecto');
    expect(project).toContain('<Gie360ShareAccess projectId={project.id}');
  });

  it("returns to the same project after handoff, activation and tasks", () => {
    expect(actions).toContain('redirect(`/gie360/project/${gieProjectId}?handoff=created`)');
    expect(actions).toContain('redirect("/gie360/project/" + project.id + "?project=activated")');
    expect(actions).toContain('redirect("/gie360/project/" + parsed.data.project_id + "?work=created")');
    expect(actions).toContain('redirect("/gie360/project/" + item.project_id + "?work=updated")');
    expect(actions).toContain('return_project_id');
    expect(actions).toContain('eq("organization_id", organization_id)');
    expect(factory).toContain('assignedProject.id');
  });

  it("keeps the client link independent and excludes unapproved activation", () => {
    expect(project).toContain('project.status!=="awaiting_scope"');
    expect(project).toContain('Gie360ShareAccess projectId={project.id}');
    expect(organization).toContain('returnProject');
  });
});
