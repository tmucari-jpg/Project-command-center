import assert from "node:assert/strict";
import fs from "node:fs";
const sql = fs.readFileSync("../supabase/migrations/20261030162500_diagnostic_expired_tokens.sql","utf8");
assert.match(sql,/r\.expires_at\s*>\s*now\(\)\s+LIMIT 1/i,"A consulta final deve bloquear token expirado");
assert.match(sql,/r\.status\s*<>\s*'revoked'/i,"A consulta deve bloquear token revogado");
assert.match(sql,/consume_client_diagnostic_rate_limit/,"O rate limit tem de ser preservado");
assert.match(sql,/SECURITY DEFINER/i,"A assinatura e contrato da função devem manter-se");
console.log("QA diagnostic expiry migration: verificações estáticas passaram; teste no Supabase de ensaio ainda requerido.");
