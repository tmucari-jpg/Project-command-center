"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type PccLanguage = "pt" | "en";
const STORAGE_KEY = "pcc-language";
const PT_TO_EN = Object.fromEntries([["Da estratégia à execução","From strategy to execution"],["Entre no Project Command Center ou crie uma nova conta para começar.","Sign in to Project Command Center or create a new account to get started."],["Abrir PCC","Open PCC"],["Usar outra conta","Use another account"],["Entrar","Sign in"],["Criar conta","Create account"],["Recuperar acesso","Recover access"],["Definir nova palavra-passe","Set a new password"],["Nome completo","Full name"],["Palavra-passe","Password"],["A processar...","Processing..."],["Enviar instruções","Send instructions"],["Actualizar palavra-passe","Update password"],["Ainda não tem conta?","Don't have an account yet?"],["Esqueci a palavra-passe","Forgot password"],["Voltar ao login","Back to sign in"],["Ir para o dashboard","Go to dashboard"],["Sair","Sign out"],["Instalar app","Install app"],["Instalar","Install"],["Começar","Start"],["Executar","Execute"],["Validar","Validate"],["Apoio","Support"],["Resumo","Overview"],["Novo projecto","New project"],["Objectivos","Objectives"],["Projectos","Projects"],["Entregáveis","Deliverables"],["Acções","Actions"],["Foco","Focus"],["Agenda","Agenda"],["Bloqueios","Blockers"],["Automações","Automations"],["Evidências","Evidence"],["Métricas","Metrics"],["Decisões","Decisions"],["Revisão","Review"],["Ideias","Ideas"],["Ajuda","Help"],["Administração","Administration"],["Automação","Automation"],["Novo","New"],["Navegação principal","Main navigation"],["Ajuda e administração","Help and administration"],["Visão geral","Overview"],["Portfólio","Portfolio"],["Planeamento","Planning"],["Execução","Execution"],["Resultados","Results"],["Risco","Risk"],["Memória","Memory"],["Comprovação","Evidence"],["Auditoria","Audit"],["Actividade","Activity"],["Fábrica de Projectos","Project Factory"],["Diga o que pretende criar","Describe what you want to create"],["Nome da ideia ou projecto","Idea or project name"],["Que problema quer resolver?","What problem do you want to solve?"],["O que espera conseguir?","What do you expect to achieve?"],["Tipo","Type"],["Descrição adicional","Additional description"],["Restrições conhecidas","Known constraints"],["Origem da ideia","Idea source"],["Comercial","Commercial"],["Interno","Internal"],["Não comercial","Non-commercial"],["Ideia recebida","Idea received"],["Em análise","Under review"],["Inteligência competitiva","Competitive intelligence"],["Inteligência Competitiva","Competitive Intelligence"],["Validação","Validation"],["Teste","Test"],["Preparação final","Final preparation"],["Decisão","Decision"],["Convertido em projecto","Converted to project"],["Em espera","On hold"],["Encerrado","Closed"],["Contexto do projecto","Project context"],["Etapa actual","Current stage"],["Público-alvo","Target audience"],["Valor esperado","Expected value"],["Mercado e oportunidade","Market and opportunity"],["Concorrência e alternativas existentes","Competitors and existing alternatives"],["Diferenciação possível","Potential differentiation"],["Tendências relevantes","Relevant trends"],["Riscos e barreiras","Risks and barriers"],["Fontes / evidências","Sources / evidence"],["Confiança da análise","Analysis confidence"],["Guardar rascunho","Save draft"],["Concluir e avançar para Validação","Complete and move to Validation"],["Hipóteses críticas","Critical hypotheses"],["Plano de validação","Validation plan"],["Evidência observada","Observed evidence"],["Resultado da validação","Validation result"],["Recomendação","Recommendation"],["Avançar","Proceed"],["Ajustar e validar novamente","Adjust and validate again"],["Colocar em espera","Put on hold"],["Teste necessário antes da preparação final","Test required before final preparation"],["Concluir Validação","Complete Validation"],["Abrir teste","Open test"],["Resumo consolidado","Consolidated summary"],["Tecnologia necessária","Required technology"],["Custo estimado","Estimated cost"],["Modelo de receita / sustentabilidade","Revenue / sustainability model"],["Regulamentação / requisitos legais","Regulation / legal requirements"],["Probabilidade de execução (%)","Execution probability (%)"],["Probabilidade de adopção (%)","Adoption probability (%)"],["Consolidar preparação final","Consolidate final preparation"],["Decisão final","Final decision"],["Justificação da decisão","Decision rationale"],["Registar decisão","Record decision"],["Título","Title"],["Descrição","Description"],["Prioridade","Priority"],["Estado","Status"],["Prazo","Deadline"],["Data","Date"],["Data inicial","Start date"],["Progresso (%)","Progress (%)"],["Resultado esperado","Expected result"],["Métrica principal","Primary metric"],["Valor inicial","Baseline value"],["Valor alvo","Target value"],["Valor actual","Current value"],["Observações","Notes"],["Projecto","Project"],["Sem projecto","No project"],["Sem projecto associado","No associated project"],["Projecto relacionado","Related project"],["Entregável","Deliverable"],["Sem entregável","No deliverable"],["Acção","Action"],["Critério de conclusão","Completion criterion"],["Tempo estimado (min)","Estimated time (min)"],["Responsável","Owner"],["Prazo de resolução","Resolution deadline"],["Solução","Solution"],["Impacto","Impact"],["Origem","Source"],["Potencial","Potential"],["Próxima decisão","Next decision"],["Próxima acção","Next action"],["Data da próxima acção","Next action date"],["Organização","Organisation"],["Referência de contacto","Contact reference"],["Oferta","Offer"],["Cliente ideal","Ideal customer"],["Preço","Price"],["Moeda","Currency"],["Canal","Channel"],["Estado de validação","Validation status"],["Potencial cliente","Potential customer"],["Potenciais clientes","Potential customers"],["Funil comercial","Sales funnel"],["Monetização","Monetisation"],["Monetização e subscrições","Monetisation and subscriptions"],["Planos","Plans"],["Pagamentos","Payments"],["Funil de hoje","Today's funnel"],["Aquisição","Acquisition"],["Iniciaram pagamento","Started payment"],["Pagaram","Paid"],["Activados","Activated"],["Retidos","Retained"],["Cancelamentos","Cancellations"],["Notas","Notes"],["Guardar métricas","Save metrics"],["Último funil registado","Latest recorded funnel"],["Aquisição → pagamento","Acquisition → payment"],["Conversão pagamento","Payment conversion"],["Activação","Activation"],["Retenção","Retention"],["Execução automática","Automated execution"],["Registar automação","Register automation"],["Modo de execução","Execution mode"],["Aprovação humana","Human approval"],["Não obrigatória","Not required"],["Obrigatória","Required"],["Nova execução","New execution"],["Sem automação específica","No specific automation"],["Rota de execução","Execution route"],["Sem rota associada","No associated route"],["Projecto em preparação","Project in preparation"],["Sem projecto em preparação","No project in preparation"],["Dados adicionais","Additional data"],["O que deve ser executado?","What should be executed?"],["Adicionar à fila","Add to queue"],["Fila de execução","Execution queue"],["Aprovar","Approve"],["Executar agora","Run now"],["Agentes","Agents"],["Agente","Agent"],["Agentes disponíveis","Available agents"],["Execuções recentes","Recent runs"],["Aprovações humanas","Human approvals"],["Sem aprovações pendentes.","No pending approvals."],["Agente de Coordenação","Coordination Agent"],["Agente de Pesquisa","Research Agent"],["Agente de Negócio","Business Agent"],["Agente de Marketing","Marketing Agent"],["Agente de Produto","Product Agent"],["Agente de Qualidade","Quality Agent"],["Agente de Análise","Analytics Agent"],["Orquestração","Orchestration"],["Nova rota","New route"],["Tipo de tarefa","Task type"],["Factualidade necessária","Required factuality"],["Sensibilidade a custo","Cost sensitivity"],["Seleccionar rota","Select route"],["Rotas recentes","Recent routes"],["Biblioteca","Library"],["Adicionar activo","Add asset"],["Conteúdo / aprendizagem","Content / learning"],["Adicionar à biblioteca","Add to library"],["Conhecimento consolidado","Consolidated knowledge"],["Aprovar para reutilização","Approve for reuse"],["Inteligência","Intelligence"],["Optimização","Optimisation"],["Segurança e escala","Security and scale"],["Configuração de IA","AI configuration"],["Serviços disponíveis","Available services"],["Segurança","Security"],["Fila de sincronização","Sync queue"],["Não existem operações pendentes de sincronização.","There are no pending sync operations."],["Manual rápido do Project Command Center","Project Command Center quick guide"],["Actualizar","Update"],["Guardar","Save"],["Eliminar","Delete"],["Cancelar","Cancel"],["Baixa","Low"],["Média","Medium"],["Alta","High"],["Crítica","Critical"],["Rascunho","Draft"],["Activo","Active"],["No prazo","On track"],["Em risco","At risk"],["Atrasado","Delayed"],["Concluído","Completed"],["Cancelado","Cancelled"],["Ideia","Idea"],["Em planeamento","Planning"],["Pendente","Pending"],["Bloqueado","Blocked"],["Em curso","In progress"],["Aberto","Open"],["Resolvido","Resolved"],["Ignorado","Ignored"],["Capturada","Captured"],["Em avaliação","Under evaluation"],["Aprovada","Approved"],["Rejeitada","Rejected"],["Arquivada","Archived"],["Ficheiro","File"],["Ligação","Link"],["Documento","Document"],["Captura de ecrã","Screenshot"],["Comentário","Comment"],["Número","Number"],["Resultado","Result"],["Referência externa","External reference"],["Personalizada","Custom"],["Na fila","Queued"],["A iniciar","Starting"],["Falhou","Failed"],["Medido","Measured"],["Candidato","Candidate"],["Manual","Manual"],["Sistema","System"],["Gerado","Generated"],["Contactado","Contacted"],["Qualificado","Qualified"],["Proposta","Proposal"],["Negociação","Negotiation"],["Ganho","Won"],["Perdido","Lost"],["Não preparado","Not ready"],["Pronto para validar","Ready to validate"],["Em validação","Validating"],["Validado","Validated"],["Realizado","Actual"],["Previsão","Forecast"],["Receita","Revenue"],["Custo","Cost"],["Coordenação","Coordination"],["Pesquisa","Research"],["Negócio","Business"],["Marketing","Marketing"],["Produto","Product"],["Qualidade","Quality"],["Análise","Analytics"],["Erro","Error"],["Não foi possível carregar esta área.","This area could not be loaded."],["Tentar novamente","Try again"],["Modo foco","Focus mode"],["Sessão iniciada.","Session started."],["Sessão terminada e tempo registado.","Session ended and time recorded."],["Ainda não foi definido um critério de conclusão.","No completion criterion has been defined yet."],["Registo criado com sucesso.","Record created successfully."],["Campos preparados. Reveja apenas se necessário.","Fields prepared. Review only if necessary."],["Preencher automaticamente","Fill automatically"],["Actualizar preenchimento","Update fields"],["A preparar...","Preparing..."],["Este email já está registado. Use Entrar ou Recuperar acesso.","This email is already registered. Use Sign in or Recover access."],["Email ou palavra-passe incorrectos.","Incorrect email or password."],["Confirme o email antes de iniciar sessão.","Confirm your email before signing in."],["Se este for um novo registo, receberá um email de confirmação. Se já existir uma conta com este email, use Entrar ou Recuperar acesso.","If this is a new registration, you will receive a confirmation email. If an account already exists with this email, use Sign in or Recover access."],["Conta criada. Verifique o seu email para confirmar o registo antes de iniciar sessão.","Account created. Check your email to confirm your registration before signing in."],["Agenda diária","Daily agenda"],["Sem objectivo associado","No objective linked"],["DADO EM FALTA","MISSING DATA"],["Responsável não definido","Owner not defined"],["Análise de mercado","Market analysis"],["Ideia recebida. A análise foi iniciada.","Idea received. Analysis has started."],["Ex.: clientes demoram demasiado a receber propostas comerciais.","E.g. customers wait too long to receive commercial proposals."],["Ex.: reduzir o tempo de resposta e aumentar a conversão.","E.g. reduce response time and increase conversion."],["Decisão final registada.","Final decision recorded."],["Preparação final consolidada. O caso avançou para Decisão.","Final preparation consolidated. The case moved to Decision."],["Validação concluída e etapa seguinte definida.","Validation completed and next stage defined."],["Inteligência Competitiva concluída. O caso avançou para Validação.","Competitive Intelligence completed. The case moved to Validation."],["Inteligência Competitiva guardada como rascunho.","Competitive Intelligence saved as draft."],["Indique links, documentos, entrevistas, dados ou outras evidências usadas para validar a análise.","Add links, documents, interviews, data or other evidence used to validate the analysis."],["Registe apenas evidência real: entrevistas, testes, métricas, retorno dos utilizadores, documentos ou observações.","Record only real evidence: interviews, tests, metrics, user feedback, documents or observations."],["Perfil comercial guardado.","Commercial profile saved."],["Potencial cliente registado.","Potential customer recorded."],["Movimento financeiro registado.","Financial entry recorded."],["Sem perfil comercial","No commercial profile"],["Directo, WhatsApp, parceiros...","Direct, WhatsApp, partners..."],["Email, telefone ou referência — apenas se conhecido","Email, phone or reference — only if known"],["Valor, se conhecido","Value, if known"],["Informação em falta","Missing information"],["Categoria","Category"],["Montante","Amount"],["Referência de evidência","Evidence reference"],["Automação registada.","Automation registered."],["Execução colocada na fila.","Execution queued."],["Execução aprovada.","Execution approved."],["Execução iniciada.","Execution started."],["disponível","available"],["configuração pendente","configuration pending"],["Nome","Name"],["Automação","Automation"],["Automação não definida","Automation not defined"],["Objectivo","Objective"],["Unidade","Unit"],["Data de medição","Measurement date"],["Geral","General"],["Decisão tomada","Decision made"],["Contexto","Context"],["Opções consideradas","Options considered"],["Racional","Rationale"],["Captura","Capture"],["Não verificado","Unverified"],["Verificada","Verified"],["Revisto","Reviewed"],["Accionável","Actionable"],["Descartado","Dismissed"],["Convertido","Converted"],["Acção sugerida","Suggested action"],["Transversal","Cross-functional"],["Fase 2","Phase 2"],["Fase 3","Phase 3"],["Fase 4","Phase 4"],["Fase 6","Phase 6"],["Fase 7","Phase 7"],["Revisão semanal","Weekly review"],["Qualidade (0–100)","Quality (0–100)"],["Exactidão factual (0–100)","Factual accuracy (0–100)"],["Sucesso da tarefa (0–100)","Task success (0–100)"],["Correcção humana (min)","Human correction (min)"],["Notas de revisão","Review notes"],["modelo não indicado","model not specified"],["Resultado registado na Arena de Execução.","Result recorded in the Execution Arena."],["Componente","Component"],["Fluxo","Workflow"],["Modelo","Template"],["Instrução","Instruction"],["Estratégia","Strategy"],["Aprendizagem","Learning"],["Activo aprovado para reutilização.","Asset approved for reuse."],["Activo adicionado à biblioteca.","Asset added to library."],["Contexto, regra reutilizável, resultado observado ou conteúdo do activo.","Context, reusable rule, observed result or asset content."],["Altera comportamento: aprovação obrigatória.","Changes behaviour: approval required."],["Aprendizagem operacional reutilizável.","Reusable operational learning."],["Ainda não verificado","Not yet verified"],["Execuções especializadas e aprovações.","Specialised executions and approvals."],["Regras de encaminhamento e execução.","Routing and execution rules."],["Área de testes","Testing area"],["Testes controlados antes da decisão final.","Controlled tests before the final decision."],["Conhecimento e activos reutilizáveis.","Reusable knowledge and assets."],["Sinais, oportunidades e informação de apoio.","Signals, opportunities and supporting information."],["Configuração dos serviços inteligentes do PCC.","Configuration of PCC intelligent services."],["Acessos, controlos e eventos de segurança.","Access, controls and security events."],["Saúde operacional e melhoria contínua.","Operational health and continuous improvement."],["Existe pelo menos um fornecedor disponível.","At least one provider is available."],["Nenhum serviço inteligente está disponível neste ambiente.","No intelligent service is available in this environment."],["Métricas de subscrição guardadas.","Subscription metrics saved."],["Evidência","Evidence"],["Caminho de armazenamento","Storage path"],["Valor numérico","Numeric value"],["Entregável, se não houver acção","Deliverable, if there is no action"],["Projecto, se não houver acção ou entregável","Project, if there is no action or deliverable"],["Projecto, se não houver entregável","Project, if there is no deliverable"],["Instrução de referência, se aplicável","Reference instruction, if applicable"],["Ex.: Enviar proposta ao cliente","E.g. Send proposal to customer"]]) as Record<string, string>;
const EN_TO_PT = Object.fromEntries(Object.entries(PT_TO_EN).map(([pt, en]) => [en, pt])) as Record<string, string>;

