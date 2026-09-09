PRODUCTION CHECKLIST — PROJECT COMMAND CENTER

1. OBJECTIVO

Este documento define as verificações obrigatórias antes de disponibilizar o Project Command Center em produção.

Produção só pode ser autorizada quando:

- funcionalidades críticas estão implementadas;
- testes foram executados;
- segurança foi validada;
- dados reais funcionam;
- integrações estão estáveis;
- deployment está controlado;
- existe capacidade de recuperação.

---

2. REGRA PRINCIPAL

NO PRODUCTION WITHOUT APPROVAL

Nenhum agente, humano ou processo automático deve considerar o sistema pronto para produção sem verificar este checklist.

---

3. DOCUMENTAÇÃO

Verificar existência e revisão de:

- [ ] "01_MASTER_SPEC.md"
- [ ] "02_MASTER_AGENT_PROMPT.md"
- [ ] "03_ARCHITECTURE.md"
- [ ] "04_DATABASE_SCHEMA.sql"
- [ ] "05_RLS_POLICIES.sql"
- [ ] "06_AI_COMMANDS.md"
- [ ] "07_SECURITY.md"
- [ ] "08_INTEGRATIONS.md"
- [ ] "09_ACCEPTANCE_TESTS.md"
- [ ] "10_PRODUCTION_CHECKLIST.md"

Também devem existir:

- [ ] "README.md"
- [ ] ".env.example"
- [ ] migrations, quando aplicável
- [ ] documentação de deployment

---

4. GIT / GITHUB

Verificar:

- [ ] repositório correcto;
- [ ] branch principal definida;
- [ ] código versionado;
- [ ] commits identificáveis;
- [ ] alterações não commitadas avaliadas;
- [ ] Pull Requests utilizados quando apropriado;
- [ ] branch protection configurada quando disponível;
- [ ] histórico sem secrets expostos.

---

5. GITHUB SECURITY

Quando disponível:

- [ ] Secret Scanning activo;
- [ ] Push Protection activo;
- [ ] Dependabot activo;
- [ ] Code Scanning configurado;
- [ ] vulnerabilidades analisadas;
- [ ] dependências actualizadas;
- [ ] nenhum secret conhecido no repositório.

---

6. ENVIRONMENT VARIABLES

Verificar:

- [ ] ".env.example" existe;
- [ ] valores reais não estão no Git;
- [ ] variáveis de Development configuradas;
- [ ] variáveis de Preview configuradas;
- [ ] variáveis de Production configuradas;
- [ ] secrets têm escopo adequado;
- [ ] secrets desnecessários foram removidos.

---

7. SUPABASE

Database

- [ ] schema aplicado através de migrations;
- [ ] tabelas correctas;
- [ ] foreign keys correctas;
- [ ] constraints correctas;
- [ ] indexes necessários;
- [ ] triggers necessários.

Authentication

- [ ] login funciona;
- [ ] logout funciona;
- [ ] sessão funciona;
- [ ] recuperação de conta configurada quando necessária.

RLS

- [ ] RLS activo;
- [ ] policies aplicadas;
- [ ] policies testadas;
- [ ] isolamento entre utilizadores confirmado.

---

8. SUPABASE SERVICE ROLE

Confirmar:

- [ ] service role não está no frontend;
- [ ] service role não está no Git;
- [ ] service role não aparece nos logs;
- [ ] service role só existe server-side;
- [ ] utilização está limitada ao necessário.

---

9. STORAGE

Se utilizado:

- [ ] buckets definidos;
- [ ] buckets privados quando necessário;
- [ ] policies testadas;
- [ ] upload validado;
- [ ] tamanho máximo definido;
- [ ] tipos de ficheiro controlados;
- [ ] acesso cross-user bloqueado.

---

10. APPLICATION SECURITY

Verificar:

- [ ] autenticação;
- [ ] autorização;
- [ ] input validation;
- [ ] output validation;
- [ ] protecção contra injection;
- [ ] tratamento de erros;
- [ ] rate limiting;
- [ ] timeouts;
- [ ] retries controlados;
- [ ] operações destrutivas protegidas.

---

11. AI SECURITY

Verificar:

- [ ] IA não possui privilégios ilimitados;
- [ ] comandos são classificados;
- [ ] autorização é verificada;
- [ ] output estruturado é validado;
- [ ] operações críticas exigem confirmação;
- [ ] prompt injection foi testado;
- [ ] IA não inventa dados;
- [ ] IA não pode revelar secrets;
- [ ] contexto enviado é minimizado;
- [ ] custos são controlados.

---

12. AI FAILURE

Simular indisponibilidade da IA.

Confirmar:

- [ ] aplicação continua acessível;
- [ ] dados continuam disponíveis;
- [ ] funções essenciais continuam utilizáveis;
- [ ] utilizador recebe mensagem adequada;
- [ ] erro fica registado.

---

13. BRAVE SEARCH

Se integrado:

