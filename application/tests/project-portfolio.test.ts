import { expect, it } from "vitest";
import { portfolio } from "../lib/project-portfolio";

it("cobre os projectos pedidos com acções e hipótese de receita sem duplicações", () => {
  const names = portfolio.map((item) => item.name.toLocaleLowerCase("pt-PT"));
  expect(new Set(names).size).toBe(names.length);
  for (const name of ["Contra — freelancing", "Moz Task", "Maana", "Rhengo", "Briefing Diário", "Melhorar a articulação pública"]) {
    expect(portfolio.some((item) => item.name === name)).toBe(true);
  }
  for (const project of portfolio) {
    expect(project.revenue.length).toBeGreaterThan(20);
    expect(project.actions.length).toBeGreaterThan(0);
    expect(new Set(project.actions.map((item) => item.title)).size).toBe(project.actions.length);
  }
});
