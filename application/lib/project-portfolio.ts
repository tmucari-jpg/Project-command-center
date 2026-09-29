export type PlannedAction = { title: string; evidence: string; priority?: "medium" | "high" };
export type PortfolioProject = {
  name: string;
  aliases?: string[];
  description: string;
  customer: string;
  offer: string;
  revenue: string;
  validation: string;
  actions: PlannedAction[];
};

export const portfolio: PortfolioProject[] = [
  {
    name: "Contra — freelancing", description: "Criar presença profissional na Contra e fechar os primeiros trabalhos de AI Operations e automação.",
    customer: "PME e equipas que precisam de automatizar processos e medir resultados.",
    offer: "Diagnóstico de processo, automação de um fluxo e painel de resultados; depois suporte mensal opcional.",
    revenue: "Preço fechado por entregável com escopo e marcos; manutenção recorrente só após validar a primeira entrega.",
    validation: "Perfil publicado, propostas qualificadas, primeira conversa e primeiro pagamento recebido.",
    actions: [
      { title: "Definir 2 serviços freelance com entregáveis e prazo", evidence: "Descrição dos serviços e limites do escopo", priority: "high" },
      { title: "Preparar 4 amostras de trabalho para o portefólio", evidence: "Quatro casos demonstráveis sem dados confidenciais" },
      { title: "Criar conta e completar perfil profissional na Contra", evidence: "Perfil público com foto, apresentação, competências, tarifa e ligação social", priority: "high" },
      { title: "Publicar serviços e portefólio na Contra", evidence: "Serviços e casos visíveis no perfil" },
      { title: "Verificar método de recebimento e condições antes de aceitar trabalho", evidence: "Método disponível e custos compreendidos" },
      { title: "Seleccionar 10 oportunidades alinhadas com os serviços", evidence: "Lista de oportunidades qualificadas" },
      { title: "Enviar 5 propostas personalizadas e acompanhar respostas", evidence: "Cinco propostas com escopo, prazo e preço" },
      { title: "Entregar primeiro projecto e pedir testemunho", evidence: "Entrega aceite, pagamento e autorização para caso de estudo" },
    ],
  },
  {
    name: "Moz Task", description: "App em definição: validar o problema, os utilizadores e o modelo comercial antes de ampliar o produto.",
    customer: "Segmento a confirmar em entrevistas.", offer: "Serviço principal da app a definir com base numa necessidade demonstrada.",
    revenue: "Testar taxa por transacção se houver intermediação; caso contrário comparar subscrição e licença B2B.",
    validation: "Dez entrevistas, três testes reais do serviço e uma primeira transacção paga ou carta de intenção.",
    actions: [
      { title: "Escrever a proposta de valor e a função principal do Moz Task", evidence: "Problema, utilizador e resultado em uma página", priority: "high" },
      { title: "Entrevistar 10 potenciais utilizadores do Moz Task", evidence: "Notas de entrevistas e problemas recorrentes" },
      { title: "Mapear o percurso do utilizador e o fluxo de pagamento", evidence: "Protótipo de ponta a ponta" },
      { title: "Testar 3 utilizações reais e medir conclusão", evidence: "Três testes com taxa de conclusão" },
      { title: "Comparar comissão, subscrição e licença para Moz Task", evidence: "Modelo escolhido com cálculo de margem" },
      { title: "Executar primeira venda ou piloto pago do Moz Task", evidence: "Pagamento ou acordo de piloto" },
    ],
  },
  {
    name: "Maana", description: "App: validar caso de uso e disposição a pagar.",
    customer: "Utilizador e comprador a identificar separadamente.", offer: "Funcionalidade principal a demonstrar num piloto limitado.",
    revenue: "Testar subscrição individual e licença para organizações apenas depois de definir o segmento.",
    validation: "Dez entrevistas, cinco utilizadores recorrentes e um piloto pago.",
    actions: [
      { title: "Definir o problema e o público principal da Maana", evidence: "Ficha de produto com público e resultado", priority: "high" },
      { title: "Entrevistar 10 potenciais utilizadores da Maana", evidence: "Padrões e objecções documentados" },
      { title: "Delimitar uma funcionalidade essencial para o piloto da Maana", evidence: "Protótipo e métrica de sucesso" },
      { title: "Testar retenção com 5 utilizadores da Maana", evidence: "Utilizações repetidas registadas" },
      { title: "Apresentar oferta paga a 3 potenciais compradores da Maana", evidence: "Três respostas sobre preço e valor" },
    ],
  },
  {
    name: "Rhengo", description: "App: testar uma oferta comercial ligada ao seu benefício central.",
    customer: "Segmento a identificar em descoberta.", offer: "Piloto com resultado mensurável para um grupo pequeno.",
    revenue: "Comparar pagamento por utilização e subscrição; escolher com base em frequência e custo de serviço.",
    validation: "Dez entrevistas, três pilotos concluídos e uma compra ou compromisso pago.",
    actions: [
      { title: "Definir o problema e o público principal da Rhengo", evidence: "Ficha de produto e hipótese de valor", priority: "high" },
      { title: "Entrevistar 10 potenciais utilizadores da Rhengo", evidence: "Necessidades e alternativas documentadas" },
      { title: "Criar fluxo mínimo de utilização da Rhengo", evidence: "Protótipo testável" },
      { title: "Medir custo e frequência em 3 pilotos da Rhengo", evidence: "Custos, uso e resultado por piloto" },
      { title: "Testar uma oferta paga da Rhengo", evidence: "Proposta e resposta do comprador" },
    ],
  },
  {
    name: "Briefing Diário", description: "Informação diária e radar de oportunidades para assinantes.",
    customer: "Leitores e organizações que precisam de informação seleccionada sobre Moçambique, África e mundo.",
    offer: "Edição diária clara, actualizada, sem repetição e com radar de oportunidades verificadas.",
    revenue: "Assinaturas semanal, mensal, trimestral, semestral e anual; testar pacote para equipas depois da retenção individual.",
    validation: "Pagamento concluído, taxa de renovação, leitura recorrente e cancelamentos por motivo.",
    actions: [
      { title: "Rever frescura, fontes originais e duplicados do Briefing Diário", evidence: "Checklist editorial e edição verificada", priority: "high" },
      { title: "Corrigir idioma e compreensão dos áudios", evidence: "Teste das vozes e separação por regiões" },
      { title: "Testar pagamento, confirmação e acesso após compra", evidence: "Compra de teste do início ao acesso", priority: "high" },
      { title: "Publicar página de planos e benefícios do Briefing Diário", evidence: "Página com preços, condições e chamada para compra" },
      { title: "Convidar 20 leitores qualificados para testar a oferta", evidence: "Convites, conversões e objecções" },
      { title: "Medir retenção e renovação das primeiras assinaturas", evidence: "Painel de assinaturas e cancelamentos" },
    ],
  },
  {
    name: "Roadmap AI Operations 2026", description: "Construir capacidade, prova e receita em serviços de automação.",
    customer: "PME com processos manuais e pouca visibilidade operacional.", offer: "Diagnóstico, implementação de um fluxo e medição antes/depois.",
    revenue: "Projecto de implementação com preço fechado, seguido de suporte mensal opcional.",
    validation: "Um cliente pago, entrega mensurável e testemunho.",
    actions: [
      { title: "Definir oferta de entrada de AI Operations", evidence: "Escopo, prazo, preço e exclusões", priority: "high" },
      { title: "Construir caso demonstrável com resultado antes/depois", evidence: "Caso de estudo e métrica" },
      { title: "Contactar 20 clientes potenciais de AI Operations", evidence: "Lista e registo de contactos" },
      { title: "Enviar propostas de automação a 5 leads qualificados", evidence: "Propostas personalizadas" },
    ],
  },
  {
    name: "AM Solutions / presença de marca", description: "Canal comercial para os serviços de AI Operations.",
    customer: "Empresas que pretendem simplificar gestão e automação.", offer: "Pacotes de diagnóstico, implementação e acompanhamento.",
    revenue: "Vender serviços B2B; a marca é canal de aquisição e não uma fonte de receita separada.",
    validation: "Leads qualificados, propostas e contratos atribuídos ao canal.",
    actions: [
      { title: "Definir posicionamento e serviços da AM Solutions", evidence: "Página de oferta e cliente alvo" },
      { title: "Verificar conflitos de emprego e uso de materiais", evidence: "Regras verificadas antes da divulgação", priority: "high" },
      { title: "Publicar presença comercial e captar 10 leads", evidence: "Página activa e lista de leads" },
    ],
  },
  {
    name: "App de IA", description: "Produto em avaliação no roadmap de aprendizagem e receita.",
    customer: "Segmento a determinar por caso de uso.", offer: "Uma tarefa bem definida resolvida pelo produto.",
    revenue: "Piloto pago ou licença B2B após provar poupança de tempo e custo por utilização.",
    validation: "Três organizações interessadas, utilização real e margem positiva por cliente.",
    actions: [
      { title: "Decidir se a App de IA reforça a meta comercial de Novembro", evidence: "Decisão continuar, adiar ou redefinir", priority: "high" },
      { title: "Definir caso de uso e custo por execução da App de IA", evidence: "Fluxo e estimativa de margem" },
      { title: "Apresentar piloto da App de IA a 3 compradores", evidence: "Respostas e condições de compra" },
    ],
  },
  {
    name: "Easy Propriety", aliases: ["Easy Property"], description: "Projecto imobiliário em planeamento.",
    customer: "Clientes imobiliários a segmentar.", offer: "Serviço concreto a definir com proprietários e compradores.",
    revenue: "Testar mensalidade profissional ou taxa por serviço concluído após verificar operações e regras locais.",
    validation: "Entrevistas com os dois lados e primeiro serviço pago.",
    actions: [
      { title: "Definir utilizadores e problema da Easy Propriety", evidence: "Mapa do serviço e beneficiários" },
      { title: "Validar fluxo imobiliário e requisitos locais", evidence: "Fluxo e requisitos documentados" },
      { title: "Testar proposta comercial da Easy Propriety", evidence: "Três conversas e primeira oferta" },
    ],
  },
  {
    name: "Nosso Ride", description: "Projecto de mobilidade em planeamento.",
    customer: "Passageiros e operadores a segmentar.", offer: "Serviço de mobilidade com benefício e área de operação definidos.",
    revenue: "Testar taxa por viagem ou contrato com operadores, após medir oferta, procura e custos.",
    validation: "Piloto com viagens reais e margem por viagem positiva.",
    actions: [
      { title: "Delimitar zona, utilizadores e proposta do Nosso Ride", evidence: "Mapa do piloto e procura estimada" },
      { title: "Verificar requisitos operacionais e de segurança", evidence: "Checklist antes do piloto" },
      { title: "Medir custo, preço e margem de um piloto de viagens", evidence: "Resultado por viagem" },
    ],
  },
  {
    name: "Melhorar a articulação pública", description: "Desenvolver clareza, estrutura e confiança ao falar em apresentações, reuniões e propostas.",
    customer: "Competência pessoal aplicada a clientes, parceiros e equipas.",
    offer: "Apresentações mais claras para explicar projectos, defender propostas e conduzir conversas comerciais.",
    revenue: "Impacto indirecto: melhorar a conversão das propostas e oportunidades dos outros projectos; não criar uma cobrança separada nesta fase.",
    validation: "Comparar uma gravação inicial e uma final, recolher feedback e medir conversas que avançam para proposta.",
    actions: [
      { title: "Gravar apresentação inicial de 2 minutos sobre um projecto", evidence: "Vídeo inicial e auto-avaliação de clareza", priority: "high" },
      { title: "Criar estrutura de abertura, três pontos e conclusão", evidence: "Guião reutilizável para apresentações" },
      { title: "Praticar duas apresentações curtas por semana", evidence: "Quatro gravações em duas semanas" },
      { title: "Pedir feedback sobre clareza, ritmo e capacidade de resposta", evidence: "Feedback de pelo menos duas pessoas" },
      { title: "Apresentar uma proposta real e registar o resultado", evidence: "Reunião realizada e próximo passo comercial" },
      { title: "Comparar gravação final com a linha de base", evidence: "Melhorias identificadas e plano seguinte" },
    ],
  },
];
