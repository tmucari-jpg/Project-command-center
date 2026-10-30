import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const script = path.resolve("scripts/check-release-acceptance.mjs");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pcc-release-gate-"));
const ids = ["G3-01","DOC-01","ACT-01","GIE-01","AI-01","MOB-01","SEC-01","REL-01"];
const run = (file) => spawnSync(process.execPath, [script, ...(file ? [file] : [])], { encoding: "utf8" });
const write = (name, value) => {
  const filename = path.join(dir, name);
  fs.writeFileSync(filename, JSON.stringify(value));
  return filename;
};
const valid = {
  release_sha: "a".repeat(40),
  checks: ids.map(id => ({ id, release_sha: "a".repeat(40), status: "passed", evidence: [`https://evidence.example.org/releases/test/${id}`], validated_by: "QA", validated_at: "2026-10-30T10:00:00Z" })),
  production_approval: true, approved_by: "Responsável", approved_at: "2026-10-30T11:00:00Z"
};
try {
  assert.notEqual(run().status, 0, "Sem evidências deve bloquear");
  assert.notEqual(run(write("empty.json", {})).status, 0, "Sem campos deve bloquear");
  assert.notEqual(run(write("not-approved.json", {...valid, production_approval: false})).status, 0, "Sem aprovação humana deve bloquear");
  assert.notEqual(run(write("failed.json", {...valid, checks: valid.checks.map(c => c.id === "AI-01" ? {...c, status: "failed"} : c)})).status, 0, "Teste falhado deve bloquear");
  assert.notEqual(run(write("missing-evidence.json", {...valid, checks: valid.checks.map(c => c.id === "GIE-01" ? {...c, evidence: []} : c)})).status, 0, "Sem prova deve bloquear");
  assert.notEqual(run(write("wrong-sha.json", {...valid, checks: valid.checks.map(c => c.id === "G3-01" ? {...c, release_sha: "b".repeat(40)} : c)})).status, 0, "Prova de outra release deve bloquear");
  assert.notEqual(run(write("placeholder.json", {...valid, checks: valid.checks.map(c => c.id === "G3-01" ? {...c, evidence: ["evidence:G3-01"]} : c)})).status, 0, "Placeholder não é URL de evidência");
  assert.equal(run(write("valid-shape.json", valid)).status, 0, "Registo formal completo deve passar a verificação sintáctica");
  console.log("PCC release gate: 8 cenários sintácticos aprovados; conteúdo das provas NÃO verificado.");
} finally { fs.rmSync(dir, { recursive: true, force: true }); }
