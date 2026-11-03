import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";

describe("segregated GIE360 identity", () => {
  it("keeps the exact supplied logo and decodable installable icon sizes", async () => {
    const logo = await readFile("public/gie360/logo.png");
    expect(createHash("sha256").update(logo).digest("hex")).toBe("31db5f4da292b7b338a628fc897c178a38f0c6cd1a57390974ab4293a9cc17b2");
    for (const [file, size] of [["icon-192.png", 192], ["icon-512.png", 512], ["icon-maskable-512.png", 512], ["apple-touch-icon.png", 180]] as const) {
      const png = PNG.sync.read(await readFile(`public/gie360/${file}`), { checkCRC: true });
      expect([png.width, png.height]).toEqual([size, size]);
    }
    expect(await readFile("../gie360-android/app/src/main/res/drawable/gie360_icon.png")).toEqual(await readFile("public/gie360/icon-maskable-512.png"));
  });
  it("scopes installation and caches to its own product", async () => {
    const manifest = JSON.parse(await readFile("public/gie360/manifest.webmanifest", "utf8"));
    expect(manifest.id).toBe("/gie360/"); expect(manifest.scope).toBe("/gie360/");
    expect(manifest.start_url).toBe("/gie360/"); expect(manifest.name).toContain("GIE360°");
    expect(manifest.icons.every((icon: { src: string }) => icon.src.startsWith("/gie360/"))).toBe(true);
    const pcc = await readFile("public/sw.js", "utf8");
    expect(pcc).toContain('url.pathname.startsWith("/gie360/")');
    expect(pcc).toContain('key.startsWith("project-command-center-")');
    const gie = await readFile("public/gie360/sw.js", "utf8");
    expect(gie).not.toContain("cache.put");
    expect(gie).toContain('key.startsWith("gie360-static-")');
  });
});
