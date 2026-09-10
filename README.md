# Project-command-center
Project Command Center

Centro de Execução de Projetos com IA

Um sistema inteligente para transformar objectivos em execução mensurável.

O Project Command Center foi concebido para responder a três perguntas fundamentais:

1. O que quero alcançar?
2. O que estou a fazer agora?
3. Que evidência prova que avancei?

---

1. Modelo Central

O sistema organiza o trabalho através da seguinte cadeia:

OBJECTIVE
    ↓
PROJECT
    ↓
DELIVERABLE
    ↓
ACTION
    ↓
EXECUTION
    ↓
EVIDENCE
    ↓
METRIC
    ↓
RESULT

O foco não é simplesmente organizar tarefas.

O foco é produzir resultados e provar execução.

---

2. O Problema

Muitas ferramentas de produtividade permitem criar:

- tarefas;
- listas;
- projectos;
- notas;
- calendários.

Mas organização, por si só, não garante execução.

O Project Command Center procura resolver problemas como:

- muitas ideias dispersas;
- projectos iniciados e não concluídos;
- falta de próxima acção;
- bloqueios não identificados;
- dificuldade em medir progresso;
- falta de evidências;
- perda de tempo;
- excesso de actividades sem impacto;
- dificuldade em saber o que fazer a seguir.

---

3. Proposta

O sistema transforma intenção em execução:

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

Cada nível deve contribuir para o resultado final.

---

4. Funcionalidades Principais

Objectives

Permite definir:

- objectivo;
- resultado esperado;
- prioridade;
- prazo;
- estado;
- progresso.

---

Projects

Permite acompanhar:

- projectos activos;
- projectos atrasados;
- projectos bloqueados;
- projectos sem actividade;
- projectos incompletos.

---

Deliverables

Cada projecto pode ser dividido em entregáveis concretos.

---

Actions

As acções representam aquilo que precisa efectivamente de ser executado.

Cada acção pode possuir:

- descrição;
- prioridade;
- estado;
- prazo;
- responsável;
- progresso;
- projecto associado.

---

Execution & Time Tracking

O sistema permite acompanhar:

- quando uma actividade começou;
- quando terminou;
- quanto tempo foi utilizado;
- em que projecto o tempo foi investido.

O objectivo é comparar:

tempo investido × progresso × resultado.

---

Evidence

O progresso deve poder ser comprovado através de evidências.

Exemplos:

- documento;
- link;
- ficheiro;
- resultado;
- entrega;
- registo;
- actividade concluída.

---

Metrics

Permite medir resultados através de indicadores.

A intenção é evitar que "fiz muitas coisas" seja confundido com:

"avancei no que realmente importa".

---

5. Blockers

O sistema identifica e acompanha gargalos.

Um blocker pode impedir o avanço de um projecto mesmo quando existem várias tarefas disponíveis.

O sistema deve ajudar a responder:

- O que está a bloquear?
- Porquê?
- Qual o impacto?
- Quem precisa agir?
- Qual é a próxima acção?

---

6. Ideas

Ideias são capturadas sem permitir que destruam o foco da execução.

Uma ideia pode posteriormente transformar-se em:

IDEA
 ↓
PROJECT
 ↓
DELIVERABLE
 ↓
ACTION

---

7. Unfinished Projects

O sistema deve identificar projectos que:

- foram iniciados e abandonados;
- não possuem actividade recente;
- não possuem próxima acção;
- estão atrasados;
- estão bloqueados.

A IA pode recomendar uma decisão:

- continuar;
- redefinir;
- bloquear;
- arquivar;
- transformar;
- eliminar.

Operações destrutivas exigem confirmação.

---

8. Dashboard

O dashboard deve mostrar aquilo que exige atenção.

Exemplos:

- objectivos;
- projectos activos;
- progresso;
- deadlines;
- blockers;
- actividades recentes;
- projectos inactivos;
- próximas acções;
- indicadores de execução.

O dashboard não deve ser apenas visualmente bonito.

Deve ajudar o utilizador a decidir e agir.

---

9. Next Best Action

Uma das funcionalidades centrais.

O sistema deve responder:

«Qual é a acção mais importante que devo executar agora?»

A recomendação deve considerar, quando disponível:

- objectivos;
- prioridade;
- prazo;
- dependências;
- blockers;
- progresso;
- impacto;
- tempo disponível;
- contexto actual.

A IA recomenda.

O utilizador decide.

---

10. Focus Mode

O Focus Mode reduz o excesso de informação e apresenta apenas aquilo que é relevante para a execução actual.

Pode incluir:

OBJECTIVE
PROJECT
CURRENT ACTION
TIME
NEXT ACTION
BLOCKER
EXPECTED RESULT

---

11. AI Copilot

A IA funciona como copiloto de execução.

Pode:

- analisar progresso;
- identificar riscos;
- sugerir próximas acções;
- resumir actividade;
- encontrar projectos inactivos;
- analisar blockers;
- criar estruturas;
- actualizar dados mediante autorização;
- responder a comandos naturais;
- realizar pesquisas externas quando autorizado.

A IA não é a autoridade final.

---

12. Natural Language Commands

O utilizador deve poder interagir naturalmente.

Exemplos:

"Cria um projecto para este objectivo."

"Mostra-me os projectos atrasados."

"O que devo fazer agora?"

"Regista que terminei esta tarefa."

"Quanto tempo investi neste projecto?"

"Mostra os meus projectos sem actividade."

"Quais são os principais bloqueios?"

"Cria uma acção para resolver este blocker."

