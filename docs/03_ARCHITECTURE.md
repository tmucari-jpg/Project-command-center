PROJECT COMMAND CENTER

ARQUITECTURA DO SISTEMA

Documento: 03_ARCHITECTURE.md
Versão: 1.0
Estado: SOURCE OF TRUTH

---

1. OBJECTIVO

Este documento define a arquitectura técnica do Project Command Center.

A arquitectura deve privilegiar:

- segurança;
- simplicidade;
- manutenção;
- escalabilidade;
- baixo custo inicial;
- desenvolvimento incremental;
- boa experiência mobile;
- separação clara de responsabilidades.

---

2. ARQUITECTURA GERAL

Arquitectura principal:

USER
↓
WEB APPLICATION
↓
NEXT.JS
↓
SERVER / API LAYER
↓
SUPABASE
↓
POSTGRESQL

Serviços externos:

NEXT.JS
├── SUPABASE
├── AI API
├── BRAVE SEARCH API
├── GITHUB
└── VERCEL

---

3. STACK

Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS

Backend / Data

- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Storage
- Supabase Realtime
- Supabase Edge Functions

Infrastructure

- GitHub
- Vercel

Intelligence

- AI API
- Brave Search API

---

4. PRINCÍPIO DE SEPARAÇÃO

O frontend é responsável por:

- apresentação;
- interação;
- formulários;
- navegação;
- estados visuais.

O backend é responsável por:

- operações privilegiadas;
- integração com serviços externos;
- processamento sensível;
- IA;
- validações adicionais;
- operações administrativas.

O banco é responsável por:

- persistência;
- integridade;
- relações;
- regras de acesso;
- dados.

---

5. FRONTEND

Estrutura conceptual:

app/
├── auth/
├── dashboard/
├── objectives/
├── projects/
├── deliverables/
├── actions/
├── execution/
├── ideas/
├── blockers/
├── metrics/
├── ai/
└── settings/

A estrutura exacta pode ser adaptada ao padrão actual do Next.js.

Não alterar a estrutura apenas por preferência estética.

---

6. COMPONENTES

Componentes reutilizáveis devem ser organizados de forma clara.

Exemplos:

components/
├── ui/
├── dashboard/
├── objectives/
├── projects/
├── actions/
├── execution/
├── metrics/
├── ai/
└── layout/

Evitar componentes gigantes.

---

7. ESTADO

Utilizar o mínimo de estado global necessário.

Preferir:

- estado local;
- server state;
- queries;
- mutations;
- cache controlado.

Não introduzir bibliotecas adicionais de gestão de estado sem necessidade real.

---

8. AUTENTICAÇÃO

Fluxo:

USER
↓
LOGIN / SIGNUP
↓
SUPABASE AUTH
↓
SESSION
↓
PROTECTED ROUTES
↓
APPLICATION

O utilizador autenticado deve ter acesso apenas aos dados autorizados.

---

9. AUTORIZAÇÃO

Autenticação responde:

"Quem és?"

Autorização responde:

"O que podes fazer?"

Ambas são obrigatórias.

A segurança não deve depender apenas da interface.

---

10. DATABASE

PostgreSQL será a fonte principal de dados.

As principais entidades são:

- profiles;
- objectives;
- projects;
- deliverables;
- actions;
- time_sessions;
- evidence;
- metrics;
- blockers;
- ideas;
- ai_interactions;
- ai_commands;
- audit_logs;
- notifications;
- integrations;
- security_events.

---

11. RELACIONAMENTO PRINCIPAL

PROFILE
   │
   ├── OBJECTIVES
   │      │
   │      └── PROJECTS
   │              │
   │              └── DELIVERABLES
   │                      │
   │                      └── ACTIONS
   │                              │
   │                              ├── TIME_SESSIONS
   │                              └── EVIDENCE
   │
   ├── IDEAS
   ├── BLOCKERS
   ├── METRICS
   └── AI_INTERACTIONS

---

12. OBJECTIVE → PROJECT

Um objectivo pode possuir vários projectos.

Um projecto deve, sempre que aplicável, estar associado a um objectivo.

O sistema deve permitir projectos sem objectivo apenas quando houver uma razão válida.

---

13. PROJECT → DELIVERABLE

Um projecto pode possuir vários entregáveis.

Cada entregável pertence a um projecto.

---

14. DELIVERABLE → ACTION

Um entregável pode possuir várias acções.

Uma acção deve possuir um critério claro de conclusão.

---

15. ACTION → EXECUTION

Uma acção pode possuir várias sessões de execução.

Cada sessão deve guardar:

- início;
- fim;
- duração;
- acção;
- utilizador.

---

16. ACTION → EVIDENCE

Uma acção pode possuir uma ou mais evidências.

As evidências devem estar relacionadas com a acção correspondente.

---

17. BLOCKERS

Bloqueios podem estar associados a:

- projecto;
- entregável;
- acção.

O modelo deve permitir identificar o nível exacto do bloqueio.

---

18. IDEAS

Ideias devem permanecer separadas das acções.