function preserveWhitespace(original: string, translated: string) {
  const leading = original.match(/^\\s*/)?.[0] ?? "";
  const trailing = original.match(/\\s*$/)?.[0] ?? "";
  return leading + translated + trailing;
}

function translateDynamic(core: string, language: PccLanguage) {
  if (language === "en") {
    let match = core.match(/^(\\d+) por sincronizar$/);
    if (match) return `${match[1]} to sync`;
    match = core.match(/^Offline · (\\d+) por sincronizar$/);
    if (match) return `Offline · ${match[1]} to sync`;
    match = core.match(/^Estado: (.+)$/);
    if (match) return `Status: ${PT_TO_EN[match[1]] ?? match[1]}`;
  } else {
    let match = core.match(/^(\\d+) to sync$/);
    if (match) return `${match[1]} por sincronizar`;
    match = core.match(/^Offline · (\\d+) to sync$/);
    if (match) return `Offline · ${match[1]} por sincronizar`;
    match = core.match(/^Status: (.+)$/);
    if (match) return `Estado: ${EN_TO_PT[match[1]] ?? match[1]}`;
  }
  return null;
}

function translateValue(value: string, language: PccLanguage) {
  const core = value.trim();
  if (!core) return value;
  const map = language === "en" ? PT_TO_EN : EN_TO_PT;
  const translated = map[core] ?? translateDynamic(core, language);
  return translated ? preserveWhitespace(value, translated) : value;
}