- [ ] API key protegida;
- [ ] chamadas passam pelo backend;
- [ ] rate limit considerado;
- [ ] timeout configurado;
- [ ] erros tratados;
- [ ] resultados externos tratados como untrusted data;
- [ ] fontes apresentadas quando relevante.

---

14. GITHUB INTEGRATION

Se integrada:

- [ ] token protegido;
- [ ] scopes mínimos;
- [ ] autenticação testada;
- [ ] autorização testada;
- [ ] operações de escrita testadas;
- [ ] operações destrutivas protegidas;
- [ ] token revogável.

---

15. VERCEL

Verificar:

- [ ] projecto correcto;
- [ ] GitHub conectado;
- [ ] build funciona;
- [ ] Preview funciona;
- [ ] Production configurada;
- [ ] environment variables correctas;
- [ ] domínio correcto quando aplicável;
- [ ] HTTPS activo.

---

16. BUILD

Executar build final.

Confirmar:

- [ ] TypeScript PASS;
- [ ] lint PASS;
- [ ] testes PASS;
- [ ] build PASS;
- [ ] sem erros críticos;
- [ ] sem warnings críticos ignorados.

---

17. DATABASE MIGRATION

Antes da produção:

- [ ] migrations revistas;
- [ ] migrations testadas;
- [ ] ordem de execução confirmada;
- [ ] impacto avaliado;
- [ ] estratégia de rollback definida quando aplicável.

Nunca executar alterações destrutivas sem confirmação e backup adequado.

---

18. TESTES FUNCIONAIS

Todos os testes críticos de:

"09_ACCEPTANCE_TESTS.md"

devem estar:

- [ ] PASS;
- [ ] ou explicitamente classificados como NOT APPLICABLE.

Nenhum teste crítico pode estar:

- [ ] FAIL;
- [ ] BLOCKED;
- [ ] NOT TESTED.

---

19. TESTES DE SEGURANÇA

Confirmar:

- [ ] authentication;
- [ ] authorization;
- [ ] RLS;
- [ ] cross-user access;
- [ ] input validation;
- [ ] injection;
- [ ] prompt injection;
- [ ] secret exposure;
- [ ] destructive operations;
- [ ] rate limiting.

---

20. DATA INTEGRITY

Verificar:

- [ ] foreign keys;
- [ ] constraints;
- [ ] estados válidos;
- [ ] datas;
- [ ] progresso;
- [ ] relações entre entidades;
- [ ] ausência de dados duplicados críticos;
- [ ] operações transaccionais quando necessárias.

---

21. REAL DATA

Confirmar que as funcionalidades críticas utilizam dados reais.

Não considerar como concluído se depender de:

- mock data;
- arrays hardcoded;
- respostas falsas;
- localStorage como database;
- dados simulados.

Mocks podem existir exclusivamente para testes automatizados quando apropriado.

---

22. DASHBOARD

Confirmar:

- [ ] objectivos aparecem;
- [ ] projectos aparecem;
- [ ] progresso aparece;
- [ ] tarefas aparecem;
- [ ] deadlines aparecem;
- [ ] blockers aparecem;
- [ ] actividade aparece;
- [ ] next best action funciona.

Os dados devem corresponder à base de dados.

---

23. PROJECT EXECUTION

Testar o fluxo completo:

Objective
   ↓
Project
   ↓
Deliverable
   ↓
Action
   ↓
Execution
   ↓
Evidence
   ↓
Metric
   ↓
Result

Confirmar que as relações são preservadas.

---

24. TIME TRACKING

Verificar:

- [ ] start;
- [ ] stop;
- [ ] duração;
- [ ] projecto;
- [ ] utilizador;
- [ ] persistência;
- [ ] cálculo correcto.

---

25. BLOCKERS

Verificar:

- [ ] criação;
- [ ] actualização;
- [ ] estado;
- [ ] impacto;
- [ ] associação ao projecto;
- [ ] visibilidade no dashboard.

---

26. IDEAS

Verificar:

- [ ] criação;
- [ ] armazenamento;
- [ ] classificação;
- [ ] conversão opcional em projecto;
- [ ] ideias não interrompem automaticamente projectos activos.

---

27. PROJECTS INACTIVE / UNFINISHED

Verificar que o sistema consegue identificar:

- [ ] projectos sem actividade;
- [ ] projectos sem próxima acção;
- [ ] projectos atrasados;
- [ ] projectos bloqueados;
- [ ] projectos incompletos.

Não encerrar automaticamente projectos.

---

28. MOBILE

Testar em smartphone real quando possível.

Confirmar:

- [ ] login;
- [ ] dashboard;
- [ ] projectos;
- [ ] tarefas;
- [ ] timer;
- [ ] evidências;
- [ ] blockers;
- [ ] IA;
- [ ] navegação.

---

29. RESPONSIVE

Testar:

- [ ] smartphone;
- [ ] tablet;
- [ ] desktop.

Confirmar:

- [ ] layout;
- [ ] formulários;
- [ ] menus;
- [ ] tabelas;
- [ ] botões;
- [ ] modais;
- [ ] textos.