Uma ideia só deve transformar-se em projecto ou acção mediante decisão.

---

19. STORAGE

Supabase Storage pode ser utilizado para:

- evidências;
- documentos;
- screenshots;
- ficheiros relacionados com projectos.

Os ficheiros devem possuir controlo de acesso.

Não tornar buckets privados públicos sem necessidade.

---

20. REALTIME

Supabase Realtime pode ser utilizado quando existir benefício real para:

- actualização do dashboard;
- notificações;
- execução;
- alterações de estado.

Não utilizar realtime indiscriminadamente.

---

21. API / SERVER ACTIONS

Operações simples podem utilizar mecanismos apropriados do Next.js.

Operações que envolvam:

- secrets;
- APIs externas;
- IA;
- operações privilegiadas;

devem permanecer server-side.

---

22. EDGE FUNCTIONS

Supabase Edge Functions podem ser utilizadas para:

- webhooks;
- integrações;
- processamento server-side;
- orquestração da IA;
- operações que necessitem de isolamento do frontend.

A escolha entre API/server-side do Next.js e Edge Functions deve considerar simplicidade e segurança.

---

23. IA

Arquitectura conceptual:

USER
↓
COMMAND / QUESTION
↓
APPLICATION
↓
CONTEXT BUILDER
↓
AI SERVICE
↓
ANALYSIS
↓
VALIDATION
↓
RESPONSE / ACTION

A IA nunca deve receber mais dados do que o necessário.

---

24. AI CONTEXT BUILDER

Antes de enviar uma solicitação para a IA, o sistema deve construir contexto relevante.

Exemplo:

Objective
Project
Deliverable
Action
Deadline
Progress
Time
Blockers
Evidence
Recent activity

O contexto deve ser limitado ao necessário.

---

25. AI COMMANDS

Comandos naturais devem ser processados por uma camada própria.

Exemplo:

"Mostra o que está atrasado."

Fluxo:

USER
↓
COMMAND PARSER
↓
INTENT
↓
DATA QUERY
↓
RESULT
↓
AI ANALYSIS
↓
RESPONSE


---

# 26. AI NÃO DEVE INVENTAR

Se os dados necessários não existirem:

a IA deve indicar que não possui informação suficiente.

Não criar factos.

---

# 27. AI ACTIONS

Acções de leitura:

- podem ser executadas automaticamente quando autorizadas.

Acções de escrita:

- devem ser validadas;
- devem respeitar permissões.

Acções destrutivas:

- exigem confirmação explícita.

---

# 28. EXTERNAL APIs

As APIs externas nunca devem ser chamadas directamente pelo browser quando isso implicar exposição de secrets.

Fluxo:

FRONTEND
↓
SERVER
↓
EXTERNAL API
↓
SERVER
↓
FRONTEND

---

# 29. BRAVE SEARCH

Brave Search será utilizado como serviço externo de pesquisa.

A chave da API deve permanecer server-side.

A pesquisa externa deve ser utilizada apenas quando necessária.

---

# 30. GITHUB

GitHub é o sistema de controlo de versão.

Deve armazenar:

- código;
- documentação;
- migrations;
- testes;
- configurações não secretas.

Nunca armazenar secrets.

---

# 31. VERCEL

Vercel será utilizado para deployment.

Ambientes:

