import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const expected = new Map([
  ["public/brand/pcc-logo.png", { hash: "20b3c80fcfa3a55b43e12a32622e693ba2abc2eaba5fd0706f668a29d154cde5" }],
  ["public/icons/pcc-app-icon-192-v2.png", { width: 192, height: 192, hash: "f83993795a6ba53f53309e141483badffaff1c437ede20d259f6affe88680786" }],
  ["public/icons/pcc-app-icon-512-v2.png", { width: 512, height: 512, hash: "c7ca3dce28656f5033a7af09af4f7d90f580e84b6a1ceeda9d82e3ec3d1606c2" }],
  ["public/icons/pcc-app-icon-maskable-512-v2.png", { width: 512, height: 512, hash: "1ff65a7fbd74f9de6780b96d905d7c394bc85c9199d23f886496357a6f5a0c02" }],
  ["public/icons/pcc-apple-touch-icon-v2.png", { width: 192, height: 192, hash: "f83993795a6ba53f53309e141483badffaff1c437ede20d259f6affe88680786" }],
]);

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

for (const [file, rule] of expected) {
  const full = path.resolve(process.cwd(), file);
  const data = fs.readFileSync(full);
  const hash = crypto.createHash("sha256").update(data).digest("hex");
  if (hash !== rule.hash) throw new Error(`Activo visual PCC alterado sem validaÃ§Ã£o: ${file}`);

  if (rule.width) {
    if (!data.subarray(0, 8).equals(pngSignature)) throw new Error(`PNG PCC invÃ¡lido: ${file}`);
    const width = data.readUInt32BE(16);
    const height = data.readUInt32BE(20);
    if (width !== rule.width || height !== rule.height) {
      throw new Error(`D¶»§q«^