---

30. PERFORMANCE

Verificar:

- [ ] carregamento inicial;
- [ ] dashboard;
- [ ] queries;
- [ ] navegação;
- [ ] IA;
- [ ] pesquisa externa.

Investigar operações anormalmente lentas.

---

31. ERROR STATES

Testar situações como:

- [ ] internet indisponível;
- [ ] API indisponível;
- [ ] sessão expirada;
- [ ] dados inválidos;
- [ ] permissões insuficientes;
- [ ] timeout;
- [ ] rate limit;
- [ ] database error.

Cada erro deve produzir comportamento controlado.

---

32. OBSERVABILITY

Confirmar existência de mecanismos para identificar:

- [ ] erros;
- [ ] falhas de autenticação;
- [ ] falhas de integração;
- [ ] operações críticas;
- [ ] problemas de performance;
- [ ] eventos de segurança.

---

33. BACKUP

Antes da produção:

- [ ] estratégia de backup definida;
- [ ] backup disponível;
- [ ] recuperação documentada;
- [ ] teste de recuperação realizado quando possível.

---

34. ROLLBACK

Deve existir um plano para voltar à versão anterior em caso de falha.

Definir:

Current Version
      ↓
Incident
      ↓
Assess
      ↓
Rollback
      ↓
Verify
      ↓
Investigate

---

35. PRODUCTION DEPLOYMENT

Antes do deploy:

- [ ] código aprovado;
- [ ] testes PASS;
- [ ] security checks PASS;
- [ ] environment variables verificadas;
- [ ] database preparado;
- [ ] backup confirmado;
- [ ] rollback conhecido.

---

36. POST-DEPLOYMENT

Depois do deploy:

- [ ] abrir aplicação;
- [ ] login;
- [ ] testar dashboard;
- [ ] criar teste real;
- [ ] verificar database;
- [ ] testar uma operação de IA;
- [ ] verificar logs;
- [ ] verificar erros;
- [ ] confirmar performance;
- [ ] confirmar segurança.

---

37. SMOKE TEST

Executar imediatamente após produção:

Open
 ↓
Login
 ↓
Dashboard
 ↓
Create Test Project
 ↓
Create Action
 ↓
Update Action
 ↓
Record Evidence
 ↓
Check Dashboard
 ↓
Logout

Todos os passos devem funcionar.

---

38. SECURITY GATE FINAL

Resultado obrigatório:

APPROVED

Todos os requisitos críticos passaram.

OU

REQUIRES_FIX

Existem problemas que devem ser corrigidos antes da produção.

OU

BLOCKED

Existe risco crítico.

BLOCKED significa parar o deployment.

---

39. PRODUCTION APPROVAL

Antes de produção:

Product
   ↓
Functional Tests
   ↓
Security Tests
   ↓
Integration Tests
   ↓
Performance
   ↓
Mobile
   ↓
Backup
   ↓
Rollback
   ↓
Security Gate
   ↓
APPROVAL
   ↓
PRODUCTION

---

40. INCIDENT RESPONSE

Se ocorrer um problema crítico após produção:

1. parar alterações;
2. avaliar impacto;
3. proteger dados;
4. considerar rollback;
5. revogar credenciais comprometidas;
6. investigar;
7. corrigir;
8. testar;
9. documentar;
10. voltar a produção apenas após aprovação.

---

41. RELEASE RECORD

Cada release deve possuir:

VERSION:
DATE:
COMMIT:
DEPLOYMENT:
TEST RESULT:
SECURITY RESULT:
KNOWN ISSUES:
ROLLBACK PLAN:
APPROVED BY:
STATUS:

---

42. O QUE NÃO É ACEITÁVEL

Não considerar produção pronta porque:

- "funciona no meu computador";
- "a página abre";
- "o Cursor disse que está pronto";
- "os testes ainda não foram feitos";
- "vamos corrigir depois";
- "é só uma pequena vulnerabilidade";
- "ninguém vai descobrir";
- "é apenas o primeiro utilizador".

---

43. DEFINITION OF DONE — PRODUCTION

Produção só pode ser considerada pronta quando:

- [ ] documentação completa;
- [ ] código versionado;
- [ ] build PASS;
- [ ] testes funcionais PASS;
- [ ] testes de segurança PASS;
- [ ] RLS PASS;
- [ ] integrations PASS;
- [ ] AI PASS;
- [ ] mobile PASS;
- [ ] data persistence PASS;
- [ ] backup preparado;
- [ ] rollback preparado;
- [ ] monitoring/logging preparado;
- [ ] Security Gate APPROVED.

---

44. PRINCÍPIO FINAL

O objectivo não é colocar o produto online o mais rapidamente possível.

O objectivo é colocar online uma versão que:

FUNCIONA → É SEGURA → É TESTÁVEL → É RECUPERÁVEL → GERA RESULTADOS

A velocidade deve vir da boa arquitectura e da execução incremental, não da eliminação de controlos.
