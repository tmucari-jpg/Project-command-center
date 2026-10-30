import fs from "node:fs";

const REQUIRED = ["G3-01","DOC-01","ACT-01","GIE-01","AI-01","MOB-01","SEC-01","REL-01"];
const file = process.argv[2];
if (!file || !fs.existsSync(file)) {
  console.error("BLOQUEADO: fornecer ficheiro JSON de evidências da release.");
  process.exit(1);
}
let record;
try { record = JSON.parse(fs.readFileSync(file, "utf8")); }
catch { console.error("BLOQUEADO: ficheiro de evidências inválido."); process.exit(1); }
const issues = [];
if (!record || typeof record !== "object") issues.push("Objecto de evidências inválido");
if (typeof record?.release_sha !== "string" || !/^[0-9a-f]{40}$/.test(record.release_sha)) issues.push("SHA da release ausente/inválido");
if (!Array.isArray(record?.checks)) issues.push("checks ausente");
const checks = Array.isArray(record?.checks) ? record.checks : [];
for (const id of REQUIRED) {
  const matches = checks.filter(x => x && x.id === id);
  if (matches.length !== 1) { issues.push(`${id}: esperado exactamente um registo`); continue; }
  const c = matches[0];
  if (c.status !== "passed") issues.push(`${id}: estado não aprovado`);
  if (c.release_sha !== record.release_sha) issues.push(`${id}: prova não vinculada à release`);
  if (!Array.isArray(c.evidence) || c.evidence.length === 0 || c.evidence.some(x => typeof x !== "string" || !/^https:\/\/[^\s/]+\/\S+$/.test(x))) issues.push(`${id}: exigir URL HTTPS de evidência consultável`);
  if (!c.validated_by || typeof c.validated_by !== "string" || !c.validated_by.trim()) issues.push(`${id}: validador ausente`);
  if (!c.validated_at || !/^\d{4}-\d{2}-\d{2}T/.test(c.validated_at) || Number.isNaN(Date.parse(c.validated_at))) issues.push(`${id}: data inválida`);
}
if (new Set(checks.map(x => x?.id)).size !== checks.length) issues.push("IDs de verificação duplicados");
if (record?.production_approval !== true || !record?.approved_by || !record?.approved_at || Number.isNaN(Date.parse(record.approved_at))) issues.push("Aprovação humana explícita da produção ausente");
if (issues.length) {
  console.error("RELEASE BLOQUEADA:\n" + issues.map(x => `- ${x}`).join("\n"));
  process.exit(1);
}
console.log("Critérios declarados preenchidos. Exige verificação independente das evidências, CI e smoke autenticado.");
