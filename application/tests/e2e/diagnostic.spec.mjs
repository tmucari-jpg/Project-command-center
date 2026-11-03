import { test, expect } from "@playwright/test";

const INTEGRATED = "A".repeat(43);
const LEGACY = "B".repeat(43);
const MOCK = "http://127.0.0.1:43187";

test.beforeEach(async ({ request }) => {
  const reset = await request.post(MOCK + "/__qa/reset");
  expect(reset.ok()).toBeTruthy();
});

test("PCC × GIE360: approved four-stage form, adaptive fields, real server action and duplicate guard", async ({ page, request }) => {
  await page.goto("/client-diagnostic/" + INTEGRATED);

  await expect(page.getByText("PCC × GIE360°", { exact: true }).first()).toBeVisible();
  for (const step of ["Etapa 1 / 4", "Etapa 2 / 4", "Etapa 3 / 4", "Etapa 4 / 4"]) {
    await expect(page.getByText(new RegExp(step.replace("/", "\\/")))).toBeVisible();
  }
  await expect(page.getByText("Como acompanha propostas e oportunidades?")).toBeHidden();
  await page.locator('input[name="empresa"]').fill("Organização Fictícia QA");
  await page.locator('input[name="respondent_name"]').fill("TESTE QA PCC");
  await page.locator('input[name="email"]').fill("qa@example.invalid");
  await page.locator('input[name="sector"][value="Serviços"]').check();
  await page.locator('input[name="necessidades"][value="Vendas e clientes"]').check();
  await expect(page.getByText("Como acompanha propostas e oportunidades?")).toBeVisible();
  await page.locator('input[name="crm"][value="CRM"]').check();
  await page.locator('input[name="necessidades"][value="Gestão e indicadores"]').check();
  await expect(page.getByText("Os indicadores são revistos regularmente?")).toBeVisible();
  await page.locator('input[name="indicadores"][value="Mensalmente"]').check();
  await page.locator('input[name="dados"][value="Vendas"]').check();
  await page.locator('textarea[name="objectivo"]').fill("Validar envio ponta a ponta com dados fictícios");
  await page.locator('select[name="prazo"]').selectOption("Até 30 dias");
  await page.getByRole("button", { name: "Pré-visualizar respostas" }).click();
  await expect(page.getByLabel("Pré-visualização das respostas")).toContainText("Vendas e clientes");

  await page.getByRole("button", { name: "Enviar respostas ao PCC" }).click();
  await expect(page.locator('input[name="consent"]')).toBeVisible();
  await expect(page.getByText("Resposta recebida")).toBeHidden();
  await page.locator('input[name="consent"]').check();
  await page.getByRole("button", { name: "Enviar respostas ao PCC" }).click();
  await expect(page.getByRole("heading", { name: "Resposta recebida" })).toBeVisible({ timeout: 30_000 });

  const { integrated } = await (await request.get(MOCK + "/__qa/state")).json();
  expect(integrated.status).toBe("analyzing");
  expect(integrated.attempts).toBe(1);
  expect(integrated.submitted.p_answers.questionnaire_mode).toBe("gie360");
  expect(integrated.submitted.p_answers.necessidades).toEqual(["Vendas e clientes", "Gestão e indicadores"]);
  expect(integrated.submitted.p_answers.focus).toContain("Mensalmente");

  const retry = await request.post(MOCK + "/rest/v1/rpc/client_diagnostic_submit", {
    data: integrated.submitted,
  });
  expect(await retry.json()).toBe(false);
  const state = await (await request.get(MOCK + "/__qa/state")).json();
  expect(state.integrated.attempts).toBe(2);
});

test("Existing executive-v3 link uses approved layout on mobile without regenerating request", async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/client-diagnostic/" + LEGACY);
  await expect(page.getByRole("heading", { name: "Compreender a empresa antes de recomendar soluções" })).toBeVisible();
  await expect(page.getByText("Etapa 4 / 4", { exact: false })).toBeVisible();
  await expect(page.locator("header").getByText("PCC", { exact: true })).toBeVisible();
  await expect(page.locator("header").getByText("× GIE360°")).toHaveCount(0);
  await page.locator('input[name="necessidades"][value="Cobranças e tesouraria"]').check();
  await expect(page.getByText("Existem atrasos de cobrança?")).toBeVisible();
  await page.locator('input[name="necessidades"][value="Cobranças e tesouraria"]').uncheck();
  await expect(page.getByText("Existem atrasos de cobrança?")).toBeHidden();
  const state = await (await request.get(MOCK + "/__qa/state")).json();
  expect(state.legacy.submitted).toBeNull();
});