```text
Development
Preview
Production

Cada ambiente deve possuir configuração apropriada.

---

32. ENVIRONMENT VARIABLES

Variáveis sensíveis devem ser configuradas no ambiente.

Exemplos:

SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
AI_API_KEY
BRAVE_SEARCH_API_KEY

Os nomes podem ser adaptados conforme a implementação real.

Service role keys e outras credenciais privilegiadas nunca devem chegar ao browser.

---

33. RLS

Row Level Security é parte fundamental da arquitectura de dados.

Regra conceptual:

USER A
→ dados de A

USER B
→ dados de B

Não permitir acesso cruzado.

RLS deve ser validado através de testes.

---

34. AUDIT LOG

Operações importantes devem gerar registo.

Exemplos:

- criação;
- alteração;
- conclusão;
- eliminação;
- alterações de permissões;
- alterações de integração;
- eventos de segurança.

---

35. SECURITY EVENTS

Eventos de segurança devem possuir estrutura própria.

Exemplos:

- tentativa de acesso indevido;
- falha repetida de autenticação;
- alteração suspeita;
- erro de autorização;
- exposição potencial de dados.

---

36. NOTIFICATIONS

As notificações devem ser separadas da lógica de negócio.

O sistema deve conseguir gerar:

- alerta de prazo;
- alerta de bloqueio;
- alerta de risco;
- alerta de inactividade;
- recomendação da IA.

---

37. METRICS ENGINE

As métricas devem ser calculadas numa camada central.

Evitar duplicar fórmulas em vários componentes.

Métricas principais:

- Execution Ratio;
- Outcome Ratio;
- On-Time Completion;
- Focus Ratio;
- Time Efficiency;
- Project Health.

---

38. PROJECT HEALTH

Project Health deve considerar:

- progresso;
- prazo;
- bloqueios;
- actividade;
- entregáveis;
- riscos;
- tempo.

A fórmula deve estar centralizada e documentada.

---

39. SECURITY ARCHITECTURE

Segurança deve existir em várias camadas:

USER
↓
AUTHENTICATION
↓
AUTHORIZATION
↓
RLS
↓
APPLICATION VALIDATION
↓
SERVER-SIDE CONTROLS
↓
DATABASE
↓
AUDIT

Não depender de uma única camada.

---

40. INPUT VALIDATION

Todos os inputs vindos do utilizador devem ser validados.

Validar:

- tipo;
- tamanho;
- formato;
- valores permitidos;
- relações;
- permissões.

Não confiar no frontend.

---

41. ERROR HANDLING

Erros internos não devem expor:

- stack traces sensíveis;
- secrets;
- queries;
- tokens;
- informação interna desnecessária.

O utilizador deve receber mensagens úteis.

---

42. PERFORMANCE

Prioridades:

- queries eficientes;
- paginação quando necessária;
- índices adequados;
- evitar chamadas redundantes;
- evitar carregar grandes volumes sem necessidade;
- optimizar imagens e assets.

Não optimizar prematuramente.

---

43. SCALABILITY

A arquitectura deve permitir crescimento futuro sem exigir reconstrução completa.

Contudo:

Não implementar complexidade de escala antes de existir necessidade.

---

44. MOBILE FIRST

A interface deve ser desenhada considerando utilização em mobile.

Prioridades:

- navegação simples;
- botões acessíveis;
- formulários rápidos;
- dashboard legível;
- execução de acções com poucos toques;
- modo foco eficiente.

---

45. OFFLINE

Offline não é requisito obrigatório do MVP.

Não implementar sincronização offline complexa sem necessidade real.

Pode ser considerado futuramente.

---

46. OBSERVABILIDADE

A aplicação deve permitir identificar:

- erros;
- falhas;
- problemas de integração;
- eventos de segurança;
- problemas de performance.

---

47. BACKUP

A estratégia de backup deve ser definida antes de produção.

O sistema deve considerar:

- backup da base de dados;
- recuperação;
- integridade;
- procedimento de restauração.

---

48. DEPLOYMENT FLOW

Fluxo recomendado:

DEVELOPMENT
↓
COMMIT
↓
PUSH
↓
CI / TESTS
↓
PREVIEW
↓
VALIDATION
↓
SECURITY CHECK
↓
PRODUCTION

---

49. CI/CD

Sempre que possível, automatizar:

- lint;
- type checking;
- testes;
- build;
- verificações de segurança.

Uma alteração que falhe testes não deve ser promovida automaticamente para produção.

---

50. BRANCH STRATEGY

Estratégia inicial simples:

main

Branches de feature:

feature/*

Branches de correcção:

fix/*

Branches de segurança:

security/*

A estratégia pode evoluir conforme a equipa crescer.

---

51. ARCHITECTURE DECISION RECORDS

Decisões arquitectónicas importantes devem ser documentadas.

Formato:

Decision
Context
Options
Chosen option
Reason
Consequences

---

52. PRINCÍPIO DE MODULARIDADE

Cada módulo deve ter responsabilidade clara.

Evitar:

- lógica duplicada;
- dependências circulares;
- componentes monolíticos;
- queries espalhadas;
- regras de negócio escondidas na interface.

---

53. PRINCÍPIO DE SIMPLICIDADE

Se duas arquitecturas satisfazem os requisitos, escolher a mais simples.

Não introduzir tecnologia apenas porque:

- é nova;
- é popular;
- parece sofisticada;
- o agente conhece melhor.

A tecnologia deve resolver uma necessidade real.

---

54. ORDEM DE CONSTRUÇÃO

A ordem recomendada é:

1. Project setup
2. Authentication
3. Database
4. RLS
5. Objectives
6. Projects
7. Deliverables
8. Actions
9. Execution
10. Time tracking
11. Evidence
12. Blockers
13. Dashboard
14. Metrics
15. AI
16. Integrations
17. Advanced automation

---

55. REGRA DE DEPENDÊNCIA

Não construir uma camada avançada antes de a camada abaixo estar funcional.

Exemplo:

Não construir AI project analysis antes de:

- project data;
- action data;
- metrics;
- blockers

estarem correctamente implementados.

---

56. REGRA DE INTEGRIDADE

A fonte de verdade dos dados deve ser o banco.

Não utilizar estado local como substituto permanente da persistência.

---

57. REGRA DE PRODUÇÃO

Código que funciona apenas no ambiente local não é considerado pronto.

A funcionalidade deve ser validada no ambiente de preview antes da produção.

---

58. REGRA FINAL

A arquitectura deve servir o produto.

O produto não deve ser alterado para justificar a arquitectura.

Prioridades:

1. Resultado;
2. Segurança;
3. Funcionalidade;
4. Dados reais;
5. Usabilidade;
6. Manutenção;
7. Escalabilidade.

END OF ARCHITECTURE DOCUMENT
