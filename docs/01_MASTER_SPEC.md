PROJECT COMMAND CENTER

Especificação Definitiva do Produto

Documento: 01_MASTER_SPEC.md
Versão: 1.0
Estado: SOURCE OF TRUTH
Data: 2026-09-09

---

1. VISÃO DO PRODUTO

O Project Command Center é uma plataforma de execução e gestão de projectos orientada por resultados, com Inteligência Artificial integrada.

O sistema deve transformar objectivos em execução mensurável.

Não é apenas uma aplicação de tarefas.

O sistema deve ajudar o utilizador a:

- definir objectivos;
- transformar objectivos em resultados esperados;
- estruturar projectos;
- dividir projectos em entregáveis e acções;
- executar acções;
- controlar tempo;
- registar evidências;
- medir progresso;
- identificar bloqueios;
- controlar ideias dispersas;
- acompanhar projectos inacabados;
- identificar gargalos;
- priorizar;
- detectar atrasos;
- manter foco;
- receber orientação da IA;
- medir resultados reais.

---

2. PRINCÍPIO FUNDAMENTAL

A plataforma deve privilegiar:

RESULTADO > ACTIVIDADE

Uma grande quantidade de tarefas concluídas não significa necessariamente progresso.

O sistema deve avaliar:

1. O que se pretendia alcançar?
2. O que foi efectivamente feito?
3. Que evidência comprova o avanço?
4. Qual foi o resultado?
5. O resultado está dentro do prazo?
6. Quanto tempo foi utilizado?
7. O que está a bloquear o progresso?
8. Qual é a próxima acção concreta?

---

3. MODELO CENTRAL

O modelo de execução da plataforma é:

OBJECTIVO
↓
RESULTADO ESPERADO
↓
PROJECTO
↓
ENTREGÁVEL
↓
ACÇÃO
↓
EXECUÇÃO
↓
EVIDÊNCIA
↓
MÉTRICA
↓
RESULTADO

Cada nível deve estar relacionado com o seguinte.

Nenhuma acção deve existir sem contexto suficiente para compreender para que resultado contribui.

---

4. OBJECTIVOS DO PRODUTO

O sistema deve:

- reduzir dispersão;
- reduzir procrastinação;
- transformar ideias em decisões;
- transformar decisões em acções;
- tornar o progresso visível;
- detectar atrasos;
- detectar bloqueios;
- medir execução;
- medir resultados;
- melhorar utilização do tempo;
- apoiar tomada de decisão;
- criar histórico de execução;
- permitir análise pela IA.

---

5. UTILIZADOR PRINCIPAL

O sistema deve inicialmente ser concebido para um utilizador individual.

A arquitectura deve, contudo, permitir futura expansão para:

- equipas;
- gestores;
- PMOs;
- consultores;
- pequenas empresas;
- equipas de projectos.

A primeira versão deve evitar complexidade desnecessária de multi-tenant.

A arquitectura deve ser preparada para expansão futura.

---

6. ENTIDADES PRINCIPAIS

O sistema deverá trabalhar inicialmente com:

- Profile
- Objective
- Project
- Deliverable
- Action
- Time Session
- Evidence
- Metric
- Blocker
- Idea
- AI Interaction
- AI Command
- Audit Log
- Notification
- Integration
- Security Event

---

7. OBJECTIVOS

Cada objectivo deve conter, no mínimo:

- título;
- descrição;
- resultado esperado;
- prioridade;
- data inicial;
- prazo;
- estado;
- progresso;
- métrica principal;
- valor inicial;
- valor alvo;
- valor actual;
- observações.

Estados:

- draft
- active
- on_track
- at_risk
- delayed
- completed
- cancelled

---

8. PROJECTOS

Cada projecto deve conter:

- nome;
- descrição;
- objectivo relacionado;
- prioridade;
- responsável;
- data inicial;
- prazo;
- estado;
- progresso;
- resultado esperado;
- orçamento opcional;
- notas;
- riscos;
- próximo passo.

Estados:

- idea
- planning
- active
- on_hold
- at_risk
- completed
- cancelled

O sistema deve calcular automaticamente a saúde do projecto.

---

9. ENTREGÁVEIS

Um projecto pode possuir vários entregáveis.

Cada entregável deve conter:

