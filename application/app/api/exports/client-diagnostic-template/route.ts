import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";

type Intent =
  | "idea"
  | "client_request"
  | "investment"
  | "internal_improvement"
  | "digital_solution"
  | "problem";

const labels: Record<Intent, string> = {
  idea: "Ideia / projecto a avaliar",
  client_request: "Pedido de um cliente",
  investment: "Oportunidade de negócio / investimento",
  internal_improvement: "Melhoria de processo interno",
  digital_solution: "Solução digital / produto",
  problem: "Problema a resolver",
};

const specific: Record<Intent, Array<{ title: string; options?: string[]; prompt?: string }>> = {
  idea: [
    { title: "3. Qual é a ideia?", prompt: "Descreva a ideia em poucas palavras." },
    {
      title: "4. O que é mais importante perceber primeiro?",
      options: ["Viabilidade", "Público / mercado", "Modelo de negócio", "Recursos necessários", "Riscos", "Próximos passos"],
    },
  ],
  client_request: [
    { title: "3. Qual é o pedido ou necessidade principal?", prompt: "Explique de forma breve o que pretende resolver ou alcançar." },
    {
      title: "4. O que está a gerar maior impacto hoje?",
      options: ["Tempo / atrasos", "Custos", "Vendas / receita", "Erros / retrabalho", "Experiência do cliente", "Controlo / informação", "Outro"],
    },
  ],
  investment: [
    {
      title: "3. O que procura obter com este investimento?",
      options: ["Nova fonte de rendimento", "Negócio próprio", "Investir capital disponível", "Diversificar", "Rendimento recorrente", "Negócio escalável", "Ainda estou a explorar"],
    },
    {
      title: "4. Que oportunidades está disposto a considerar?",
      options: ["Sem preferência", "Comércio / distribuição", "Serviços", "Tecnologia / digital", "Agricultura / alimentação", "Imobiliário", "Turismo", "Logística", "Saúde", "Educação", "Beleza", "Serviços financeiros"],
    },
  ],
  internal_improvement: [
    { title: "3. O que gostaria de melhorar?", prompt: "Descreva brevemente o processo ou situação actual." },
    {
      title: "4. Onde está hoje o principal impacto?",
      options: ["Atrasos", "Custos", "Erros / retrabalho", "Baixa produtividade", "Falta de controlo", "Dificuldade de coordenação", "Outro"],
    },
  ],
  digital_solution: [
    { title: "3. Que necessidade a solução deve resolver?", prompt: "Explique o problema ou oportunidade principal." },
    {
      title: "4. O que é essencial na solução?",
      options: ["Experiência simples", "Automação", "Dados / reporting", "Integrações", "Acesso mobile", "Segurança / permissões", "Escalabilidade", "Outro"],
    },
  ],
  problem: [
    { title: "3. O que está a acontecer?", prompt: "Explique de forma breve o problema e o contexto em que ocorre." },
    {
      title: "4. Qual é o principal impacto?",
      options: ["Tempo / atrasos", "Custos", "Perda de oportunidades", "Erros / retrabalho", "Insatisfação", "Risco", "Falta de controlo", "Outro"],
    },
  ],
};

