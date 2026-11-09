import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { test } from "node:test";
import vm from "node:vm";

const source = stripTypeScriptTypes(await readFile(new URL("../app/auth/callback/route.ts", import.meta.url), "utf8"));
async function callback(query, result = { data: { session: {} }, error: null }) {
  const exchanges = [];
  let clients = 0;
  const context = vm.createContext({ URL });
  const next = new vm.SyntheticModule(["NextResponse"], function () {
    this.setExport("NextResponse", { redirect: url => ({ location: url.href }) });
  }, { context });
  const server = new vm.SyntheticModule(["createClient"], function () {
    this.setExport("createClient", async () => {
      clients++;
      return { auth: { exchangeCodeForSession: async code => {
        exchanges.push(code);
        return result;
      } } };
    });
  }, { context });
  const route = new vm.SourceTextModule(source, { context });
  await route.link(specifier => {
    if (specifier === "next/server") return next;
    if (specifier === "@/lib/supabase/server") return server;
    throw new Error("Unexpected import: " + specifier);
  });
  await route.evaluate();
  const response = await route.namespace.GET({ url: "https://pcc.example/auth/callback" + query });
  return { ...response, clients, exchanges };
}
const failure = "https://pcc.example/auth/login?error=callback";

test("valid recovery code reaches password update only after a session is established", async () => {
  const result = await callback("?code=test-only&next=/auth/update-password");
  assert.equal(result.location, "https://pcc.example/auth/update-password");
  assert.deepEqual(result.exchanges, ["test-only"]);
});
test("confirmation without a next parameter retains the existing dashboard destination", async () => {
  assert.equal((await callback("?code=test-only")).location, "https://pcc.example/dashboard");
});
test("missing code cannot open password update", async () => {
  const result = await callback("?next=/auth/update-password");
  assert.equal(result.location, failure);
  assert.equal(result.clients, 0);
});
test("provider error is rejected before exchanging a code and never reflected", async () => {
  const result = await callback("?code=test-only&error=access_denied&error_description=private-detail");
  assert.equal(result.location, failure);
  assert.equal(result.clients, 0);
});
test("expired or rejected code cannot be presented as successful recovery", async () => {
  const result = await callback("?code=test-only&next=/auth/update-password", { data: { session: null }, error: { code: "expired" } });
  assert.equal(result.location, failure);
});
test("successful exchange without a session is rejected", async () => {
  assert.equal((await callback("?code=test-only", { data: { session: null }, error: null })).location, failure);
});
test("external, protocol-relative, backslash and control-character destinations stay on PCC", async () => {
  for (const next of ["https://other.example", "//other.example", "/\\other.example", "/\n/other.example"]) {
    assert.equal((await callback("?code=test-only&next=" + encodeURIComponent(next))).location, "https://pcc.example/dashboard");
  }
});
