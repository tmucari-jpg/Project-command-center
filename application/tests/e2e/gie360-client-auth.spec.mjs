import { test,expect } from "@playwright/test";

const id="843f4f46-9c12-407e-bec1-e49831fbba28";

test("GIE360 login is publicly accessible without opening PCC administrative login", async ({page})=>{
  await page.goto("/gie-login");
  await expect(page.getByRole("heading",{name:"Acompanhar o meu projecto"})).toBeVisible();
  await expect(page.getByRole("button",{name:"Entrar no acompanhamento"})).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/gie-login");
});

test("Unauthenticated client project link uses GIE360 login and preserves destination",async ({page})=>{
  await page.goto("/gie-client/"+id);
  await expect(page.getByRole("heading",{name:"Acompanhar o meu projecto"})).toBeVisible();
  const url=new URL(page.url());
  expect(url.pathname).toBe("/gie-login");
  expect(url.searchParams.get("next")).toBe("/gie-client/"+id);
  await expect(page.locator('input[name="next"]')).toHaveValue("/gie-client/"+id);
});

test("GIE360 home uses GIE login and PCC manager routes keep PCC login",async ({page})=>{
  await page.goto("/gie-client");
  await expect(page.getByRole("heading",{name:"Acompanhar o meu projecto"})).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/gie-login");
  await page.goto("/project-factory");
  expect(new URL(page.url()).pathname).toBe("/auth/login");
  expect(new URL(page.url()).searchParams.get("next")).toBe("/project-factory");
});

test("Client sign-in cannot redirect to internal PCC management",async ({page})=>{
  await page.goto("/gie-login?next=%2Fproject-factory%2Fprivate");
  await expect(page.locator('input[name="next"]')).toHaveValue("/gie-client");
});
