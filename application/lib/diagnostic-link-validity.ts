/** Controlo de validade do link público. Não substitui a verificação na RPC. */
export function isDiagnosticLinkUnavailable(expiresAt: string | null | undefined, status: string): boolean {
  const expiry = typeof expiresAt === "string" ? Date.parse(expiresAt) : Number.NaN;
  return !Number.isFinite(expiry) || expiry <= Date.now() || status === "expired" || status === "revoked";
}
