import { requestGeminiHealthText } from "@/lib/ai-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "no-store, max-age=0",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
};

function html(body: string, status = 200) {
  return new Response(`<!doctype html><html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>PCC · Gemini</title><style>body{font:16px system-ui;background:#f8f6f0;color:#073f36;padding:28px;max-width:650px;margin:auto;line-height:1.55}main{border:1px solid #c6c9bd;background:white;padding:26px;border-radius:18px}button{padding:13px 22px;background:#073f36;color:white;border:0;border-radius:9px;font-weight:700;cursor:pointer}small{color:#555}p{overflow-wrap:anywhere}</style></head><body><main><h1>PCC · Validação real Gemini</h1>${body}</main></body></html>`, { status, headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } });
}
function safe(value: unknown) {
  return String(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}
const allowed = () => process.env.VERCEL_ENV === "preview";

export async function GET() {
  if (!allowed()) return new Response("Not found", { status: 404, headers });
  return html('<p>Este teste não utiliza o Supabase e não envia dados de clientes. Usa apenas um pedido sintético à API nativa da Google e não activa automaticamente o perfil na produção.</p><form method="post"><button type="submit">Executar teste real Gemini</button></form><p><small>Disponível exclusivamente no ambiente Preview protegido do Vercel.</small></p>');
}
export async function POST() {
  if (!allowed()) return new Response("Not found", { status: 404, headers });
  if (process.env.PCC_GEMINI_FREE_TIER !== "true" || process.env.PCC_GEMINI_DATA_PROCESSING_ACCEPTED !== "true") {
    return html('<h2>Bloqueado por política gratuita</h2><p>Verifique as confirmações autorizadas no ambiente Preview.</p>', 412);
  }
  if (!process.env.GEMINI_API_KEY?.trim()) {
    return html('<h2>Bloqueado: credencial ausente</h2><p>A chave Gemini não está disponível ao runtime Preview.</p>', 412);
  }
  const started = Date.now();
  try {
    const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite";
    const reply = await requestGeminiHealthText({ provider: "gemini", mode: "cloud", cost_class: "free", model_hint: model }, "Responde apenas PCC-OK.", 15000);
    const passed = reply.toUpperCase().includes("PCC-OK");
    console.info("PCC Gemini preview isolated real generation", { status: passed ? "passed" : "failed", model, latency_ms: Date.now() - started });
    return html(`<h2>${passed ? "APROVADO — Gemini respondeu" : "FALHOU — resposta inesperada"}</h2><p><strong>Modelo:</strong> ${safe(model)}</p><p><strong>Tempo:</strong> ${Date.now() - started} ms</p><p><strong>Resposta:</strong> ${safe(reply.slice(0, 120))}</p><p><small>Este resultado comprova apenas a chamada real nesta Preview. O perfil de produção permanece inalterado.</small></p><form method="get"><button type="submit">Voltar</button></form>`, passed ? 200 : 502);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Falha desconhecida";
    // Never expose provider response bodies or credentials on a public page or in logs.
    const httpCode = detail.match(/HTTP\s+(\d{3})/)?.[1] || detail.match(/HTTP\s+(\d{3})/i)?.[1];
    const category = httpCode ? `HTTP ${httpCode}` : /timeout|abort/i.test(detail) ? "Timeout" : /MODEL|NOT_CONFIGURED/.test(detail) ? "Configuração" : "Erro de comunicação";
    console.warn("PCC Gemini preview isolated real generation", { status: "failed", category, latency_ms: Date.now() - started });
    return html(`<h2>FALHOU — ${safe(category)}</h2><p>O fornecedor ainda não respondeu à chamada real. A chave e os detalhes sensíveis não são apresentados.</p><p><small>Tempo: ${Date.now() - started} ms</small></p>`, 502);
  }
}