- nome;
- descrição;
- projecto;
- prazo;
- responsável;
- estado;
- prioridade;
- progresso;
- evidência;
- critério de conclusão.

Estados:

- pending
- active
- blocked
- completed
- cancelled

Um entregável só deve ser considerado concluído quando cumprir o seu critério de conclusão.

---

10. ACÇÕES

As acções representam o trabalho executável.

Cada acção deve possuir:

- título;
- descrição;
- projecto;
- entregável;
- prioridade;
- responsável;
- prazo;
- estado;
- estimativa de tempo;
- tempo utilizado;
- critério de conclusão;
- evidência;
- bloqueio;
- próxima acção.

Estados:

- pending
- in_progress
- blocked
- completed
- cancelled

Uma acção deve ser suficientemente concreta para que o utilizador saiba exactamente o que fazer.

Evitar acções vagas como:

"Trabalhar no projecto."

Preferir:

"Enviar proposta comercial para a empresa X."

---

11. EXECUÇÃO

A plataforma deve possuir um modo específico de execução.

Quando o utilizador inicia uma acção, o sistema deve mostrar:

- acção actual;
- resultado relacionado;
- prazo;
- tempo estimado;
- cronómetro;
- critério de conclusão;
- botão para registar evidência;
- botão para bloquear;
- botão para concluir;
- próxima acção.

O utilizador deve conseguir iniciar e parar sessões de trabalho.

---

12. CONTROLO DE TEMPO

Cada sessão de execução deve registar:

- acção;
- início;
- fim;
- duração;
- utilizador;
- observação opcional.

O sistema deve comparar:

TEMPO ESTIMADO
versus
TEMPO REAL

E calcular:

TIME EFFICIENCY

Fórmula inicial:

Time Efficiency =
Tempo estimado / Tempo real × 100

O sistema deve evitar interpretar automaticamente uma percentagem alta como necessariamente melhor.

O contexto deve ser considerado.

---

13. EVIDÊNCIAS

Uma acção concluída deve poder possuir evidência.

Exemplos:

- ficheiro;
- link;
- documento;
- screenshot;
- comentário;
- número;
- resultado;
- referência externa.

A evidência deve permitir responder:

"Como sabemos que isto foi realmente feito?"

---

14. MÉTRICAS

O sistema deve medir pelo menos:

Execution Ratio

Percentagem de acções concluídas dentro do período.

Outcome Ratio

Percentagem dos resultados esperados efectivamente atingidos.

On-Time Completion

Percentagem de entregas concluídas dentro do prazo.

Focus Ratio

Percentagem do tempo dedicado às prioridades principais.

Time Efficiency

Relação entre tempo estimado e tempo utilizado.

Project Health

Indicador composto baseado em:

- prazo;
- progresso;
- bloqueios;
- actividade recente;
- entregáveis;
- riscos.

As fórmulas devem ficar centralizadas no código e documentadas.

---

15. IDEIAS

O sistema deve possuir um espaço específico para ideias.

Uma ideia não deve automaticamente tornar-se tarefa.

Cada ideia pode possuir:

- título;
- descrição;
- data;
- origem;
- potencial;
- prioridade;
- estado;
- projecto relacionado;
- próxima decisão.

Estados:

- captured
- evaluating
- approved
- rejected
- converted_to_project
- archived

O objectivo é impedir que novas ideias destruam o foco da execução actual.

---

16. PROJECTOS INACABADOS

O sistema deve identificar projectos sem actividade ou sem progresso.

Deve mostrar:

- projecto;
- último movimento;
- dias sem actividade;
- progresso;
- bloqueio;
- motivo;
- decisão necessária.

A IA pode recomendar:

- continuar;
- redefinir;
- dividir;
- colocar em espera;
- cancelar;
- transformar numa nova iniciativa.

A decisão final permanece com o utilizador.

---

17. GARGALOS

Cada bloqueio deve poder ser registado.

Campos:

- descrição;
- projecto;
- acção;
- impacto;
- responsável;
- data identificada;
- prazo de resolução;
- estado;
- solução;
- data de resolução.

Estados:

- open
- investigating
- waiting
- resolved
- ignored

O sistema deve identificar gargalos recorrentes.

---

18. DASHBOARD PRINCIPAL

O dashboard deve mostrar imediatamente:

OBJECTIVOS

- activos;
- atrasados;
- em risco;
- concluídos.

