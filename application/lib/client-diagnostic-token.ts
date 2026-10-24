import { createHash, randomBytes } from "node:crypto";

export function hashClientDiagnosticToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createClientDiagnosticToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashClientDiagnosticToken(token) };
}

export function clientDiagnosticPublicUrl(token: string) {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") ||
    "https://project-command-center-seven-xi.vercel.app";
  return `${siteUrl}/client-diagnostic/${encodeURIComponent(token)}`;
}
