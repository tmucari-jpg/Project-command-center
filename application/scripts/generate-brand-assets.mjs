import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";

const source = process.argv[2];
if (!source) throw new Error("Logo source path is required.");

const publicDir = path.resolve("public");
await fs.mkdir(path.join(publicDir, "brand"), { recursive: true });
await fs.mkdir(path.join(publicDir, "icons"), { recursive: true });

const logo = sharp(source);
const meta = await logo.metadata();
if (!meta.width || !meta.height) throw new Error("Invalid logo image.");

// Preserve the official horizontal logo exactly as supplied.
await sharp(source).png({ compressionLevel: 9 }).toFile(path.join(publicDir, "brand", "pcc-logo.png"));

// The official symbol is the left block of the supplied 550x182 artwork.
const symbolWidth = Math.round(meta.width * 0.313);
const symbol = sharp(source).extract({ left: 0, top: 0, width: symbolWidth, height: meta.height }).trim({
  background: "#ffffff",
  threshold: 10,
});

async function makeIcon(size, file, paddingRatio) {
  const inner = Math.round(size * (1 - paddingRatio * 2));
  const buffer = await symbol.clone().resize(inner, inner, { fit: "contain" }).png().toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: "#ffffff" },
  })
    .composite([{ input: buffer, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(publicDir, "icons", file));
}

await makeIcon(192, "icon-192.png", 0.10);
await makeIcon(512, "icon-512.png", 0.10);
await makeIcon(512, "icon-maskable-512.png", 0.16);
await makeIcon(180, "apple-touch-icon.png", 0.10);

console.log("Official PCC brand assets generated.");
