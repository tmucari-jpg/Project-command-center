import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const source = fs.readFileSync(path.resolve(root, "public/brand/pcc-logo-transparent.svg"), "utf8");
const match = source.match(/href="data:image\/png;base64,([^"]+)"/);
if (!match) throw new Error("Logo oficial PCC sem imagem incorporada.");
const officialImage = match[1];

for (const file of ["public/icons/pcc-app-icon-v2.svg", "public/icons/pcc-app-icon-maskable-v2.svg"]) {
  const svg = fs.readFileSync(path.resolve(root, file), "utf8");
  if (!svg.includes(officialImage)) throw new Error(`Ícone não deriva do logo oficial PCC: ${file}`);
  if (!svg.includes('viewBox="0 0 512 512"')) throw new Error(`Ícone PCC sem canvas quadrado 512: ${file}`);
  if (!svg.includes('fill="#f8f6f0"')) throw new Error(`Ícone PCC fora do fundo visual aprovado: ${file}`);
}
console.log("PCC icon assets: OK (derivados directamente do logo oficial).");
