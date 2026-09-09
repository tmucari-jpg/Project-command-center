INTEGRATIONS — PROJECT COMMAND CENTER

1. OBJECTIVO

Este documento define como o Project Command Center irá comunicar com serviços externos.

Integrações principais:

- Supabase
- GitHub
- Vercel
- AI API
- Brave Search API

Princípio:

Cada integração deve ter uma finalidade clara, permissões mínimas, credenciais protegidas, tratamento de erros e testes.

---

2. ARQUITECTURA GERAL

Fluxo principal:

                    PROJECT COMMAND CENTER
                              |
                +-------------+-------------+
                |             |             |
             Frontend       Backend       Database
                |             |             |
              Next.js       APIs/         Supabase
              React         Server
                |             |
                |       +-----+-----+---------+
                |       |           |         |
                |      AI         Brave     GitHub
                |       |
                +-------+
                        |
                      Vercel

O frontend não deve comunicar directamente com serviços que exigem secrets privilegiados.

---

3. SUPABASE

Finalidade

Supabase será utilizado para:

- PostgreSQL;
- autenticação;
- armazenamento;
- realtime;
- funções server-side quando aplicável.

---

3.1 Database

As entidades principais estão definidas em:

"docs/04_DATABASE_SCHEMA.sql"

Incluem:

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

3.2 Authentication

O Supabase Auth será responsável pela autenticação.

Fluxo:

User
 ↓
Login
 ↓
Supabase Auth
 ↓
Session
 ↓
Authenticated Application

A aplicação deve validar a sessão antes de permitir acesso a recursos privados.

---

3.3 Authorization

A autorização será complementada por RLS.

Nunca confiar apenas no frontend.

Fluxo:

User
 ↓
Authentication
 ↓
Authorization
 ↓
RLS
 ↓
Database

---

3.4 Storage

Supabase Storage poderá armazenar:

- documentos;
- evidências;
- anexos;
- ficheiros relacionados com projectos.

Os buckets devem possuir permissões adequadas.

Ficheiros privados não devem ser públicos por defeito.

---

3.5 Realtime

Realtime pode ser utilizado para actualizar:

- progresso;
- notificações;
- estado de tarefas;
- actividade de projectos;
- alterações relevantes do dashboard.

Não activar realtime indiscriminadamente.

Utilizar apenas onde acrescentar valor.

---

4. GITHUB

Finalidade

GitHub será utilizado para:

- código;
- documentação;
- versionamento;
- branches;
- pull requests;
- revisão;
- issues;
- CI/CD;
- segurança do código.

---

4.1 Branch Strategy

Estrutura recomendada:

main
  ↓