PROJECTOS

- activos;
- em risco;
- bloqueados;
- atrasados;
- concluídos.

EXECUÇÃO

- acções de hoje;
- acções atrasadas;
- próxima acção;
- tempo executado.

RESULTADOS

- progresso dos objectivos;
- métricas;
- resultados alcançados.

BLOQUEIOS

- bloqueios activos;
- bloqueios críticos.

IDEIAS

- ideias capturadas;
- ideias pendentes de decisão.

IA

- recomendações;
- alertas;
- inconsistências;
- decisões pendentes.

---

19. PRÓXIMA ACÇÃO

O sistema deve sempre tentar identificar uma única:

NEXT BEST ACTION

A próxima acção deve ser:

- concreta;
- executável;
- relacionada com uma prioridade;
- compatível com o tempo disponível;
- suficientemente pequena para começar.

Evitar apresentar uma lista infinita quando uma próxima acção clara for possível.

---

20. MODO FOCO

O sistema deve possuir um modo de foco.

No modo foco mostrar apenas:

- objectivo;
- projecto;
- acção;
- prazo;
- cronómetro;
- critério de conclusão;
- evidência;
- próxima acção.

Outras ideias ou projectos podem ser capturados sem interromper a execução.

---

21. INTELIGÊNCIA ARTIFICIAL

A IA não deve funcionar apenas como chatbot.

Deve actuar como camada de análise e execução.

Funções:

PLANNER

Transformar objectivos em planos executáveis.

EXECUTION COACH

Ajudar a escolher a próxima acção.

ANALYST

Analisar progresso, tempo e resultados.

PRIORITY MANAGER

Identificar prioridades.

BLOCKER ANALYST

Identificar bloqueios.

PROJECT CONTROLLER

Detectar atrasos e inconsistências.

SECURITY REVIEWER

Analisar riscos de segurança.

QA ASSISTANT

Ajudar na validação dos resultados.

---

22. COMPORTAMENTO DA IA

A IA deve:

- questionar prioridades inconsistentes;
- detectar excesso de projectos activos;
- alertar sobre prazos;
- identificar falta de evidência;
- detectar acções vagas;
- identificar projectos abandonados;
- identificar desperdício de tempo;
- impedir expansão desnecessária de escopo;
- sugerir simplificação;
- transformar problemas em acções;
- manter ideias separadas da execução;
- explicar as razões das recomendações.

A IA não deve:

- inventar dados;
- afirmar que executou algo quando não executou;
- marcar tarefas como concluídas sem confirmação/evidência;
- apagar dados sem autorização;
- tomar decisões irreversíveis sem confirmação;
- ignorar regras de segurança.

---

23. COMANDOS EM LINGUAGEM NATURAL

O utilizador deve poder escrever comandos como:

"Mostra o que está atrasado."

"Qual é a minha próxima acção?"

"O que está a bloquear este projecto?"

"Regista esta ideia."

"Transforma esta ideia num projecto."

"Quanto tempo perdi esta semana?"

"Quais foram os meus resultados?"

"Mostra os projectos sem actividade."

"Prioriza o que devo fazer hoje."

"Analisa este projecto."

"Resume a minha execução desta semana."

"Estou dispersa. O que devo fazer agora?"

"Mostra o que está em risco."

"Cria um plano para atingir este objectivo."

---

24. ALERTAS

O sistema deve gerar alertas para:

- prazo próximo;
- prazo ultrapassado;
- projecto sem actividade;
- bloqueio crítico;
- objectivo em risco;
- acção atrasada;
- excesso de prioridades;
- ausência de evidência;
- desvio significativo de tempo.

Os alertas devem ser úteis e não gerar excesso de notificações.

---

25. INTEGRAÇÕES

Integrações prioritárias:

Supabase

- PostgreSQL;
- Auth;
- Storage;
- Realtime;
- Edge Functions.

GitHub

- código;
- versionamento;
- pull requests;
- issues;
- segurança.

Vercel

- deployment;
- ambientes;
- variáveis;
- preview;
- produção.

Brave Search

Pesquisa web para utilização pela camada de IA.

AI API

Camada de inteligência artificial.

Integrações adicionais devem ser adicionadas apenas quando houver necessidade real.

Possíveis integrações futuras:

