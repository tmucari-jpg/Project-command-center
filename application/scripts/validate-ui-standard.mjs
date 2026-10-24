import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const textFiles = [];

function walkVisible(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkVisible(full);
    else if (/\.tsx$/.test(entry.name)) textFiles.push(full);
  }
}

walkVisible(path.join(root, "app"));
walkVisible(path.join(root, "components"));
textFiles.push(path.join(root, "public", "offline.html"), path.join(root, "public", "sw.js"));

const forbidden = [
  { name: "referência ao logótipo SVG antigo", re: /\/brand\/pcc-logo\.svg/g },
  { name: "referência ao ícone SVG antigo", re: /\/icons\/app-icon\.svg/g },
  { name: "classe azul fora da paleta PCC", re: /(?:text|bg|border|ring|hover:bg|hover:text)-blue-\d+/g },
  { name: "termo pt-BR: usuário", re: /\busuários?\b/gi },
  { name: "termo pt-BR: senha", re: /\bsenhas?\b/gi },
  { name: "termo pt-BR: arquivo", re: /\barquivos?\b/gi },
  { name: "termo pt-BR: projeto", re: /\bprojetos?\b/gi },
  { name: "exemplo antigo Easy Property", re: /Easy Property/g },
  { name: "detalhe interno de fornecedor", re: /Qwen local indisponível|Cloud:\s*\$\{/g },
];

const errors = [];
for (const file of textFiles) {
  if (!fs.existsSync(file)) continue;
  const content = fs.readFileSync(file, "utf8");
  for (const rule of forbidden) {
    if (rule.re.test(content)) errors.push(`${path.relative(root, file)}: ${rule.name}`);
    rule.re.lastIndex = 0;
  }
}

const requiredChecks = [
  ["app/layout.tsx", 'lang="pt-MZ"'],
  ["app/layout.tsx", "LanguageProvider"],
  ["app/manifest.ts", 'lang: "pt-MZ"'],
  ["app/page.tsx", 'src="/brand/pcc-logo-transparent.svg"'],
  ["app/page.tsx", "LanguageSwitcher"],
  ["components/auth-form.tsx", 'src="/brand/pcc-logo-transparent.svg"'],
  ["components/auth-form.tsx", "LanguageSwitcher"],
  ["app/(protected)/commercial-master/page.tsx", 'title="Guia Comercial do PCC"'],
  ["app/(protected)/monetization/page.tsx", "Abrir Guia Comercial do PCC"],
  ["app/api/exports/commercial-master/route.ts", "Snapshot Operacional Comercial do PCC"],
  ["app/(protected)/help/page.tsx", "Referências comerciais e de governação"],
  ["components/app-shell.tsx", "LanguageSwitcher"],
  ["components/language-provider.tsx", 'const STORAGE_KEY = "pcc-language"'],
  ["components/language-switcher.tsx", "PT"],
  ["components/language-switcher.tsx", "ENG"],
  ["components/sidebar.tsx", 'src="/icons/icon-192.png"'],
  ["components/app-shell.tsx", 'src="/icons/icon-192.png"'],
  ["public/offline.html", 'src="/brand/pcc-logo.png"'],
  ["public/offline.html", 'id="langPt"'],
  ["public/offline.html", 'id="langEn"'],
  ["app/auth/actions.ts", "data.user?.identities && data.user.identities.length === 0"],
  ["app/auth/actions.ts", "await supabase.auth.signOut()"],
];

for (const [relative, expected] of requiredChecks) {
  const full = path.join(root, relative);
  const content = fs.readFileSync(full, "utf8");
  if (!content.includes(expected)) errors.push(`${relative}: padrão obrigatório ausente (${expected})`);
}

if (errors.length) {
  console.error("PCC UI standard validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("PCC UI standard: OK (marca oficial + pt-MZ/ENG + autenticação).");