Comandos de escrita ou operações sensíveis devem respeitar as regras de autorização e confirmação.

---

13. AI Command Classification

Os comandos são classificados como:

READ
RECOMMEND
WRITE
DESTRUCTIVE
EXTERNAL

Operações destrutivas exigem confirmação explícita.

---

14. Segurança

A segurança é parte da arquitectura e não uma funcionalidade adicionada posteriormente.

Princípios:

- Authentication;
- Authorization;
- Row Level Security;
- Input Validation;
- Output Validation;
- Secret Management;
- Server/Client Separation;
- Rate Limiting;
- Audit Logs;
- Security Events;
- Prompt Injection Protection;
- API Security;
- Secure Integrations.

O "service_role" do Supabase nunca deve ser exposto ao frontend.

---

15. Security Gate

Cada milestone deve possuir um Security Gate:

APPROVED
REQUIRES_FIX
BLOCKED

Se existir risco crítico:

BLOCKED

O desenvolvimento deve parar até que o problema seja resolvido.

---

16. Technology Stack

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
- Edge Functions quando necessário

Email

- Supabase Auth com SMTP Brevo

Development

- GitHub
- Cursor

Deployment

- Vercel

---

17. Architecture

                    USER
                      ↓
              NEXT.JS APPLICATION
                      ↓
              APPLICATION LOGIC
                      ↓
                      ↓
                  SUPABASE
              ↙       ↓       ↘
       DATABASE     AUTH     STORAGE
                       ↓
                 BREVO SMTP

---

18. Data Ownership

Cada utilizador deve ter acesso apenas aos seus dados, de acordo com as regras de autorização.

A segurança da base de dados não deve depender exclusivamente do frontend.

RLS deve funcionar como camada fundamental de isolamento.

---

19. Development Philosophy

O projecto segue uma abordagem incremental.

Não construir tudo de uma vez.

Fluxo:

SPECIFICATION
      ↓
AUDIT
      ↓
ARCHITECTURE
      ↓
DATABASE
      ↓
SECURITY
      ↓
CORE FUNCTIONALITY
      ↓
TESTS
      ↓
AI
      ↓
INTEGRATIONS
      ↓
PRODUCTION

---

20. Audit First

Antes de começar a implementação:

AUDIT FIRST

O agente de desenvolvimento deve:

1. ler a documentação;
2. analisar o repositório;
3. identificar o estado actual;
4. identificar conflitos;
5. identificar riscos;
6. identificar dependências;
7. identificar o que falta;
8. criar:

docs/AGENT_AUDIT.md

Durante esta fase:

NÃO IMPLEMENTAR.

---

21. Source of Truth

A documentação em "/docs" é a fonte de verdade do projecto.

Em caso de conflito entre:

- código;
- suposição;
- pedido ambíguo;
- implementação anterior;

a decisão deve ser baseada na documentação aprovada ou encaminhada para revisão.

---

22. Testing

O sistema possui testes de aceitação definidos em:

docs/09_ACCEPTANCE_TESTS.md

Uma funcionalidade não é considerada concluída apenas porque:

- compila;
- aparece no ecrã;
- parece funcionar.

É necessário provar:

IMPLEMENTED
+
TESTED
+
SECURE
+
PERSISTENT
+
WORKING

---

23. Production

Antes de produção deve ser verificado:

BUILD
TESTS
SECURITY
DATABASE
RLS
AI
INTEGRATIONS
MOBILE
PERFORMANCE
BACKUP
ROLLBACK
MONITORING

Ver:

docs/10_PRODUCTION_CHECKLIST.md

---

24. Repository Structure

project-command-center/
│
├── docs/
│   ├── 01_MASTER_SPEC.md
│   ├── 02_MASTER_AGENT_PROMPT.md
│   ├── 03_ARCHITECTURE.md
│   ├── 04_DATABASE_SCHEMA.sql
│   ├── 05_RLS_POLICIES.sql
│   ├── 06_AI_COMMANDS.md
│   ├── 07_SECURITY.md
│   ├── 08_INTEGRATIONS.md
│   ├── 09_ACCEPTANCE_TESTS.md
│   ├── 10_PRODUCTION_CHECKLIST.md
│   └── AGENT_AUDIT.md
│
├── README.md
│
└── application/

A estrutura da aplicação pode evoluir durante o desenvolvimento, desde que continue coerente com a arquitectura definida.

---

25. Core Principle

O produto não deve optimizar apenas:

organização.

Deve optimizar:

EXECUÇÃO → EVIDÊNCIA → RESULTADO.

---

26. Success Criteria

O Project Command Center será bem-sucedido quando conseguir ajudar o utilizador a:

- transformar objectivos em projectos;
- transformar projectos em acções;
- executar;
- medir tempo;
- registar evidências;
- identificar bloqueios;
- recuperar projectos parados;
- decidir a próxima acção;
- medir resultados;
- reduzir dispersão;
- aumentar execução.

---

27. Final Principle

«Não queremos mais uma ferramenta para guardar tarefas.

Queremos um sistema que ajude a transformar intenção em resultado.»

---

## Implementação actual

A aplicação executável encontra-se em `application/`.

A base de dados é gerida por migrations em `supabase/migrations/`.

Para desenvolvimento local:

```bash
cd application
npm install
cp .env.example .env.local
npm run dev
```

Antes do primeiro deploy, consulte `docs/12_DEPLOYMENT.md`.

Na Vercel, configure **Root Directory = `application`**.


## Deploy imediato

Siga a sequência curta em [`DEPLOY_NOW.md`](DEPLOY_NOW.md).