- Google Calendar;
- Gmail;
- Google Drive;
- Slack;
- Telegram;
- WhatsApp.

---

26. SEGURANÇA

Segurança é requisito funcional do produto.

Nunca colocar:

- API keys;
- passwords;
- service role keys;
- tokens;
- secrets

directamente no frontend ou no código público.

Utilizar variáveis de ambiente e mecanismos seguros de secret management.

Todas as tabelas que contenham dados do utilizador devem possuir controlo de acesso adequado.

Row Level Security deve ser utilizado no Supabase onde aplicável.

Operações privilegiadas devem ocorrer no backend/server-side.

---

27. SECURITY GATE

Cada versão significativa deve passar por:

SECURITY GATE

Possíveis resultados:

APPROVED

Sem problemas críticos identificados.

REQUIRES_FIX

Existem problemas que devem ser corrigidos antes do próximo marco.

BLOCKED

Existe risco crítico ou falha que impede avanço.

O sistema não deve considerar uma funcionalidade pronta apenas porque o código compila.

---

28. AUDITORIA

Alterações importantes devem ser registadas.

O sistema deve manter audit logs para operações relevantes, incluindo:

- criação;
- alteração;
- conclusão;
- eliminação;
- alterações de permissões;
- alterações de integração;
- eventos de segurança.

---

29. ARQUITECTURA

Stack inicial:

Frontend:

- Next.js
- TypeScript
- React
- Tailwind CSS

Backend:

- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Storage
- Supabase Edge Functions

Infraestrutura:

- GitHub
- Vercel

IA:

- AI API
- Brave Search API

A arquitectura deve privilegiar:

- segurança;
- simplicidade;
- manutenção;
- escalabilidade;
- baixo custo inicial;
- desenvolvimento rápido;
- separação clara entre frontend e backend.

---

30. AUTENTICAÇÃO

A primeira versão deve possuir:

- criação de conta;
- login;
- logout;
- recuperação de acesso;
- sessão persistente;
- protecção de rotas.

Dados privados nunca devem ser acessíveis por outro utilizador.

---

31. RESPONSIVIDADE

A aplicação deve funcionar correctamente em:

- computador;
- tablet;
- telemóvel.

A experiência mobile é requisito importante.

A interface deve permitir execução real pelo telemóvel.

---

32. DADOS REAIS

É proibido utilizar dados fictícios para mascarar funcionalidades incompletas.

Não utilizar:

- mock dashboards;
- fake API responses;
- botões sem função;
- placeholders apresentados como funcionalidades;
- métricas falsas.

Quando uma funcionalidade não estiver implementada, isso deve ser explicitamente indicado.

---

33. CRITÉRIO DE FUNCIONALIDADE

Uma funcionalidade só é considerada implementada quando:

1. existe no frontend;
2. existe a lógica necessária;
3. existe persistência quando aplicável;
4. possui validação;
5. possui tratamento de erro;
6. possui controlo de acesso;
7. foi testada;
8. funciona com dados reais;
9. não quebra funcionalidades existentes.

---

34. DESENVOLVIMENTO INCREMENTAL

O produto deve ser desenvolvido por fases.

Não tentar construir tudo de uma vez.

Cada fase deve produzir uma versão funcional.

Depois de cada fase:

- executar testes;
- verificar segurança;
- verificar persistência;
- verificar UX;
- corrigir problemas;
- documentar alterações.

---

35. MVP FUNCIONAL

O primeiro marco funcional deve conter:

- signup/login;
- dashboard;
- criação de objectivos;
- criação de projectos;
- criação de entregáveis;
- criação de acções;
- deadlines;
- estados;
- progresso;
- timer;
- sessões de tempo;
- evidências;
- bloqueios;
- próxima acção;
- persistência no Supabase;
- RLS;
- interface responsiva.

Só depois avançar para a camada avançada de IA.

---

36. SEGUNDA CAMADA

Depois do núcleo funcional:

- comandos naturais;
- análise de execução;
- recomendações;
- priorização;
- análise de gargalos;
- análise de projectos inactivos;
- métricas avançadas;
- alertas inteligentes.

---

37. TERCEIRA CAMADA

Depois:

- GitHub;
- Vercel;
- Brave Search;
- automações;
- integrações externas;
- capacidades avançadas da IA.

---

38. CONTROLO DE ESCOPO