function esc(value: string) {
  const replacements: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return value.replace(/[&<>"']/g, (char) => replacements[char] ?? char);
}

function options(items: string[]) {
  return `<div class="options">${items.map((item) => `<div>☐ ${esc(item)}</div>`).join("")}</div>`;
}

function question(title: string, body: string) {
  return `<section><h2>${esc(title)}</h2>${body}</section>`;
}

export async function GET(request: Request) {
  await requireUser();

  const url = new URL(request.url);
  const raw = url.searchParams.get("intent") as Intent | null;
  const intent: Intent = raw && raw in labels ? raw : "idea";

  let logoData = "";
  try {
    const logoResponse = await fetch(new URL("/brand/pcc-logo.png", request.url), { cache: "no-store" });
    if (logoResponse.ok) {
      const bytes = Buffer.from(await logoResponse.arrayBuffer()).toString("base64");
      logoData = `<img src="data:image/png;base64,${bytes}" alt="Project Command Center" class="logo" />`;
    }
  } catch {
    logoData = "";
  }

  const adaptive = specific[intent]
    .map((item) =>
      question(
        item.title,
        item.options
          ? options(item.options) + `<p class="detail"><strong>Detalhes adicionais:</strong> ________________________________________________</p>`
          : `<p class="hint">${esc(item.prompt ?? "")}</p><div class="lines"></div>`,
      ),
    )
    .join("");

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>PCC — Questionário Inicial de Diagnóstico</title>
<style>
  @page { margin: 18mm; }
  body { font-family: Aptos, Arial, sans-serif; color:#142825; background:#F8F6F0; margin:0; line-height:1.45; }
  .page { max-width:760px; margin:0 auto; background:white; padding:30px; }
  .header { border-bottom:1px solid #E0E8E3; padding-bottom:18px; margin-bottom:22px; }
  .logo { width:210px; height:auto; display:block; margin-bottom:12px; }
  .brand { color:#C99439; font-size:11px; letter-spacing:1.8px; text-transform:uppercase; font-weight:700; }
  h1 { color:#073F36; font-size:26px; margin:7px 0 5px; }
  .tagline { color:#146453; font-size:12px; font-weight:600; }
  .intro { background:#F8F6F0; border-left:4px solid #C99439; padding:14px 16px; margin:18px 0 22px; }
  .meta { font-size:12px; color:#667085; margin-top:8px; }
  section { border:1px solid #E0E8E3; border-radius:12px; padding:16px 18px; margin:0 0 14px; page-break-inside:avoid; }
  h2 { color:#073F36; font-size:15px; margin:0 0 10px; }
  .options { display:grid; grid-template-columns:1fr 1fr; gap:7px 18px; font-size:13px; }
  .detail,.hint { color:#667085; font-size:12px; margin-top:12px; }
  .lines { height:54px; border-bottom:1px solid #D8E3DE; border-top:1px solid #D8E3DE; margin-top:10px; }
  .identity { display:grid; grid-template-columns:1fr 1fr; gap:12px 20px; font-size:13px; }
  .field { border-bottom:1px solid #BFCFC8; min-height:22px; }
  .footer { border-top:1px solid #E0E8E3; margin-top:22px; padding-top:12px; text-align:center; font-size:11px; color:#667085; }
  .footer strong { color:#073F36; }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    ${logoData}
    <div class="brand">PCC — Avalie. Decida. Execute.</div>
    <h1>Questionário Inicial de Diagnóstico</h1>
    <div class="tagline">Da Estratégia à Execução</div>
  </div>

  <div class="intro">
    <strong>Porque estamos a perguntar?</strong><br/>
    Antes de recomendarmos uma solução, queremos compreender o essencial sobre o que procura, o contexto e o resultado pretendido.
    Este questionário foi preparado para tornar o diagnóstico mais focado e a próxima conversa mais objectiva.
    <div class="meta"><strong>Natureza:</strong> ${esc(labels[intent])} &nbsp; | &nbsp; <strong>Validade recomendada:</strong> 7 dias</div>
  </div>

  ${question("1. Fale-nos um pouco sobre si", `
    <div class="identity">
      <div>Nome<div class="field"></div></div>
      <div>Contacto<div class="field"></div></div>
      <div>Organização, se aplicável<div class="field"></div></div>
      <div>Função / cargo, se aplicável<div class="field"></div></div>
    </div>
  `)}

  ${question("2. Qual é o objectivo principal deste contacto?", `<p class="hint">Em poucas palavras, diga-nos o que gostaria de resolver, criar, avaliar ou alcançar.</p><div class="lines"></div>`)}

  ${adaptive}

  ${question("5. Que resultado gostaria de alcançar?", options([
    "Resolver o problema de forma prática",
    "Aumentar vendas / rendimento",
    "Reduzir custos",
    "Poupar tempo / aumentar eficiência",
    "Criar ou lançar algo novo",
    "Ganhar maior controlo / informação",
    "Encontrar uma oportunidade viável",
    "Tomar uma decisão mais segura",
  ]) + `<p class="detail"><strong>Resultado prioritário:</strong> ________________________________________________</p>`)}

  ${question("6. O que devemos considerar desde o início?", options([
    "Existe orçamento / capital definido",
    "Existe um prazo importante",
    "Existem recursos limitados",
    "Existem sistemas / tecnologia a manter",
    "Existem requisitos legais / regulatórios",
    "Existem requisitos de segurança / confidencialidade",
    "É necessária aprovação de outras pessoas",
    "Pretendo começar pequeno e validar antes de escalar",
  ]) + `<p class="detail"><strong>Detalhes adicionais:</strong> ________________________________________________</p>`)}

  ${question("7. Qual é a prioridade neste momento?", options([
    "Avançar imediatamente",
    "Avançar nas próximas semanas",
    "Avaliar primeiro e depois decidir",
    "Explorar possibilidades",
  ]) + `<p class="detail"><strong>Data importante, se existir:</strong> ________________________________________</p>`)}

  ${question("8. O que tornaria esta iniciativa valiosa para si?", options([
    "Resultado financeiro positivo",
    "Solução prática e utilizável",
    "Decisão mais segura",
    "Maior eficiência",
    "Mais vendas / clientes / rendimento",
    "Maior capacidade de crescimento",
    "Maior controlo / visibilidade",
    "Plano claro para os próximos passos",
  ]) + `<p class="detail"><strong>Meta ou indicador específico:</strong> ________________________________________</p>`)}

  <div class="footer">
    <strong>PCC — Avalie. Decida. Execute.</strong><br/>Da Estratégia à Execução
  </div>
</div>
</body>
</html>`;

  const filename = `PCC_Questionario_Diagnostico_${intent}.doc`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "application/msword; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
