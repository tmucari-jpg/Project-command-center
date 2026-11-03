import { createServer } from "node:http";
import { createHash } from "node:crypto";

const PORT = 43187;
const tokens = {
  integrated: "A".repeat(43),
  legacy: "B".repeat(43),
};
const hashes = Object.fromEntries(Object.entries(tokens).map(([kind, token]) => [
  createHash("sha256").update(token).digest("hex"), kind,
]));
const state = new Map();

function reset() {
  state.clear();
  for (const kind of Object.values(hashes)) state.set(kind, { status: "active", submitted: null, attempts: 0 });
}
reset();
function send(res, code, body) {
  res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(body));
}
createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 200, {});
  if (req.url === "/__qa/health") return send(res, 200, { ok: true });
  if (req.url === "/__qa/reset" && req.method === "POST") { reset(); return send(res, 200, { ok: true }); }
  if (req.url === "/__qa/state" && req.method === "GET") {
    return send(res, 200, Object.fromEntries(state));
  }
  if (!req.url?.startsWith("/rest/v1/rpc/")) return send(res, 404, { message: "Not found" });
  let raw = "";
  for await (const chunk of req) raw += chunk.toString();
  let payload;
  try { payload = JSON.parse(raw || "{}"); } catch { return send(res, 400, { message: "Invalid JSON" }); }
  const kind = hashes[payload.p_token_hash];
  if (!kind) return send(res, 200, req.url.endsWith("lookup") ? [] : false);
  const record = state.get(kind);
  if (req.url.endsWith("/client_diagnostic_lookup")) {
    return send(res, 200, [{
      request_id: kind === "integrated" ? "11111111-1111-4111-8111-111111111111" : "22222222-2222-4222-8222-222222222222",
      client_name: "TESTE QA PCC",
      client_organization: "Organização Fictícia QA",
      public_context: "Ensaio isolado com dados fictícios.",
      questionnaire_version: kind === "integrated" ? "executive-v3-gie360" : "executive-v3",
      status: record.status,
      expires_at: "2030-01-01T12:00:00Z",
    }]);
  }
  if (req.url.endsWith("/client_diagnostic_submit")) {
    record.attempts += 1;
    if (record.status !== "active") return send(res, 200, false);
    if (!payload.p_answers || payload.p_answers.organization !== "Organização Fictícia QA") return send(res, 200, false);
    if (!Array.isArray(payload.p_answers.necessidades) || payload.p_answers.necessidades.length === 0) return send(res, 200, false);
    record.status = "analyzing";
    record.submitted = payload;
    return send(res, 200, true);
  }
  return send(res, 404, { message: "Unknown RPC" });
}).listen(PORT, "127.0.0.1", () => process.stdout.write("QA Supabase stub ready on " + PORT + "\n"));