Qualquer nova funcionalidade deve responder:

1. Qual problema resolve?
2. Qual resultado melhora?
3. É necessária agora?
4. Qual o custo de implementação?
5. Qual o risco?
6. Pode esperar?

Se não for necessária para o marco actual:

BACKLOG / NOT NOW

A IA deve ajudar a impedir scope creep.

---

39. PRINCÍPIO "NOT NOW"

Quando surgir uma ideia durante a execução, o sistema deve permitir capturá-la rapidamente.

A ideia não deve alterar automaticamente a prioridade actual.

A IA deve poder responder:

"Registei a ideia. Ela não interfere na prioridade actual."

---

40. RESULTADO SOBRE ACTIVIDADE

O sistema não deve premiar simplesmente:

"Fiz 20 tarefas."

Deve perguntar:

"Qual resultado essas tarefas produziram?"

A métrica principal deve ser sempre ligada ao resultado.

---

41. SAÚDE DO PROJECTO

A saúde do projecto deve considerar pelo menos:

- progresso;
- prazo;
- actividade recente;
- bloqueios;
- entregáveis;
- riscos;
- tempo utilizado.

Classificação:

- HEALTHY
- AT_RISK
- DELAYED
- BLOCKED
- COMPLETED

A fórmula pode evoluir, mas deve ser determinística e documentada.

---

42. PRIVACIDADE

O sistema deve minimizar dados pessoais desnecessários.

Cada utilizador deve ter acesso apenas aos dados autorizados.

Dados sensíveis não devem ser enviados para serviços externos sem necessidade e controlo apropriado.

---

43. OBSERVABILIDADE

O sistema deve permitir identificar:

- erros;
- falhas;
- operações importantes;
- eventos de segurança;
- problemas de integração.

Logs não devem expor secrets ou credenciais.

---

44. BACKUPS E RECUPERAÇÃO

A arquitectura deve considerar:

- backups;
- recuperação;
- integridade dos dados;
- prevenção de perda de informação.

Os procedimentos devem ser documentados antes da entrada em produção.

---

45. DEFINITION OF DONE

Uma funcionalidade está DONE apenas quando:

- funciona;
- está ligada aos dados reais;
- está protegida;
- foi testada;
- apresenta erros correctamente;
- é utilizável no mobile;
- não possui dependências ocultas;
- está documentada quando necessário;
- passou pelo Security Gate aplicável.

---

46. REGRA PARA O AGENTE DE IA

O agente de desenvolvimento deve tratar este documento como:

SOURCE OF TRUTH.

Em caso de conflito entre:

- pedido informal;
- código existente;
- sugestão do agente;
- documentação;

este documento prevalece, excepto quando uma alteração for explicitamente aprovada.

O agente deve sinalizar conflitos antes de implementar.

---

47. REGRA DE AUDITORIA

Antes de qualquer implementação significativa, o agente deve:

1. analisar o repositório;
2. analisar a documentação;
3. analisar a arquitectura existente;
4. identificar riscos;
5. identificar dependências;
6. identificar configurações em falta;
7. identificar conflitos;
8. propor ordem de implementação;
9. produzir relatório de auditoria.

O agente não deve começar automaticamente a construir o produto.

---

48. REGRA DE VERIFICAÇÃO

Depois de qualquer alteração significativa:

- executar testes;
- verificar erros;
- verificar segurança;
- verificar persistência;
- verificar responsividade;
- verificar regressões.

Não declarar uma funcionalidade como concluída sem verificação.

---

49. PRINCÍPIO FINAL

O Project Command Center existe para transformar intenção em execução mensurável.

A plataforma deve ajudar o utilizador a sair de:

IDEIA
→ CONFUSÃO
→ DISPERSÃO
→ TAREFAS

e chegar a:

OBJECTIVO
→ PRIORIDADE
→ ACÇÃO
→ EXECUÇÃO
→ EVIDÊNCIA
→ RESULTADO
→ APRENDIZAGEM

A aplicação deve ser construída para gerar resultados reais, não para parecer completa.

---

50. REGRA SUPREMA

Em qualquer momento, o sistema deve conseguir responder claramente:

1. O que quero alcançar?

2. O que estou a fazer agora?

3. O que prova que avancei?

Se a plataforma não conseguir responder a estas três perguntas, a implementação não está suficientemente orientada para execução.