function translateElement(root: ParentNode, language: PccLanguage) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);

  for (const node of nodes) {
    const parent = node.parentElement;
    if (!parent || parent.closest("[data-no-translate]")) continue;
    const next = translateValue(node.nodeValue ?? "", language);
    if (next !== node.nodeValue) node.nodeValue = next;
  }

  const elements = root instanceof Element ? [root, ...root.querySelectorAll("*")] : [...root.querySelectorAll("*")];
  for (const element of elements) {
    if (element.closest("[data-no-translate]")) continue;
    for (const attr of ["placeholder", "title", "aria-label"]) {
      const value = element.getAttribute(attr);
      if (!value) continue;
      const next = translateValue(value, language);
      if (next !== value) element.setAttribute(attr, next);
    }
  }
}

type LanguageContextValue = { language: PccLanguage; setLanguage: (language: PccLanguage) => void };
const LanguageContext = createContext<LanguageContextValue>({ language: "pt", setLanguage: () => undefined });

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<PccLanguage>("pt");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const initial: PccLanguage = stored === "en" ? "en" : "pt";
    setLanguageState(initial);
    document.documentElement.lang = initial === "en" ? "en" : "pt-MZ";
    queueMicrotask(() => translateElement(document.body, initial));
  }, []);

  useEffect(() => {
    document.documentElement.lang = language === "en" ? "en" : "pt-MZ";
    translateElement(document.body, language);

    const observer = new MutationObserver((mutations) => {
      observer.disconnect();
      for (const mutation of mutations) {
        if (mutation.type === "characterData" && mutation.target.parentNode) translateElement(mutation.target.parentNode, language);
        for (const node of mutation.addedNodes) {
          if (node instanceof Element) translateElement(node, language);
          else if (node.parentNode) translateElement(node.parentNode, language);
        }
      }
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    });

    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage: (next) => {
      localStorage.setItem(STORAGE_KEY, next);
      setLanguageState(next);
    },
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function usePccLanguage() {
  return useContext(LanguageContext);
}
