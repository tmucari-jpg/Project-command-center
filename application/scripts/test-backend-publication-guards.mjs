import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const src = readFileSync("app/(protected)/mutations.ts", "utf8");
const publication = src.slice(src.indexOf("export async function publishProjectClientStatus("), src.indexOf("export async function createClientDiagnosticRequest("));
assert.ok(publication.includes('eq("user_id", user.id)'), "A publicação deve filtrar pelo workspace autorizado");
assert.ok(publication.includes('return { ok: false, error: "Não foi possível guardar o estado de acompanhamento." }'), "Erro de armazenamento deve ser genérico");
assert.ok(publication.includes('return { ok: false, error: "Não foi possível actualizar os links de partilha." }'), "Erro de revogação deve ser genérico");
assert.ok(!/error:\s*(?:projectError|deliverableError|metricError|snapshotError|revokeError|linkError)\??\.message/.test(publication), "Não expor mensagens do fornecedor nos erros públicos");
assert.ok(publication.indexOf('.from("project_client_status_snapshots").insert(') !== -1, "Snapshot deve ser persistido");
assert.ok(publication.indexOf('.from("project_client_status_links")') !== -1, "A gestão de links deve existir");
console.log("Guarda estática: mensagens sanitizadas e filtros de workspace presentes; transacção atómica ainda pendente.");