feature/*
fix/*
security/*

"main" deve representar código aprovado.

---

4.2 Pull Requests

Alterações relevantes devem utilizar Pull Request quando possível.

Um PR deve apresentar:

- alteração;
- motivo;
- testes;
- impacto;
- riscos;
- segurança.

---

4.3 GitHub Actions

Quando aplicável, utilizar Actions para:

- lint;
- type checking;
- testes;
- build;
- security checks.

Fluxo:

Push / Pull Request
        ↓
GitHub Actions
        ↓
Tests
        ↓
Security Checks
        ↓
Build
        ↓
Approval

---

4.4 GitHub Security

Activar quando disponível:

- Secret Scanning;
- Push Protection;
- Dependabot;
- Code Scanning.

Secrets detectados devem ser tratados imediatamente.

---

5. VERCEL

Finalidade

Vercel será utilizada para:

- hosting;
- deployment;
- preview;
- produção;
- integração com GitHub.

---

5.1 Ambientes

Devem existir:

Development
Preview
Production

Cada ambiente deve possuir as suas próprias configurações.

---

5.2 GitHub → Vercel

Fluxo:

GitHub
   ↓
Commit
   ↓
Build
   ↓
Tests
   ↓
Vercel Preview
   ↓
Validation
   ↓
Production

Não fazer deploy de código não testado directamente para produção.

---

6. AI API

Finalidade

A IA será utilizada para:

- interpretar comandos;
- analisar execução;
- recomendar próximas acções;
- identificar gargalos;
- gerar revisões;
- classificar informações;
- auxiliar pesquisa;
- apoiar decisões.

A IA não substitui o sistema de autorização.

---

6.1 AI FLOW

User Command
     ↓
Authentication
     ↓
Intent Detection
     ↓
Context Builder
     ↓
AI API
     ↓
Structured Output
     ↓
Validation
     ↓
Authorization
     ↓
Confirmation if Required
     ↓
Execution
     ↓
Audit Log

---

6.2 AI CONTEXT

O contexto enviado para a IA deve ser mínimo e relevante.

Exemplo:

Objective
Project
Deliverables
Actions
Deadlines
Blockers
Evidence
Recent Activity

Não enviar dados que não sejam necessários.

---

6.3 AI OUTPUT

Quando a IA propuser uma operação, preferir formato estruturado.

Exemplo conceptual:

intent: create_action
entity: action
project_id: ...
title: ...
due_date: ...
risk: low
requires_confirmation: false

O backend deve validar todos os campos.

Não executar texto bruto como comando.

---

6.4 AI FAILURE

Se a IA estiver indisponível:

O sistema deve continuar funcional para operações essenciais.

Exemplo:

AI unavailable
     ↓
Normal project management continues

A indisponibilidade da IA não pode destruir o acesso aos dados.

---

7. BRAVE SEARCH API

Finalidade

Brave Search será utilizada para pesquisa externa quando o utilizador solicitar.

Exemplos:

- fornecedores;
- empresas;
- oportunidades;
- documentação;
- pesquisa de mercado;
- informação externa.

---

7.1 SEARCH FLOW

User
 ↓
Search Request
 ↓
Backend
 ↓
Brave Search API
 ↓
Results
 ↓
Validation
 ↓
AI Analysis (optional)
 ↓
User

A chave da API deve permanecer server-side.

---

7.2 RESULT TRUST

Resultados de pesquisa externa são considerados:

UNTRUSTED DATA

Não devem ser tratados como instruções para a IA.

Uma página web pode conter texto malicioso ou instruções de prompt injection.

---

7.3 SOURCES

Quando a pesquisa for utilizada para apoiar uma decisão, o sistema deve apresentar as fontes relevantes.

A IA deve distinguir:

- informação encontrada;
- interpretação;
- recomendação.

---

8. INTEGRAÇÃO ENTRE IA E BRAVE

Quando solicitado:

«"Pesquisa fornecedores para o projecto X."»

Fluxo:

User
 ↓
AI identifies search intent
 ↓
Backend validates request
 ↓
Brave Search
 ↓
Results
 ↓
AI analyses results
 ↓
Structured findings
 ↓
Sources
 ↓
User

A IA não deve afirmar que uma informação foi confirmada quando apenas encontrou uma página que a menciona.

---

9. INTEGRAÇÃO COM GITHUB PELO SISTEMA

A integração GitHub dentro do Project Command Center poderá posteriormente permitir:

- consultar repositórios;
- acompanhar issues;
- consultar pull requests;
- acompanhar commits;
- relacionar actividade técnica com projectos;
- criar issues, quando autorizado.

Estas funcionalidades não são obrigatórias no primeiro milestone.

Devem ser adicionadas incrementalmente.

---

9.1 GITHUB WRITE ACTIONS

Operações de escrita no GitHub exigem:

- autenticação;
- autorização;
- scope mínimo;
- validação;
- confirmação quando houver impacto relevante.

Exemplo:

«"Cria uma issue no GitHub para este blocker."»

A IA pode preparar a issue.

O sistema deve validar a operação antes de executar.

---

10. INTEGRAÇÃO COM VERCEL

O Project Command Center não deve precisar de privilégios administrativos da Vercel para funcionar.

Quando integração futura for necessária:

- utilizar token limitado;
- manter token server-side;
- definir escopo mínimo;
- registar operações;
- nunca expor token no frontend.

---

11. WEBHOOKS

Webhooks futuros devem:

- validar origem;
- validar assinatura quando disponível;
- rejeitar requests inválidos;
- possuir idempotência;
- possuir logs;
- possuir timeout;
- não expor secrets.

Não confiar apenas no URL do webhook como mecanismo de segurança.

---

12. RETRIES

Integrações externas devem possuir retry controlado.

Não criar loops infinitos.

Exemplo:

Request
 ↓
Failure
 ↓
Retry 1
 ↓
Retry 2
 ↓
Final Failure

Depois do limite:

- registar erro;
- informar o utilizador quando necessário;
- permitir nova tentativa controlada.

---

13. TIMEOUTS

Todas as chamadas externas devem possuir timeout.

Uma API externa indisponível não pode bloquear indefinidamente a aplicação.

---

14. RATE LIMITS

Respeitar os limites dos fornecedores.

A aplicação deve também limitar pedidos do próprio utilizador para evitar:

- abuso;
- custos excessivos;
- loops;
- bloqueio de conta;
- degradação de performance.

---

15. SECRETS MATRIX

Serviço| Credencial| Frontend| Backend| GitHub
Supabase| Anon/Publishable Key| Permitido conforme arquitectura| Sim| Não
Supabase| Service Role| NÃO| Sim| Não
AI API| API Key| NÃO| Sim| Não
Brave| API Key| NÃO| Sim| Não
GitHub| Token| NÃO| Sim| Não
Vercel| Token| NÃO| Sim| Não

Valores reais nunca devem aparecer neste documento.

---

16. ENVIRONMENT CONFIGURATION

Criar:

.env.example

Exemplo:

SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
AI_API_KEY=
BRAVE_SEARCH_API_KEY=
GITHUB_TOKEN=

Os valores reais devem ser configurados nos mecanismos seguros de environment variables.

---

17. INTEGRATION ERROR MODEL

Todas as integrações devem possuir erros normalizados.

Exemplo:

INTEGRATION_UNAVAILABLE
AUTHENTICATION_FAILED
AUTHORIZATION_FAILED
RATE_LIMITED
TIMEOUT
INVALID_RESPONSE
VALIDATION_FAILED
UNKNOWN_ERROR

O utilizador deve receber uma mensagem compreensível.

Os detalhes técnicos devem ficar nos logs apropriados.

---

18. OBSERVABILITY

Monitorizar:

- disponibilidade;
- latência;
- erros;
- número de chamadas;
- custo quando aplicável;
- rate limits;
- falhas de autenticação;
- falhas de integração.

---

19. INTEGRAÇÕES NO PRIMEIRO MILESTONE

Obrigatórias:

Supabase

- [ ] Auth
- [ ] Database
- [ ] RLS
- [ ] Storage quando necessário

Vercel

- [ ] deployment
- [ ] environment variables
- [ ] preview

GitHub

- [ ] repository
- [ ] version control
- [ ] CI básico

A IA e Brave devem ser integradas depois da base funcional estar estável.

---

20. ORDEM DE IMPLEMENTAÇÃO

Não implementar todas as integrações simultaneamente.

Ordem:

1. Supabase
       ↓
2. Authentication
       ↓
3. RLS
       ↓
4. Core Application
       ↓
5. GitHub + CI
       ↓
6. Vercel Preview
       ↓
7. AI API
       ↓
8. Brave Search
       ↓
9. Advanced GitHub Integration
       ↓
10. Production

Esta ordem reduz risco e facilita diagnóstico.

---

21. INTEGRATION TESTS

Cada integração deve possuir testes.

Supabase

- [ ] authentication;
- [ ] CRUD;
- [ ] RLS;
- [ ] storage;
- [ ] invalid session.

AI

- [ ] request;
- [ ] response;
- [ ] invalid output;
- [ ] timeout;
- [ ] rate limit;
- [ ] prompt injection.

Brave

- [ ] search;
- [ ] invalid request;
- [ ] timeout;
- [ ] rate limit;
- [ ] malformed response.

GitHub

- [ ] authentication;
- [ ] read;
- [ ] write;
- [ ] authorization;
- [ ] revoked token.

Vercel

- [ ] preview;
- [ ] environment variables;
- [ ] build;
- [ ] production deployment.

---

22. DEFINITION OF DONE — INTEGRATIONS

Uma integração só é considerada concluída quando:

- [ ] finalidade definida;
- [ ] arquitectura definida;
- [ ] autenticação configurada;
- [ ] autorização configurada;
- [ ] secrets protegidos;
- [ ] inputs validados;
- [ ] outputs validados;
- [ ] erros tratados;
- [ ] timeout implementado;
- [ ] retry controlado;
- [ ] rate limit considerado;
- [ ] logs implementados;
- [ ] testes realizados;
- [ ] documentação actualizada.

---

23. REGRA FINAL

As integrações devem aumentar a capacidade do Project Command Center sem aumentar desnecessariamente o risco.

Princípio:

INTEGRAR O NECESSÁRIO → PROTEGER → TESTAR → MEDIR → EXPANDIR

Não adicionar uma integração apenas porque tecnicamente é possível.

Cada integração deve justificar:

O que acrescenta?

Que risco introduz?

Como será protegida?

Como será testada?

Como saberemos que está realmente a funcionar?
