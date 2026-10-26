import { createHash, randomBytes } from "node:crypto";

export function hashProjectClientStatusToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createProjectClientStatusToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashProjectClientStatusToken(token) };
}

export function projectClientStatusPublicUrl(token: string) {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") ||
    "https://project-command-center-seven-xi.vercel.app";
  return `${siteUrl}/project-status/${encodeURIComponent(token)}`;
}
