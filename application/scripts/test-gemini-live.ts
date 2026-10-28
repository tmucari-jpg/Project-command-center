/** Optional real-provider probe. Synthetic data only; never loads project or client data. */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { isFreeAIEligible, requestAIText } from "../lib/ai-runtime";

type ProbeCheck = { name: string; status: "passed" | "failed" | "blocked"; reason?: string };
async function main() {
  const args = new Set(process.argv.slice(2));
  const checks: ProbeCheck[] = [];
  const reportPath = resolve(process.env.PCC_GEMINI_REPORT_PATH || "../validation-gemini.json");
  let status: "passed" | "failed" | "blocked" = "blocked";
  const profile = { provider: "gemini", mode: "cloud" as const, enabled: true, cost_class: "free", model_hint: process.env.GEMINI_MODEL?.trim() };
  const missing = [!args.has("--live") && "live probe not requested", !process.env.GEMINI_API_KEY?.trim() && "server key missing", !profile.model_hint && "model missing", !isFreeAIEligible(profile) && "free-tier and data-processing configuration not confirmed"].filter(Boolean);
  try {
    if (missing.length) {
      checks.push({ name: "real-gemini-generation", status: "blocked", reason: missing.join("; ") });
    } else {
      const healthyText = await requestAIText(profile, "Responde apenas OK.", undefined, 20_000, 512);
      if (!healthyText.trim()) throw new Error("empty health response");
      checks.push({ name: "real-gemini-generation", status: "passed" });
      const instructions = "Responde apenas JSON válido sem markdown. Usa só os dados sintéticos apresentados. Não inventes dados em falta nem calcules lucro a partir de vendas. Forma exacta: {\"total_mzn\":number,\"conversion_rate_pct\":number,\"missing_data\":[string]}. Para lucro ausente usa missing_data=[\"profit\"].";
      const factual = await requestAIText(profile, "Dados sintéticos, sem informação de pessoas reais: vendas MZN 80 e MZN 40; leads 10; clientes convertidos 0; não existem custos nem dados de lucro. Qual o total de vendas MZN, a conversão percentual e a informação em falta?", instructions, 20_000, 1024);
      const json = JSON.parse(factual.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")) as Record<string, unknown>;
      if (json.total_mzn !== 120 || json.conversion_rate_pct !== 0 || !Array.isArray(json.missing_data) || !json.missing_data.includes("profit")) throw new Error("synthetic factual answer did not preserve totals, observed zero and missing profit");
      checks.push({ name: "portuguese-synthetic-facts-zero-and-missing-data", status: "passed" });
      status = "passed";
    }
  } catch (error) {
    // Keep provider bodies and credentials out of the archived report.
    const message = error instanceof Error ? error.message : "provider probe failed";
    const code = message.match(/HTTP (\d{3})/)?.[0];
    checks.push({ name: "real-gemini-probe", status: "failed", reason: code || "generation or factual-output validation failed; inspect provider health securely" });
    status = "failed";
  } finally {
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, JSON.stringify({ scope: "synthetic-real-gemini-only", status, checks, model: profile.model_hint || null, realAIValidated: status === "passed", limitations: ["This bounded probe does not guarantee provider availability or all Portuguese responses.", "Business indicators remain deterministic and require approved evidence.", "Physical PWA/APK validation is separate."] }, null, 2));
    console.log(`Gemini live validation: ${status}. Report: ${reportPath}`);
    if (status === "failed" || (status === "blocked" && args.has("--required"))) process.exitCode = 1;
  }
}
main().catch(() => { console.error("Unable to write Gemini validation report."); process.exitCode = 1; });
