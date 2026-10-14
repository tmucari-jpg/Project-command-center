# PCC — Arquitectura Técnica Actual

**Estado:** OFICIAL / CURRENT  
**Data:** 2026-10-13

## 1. Objectivo

O Project Command Center é um sistema de execução orientado por resultados. A arquitectura deve reduzir esforço manual e suportar o princípio:

> Sistema produz → utilizador revê → utilizador intervém apenas nas excepções.

Regra de autonomia: sempre que um campo puder ser derivado de informação já existente no PCC — por relação entre Objectivo, Projecto, Acção, etapa, evidência, métricas, decisão ou contexto — o sistema deve preenchê-lo antes de pedir intervenção humana. O utilizador valida ou edita se necessário; informação inferível não deve começar vazia.

## 2. Stack

### Aplicação
- Next.js
- React
- TypeScript
- Tailwind CSS

### Backend e dados
- Supabase
- PostgreSQL
- Supabase Auth
- RLS
- Storage quando aplicável

### Infraestrutura
- GitHub — source control e CI
- Vercel — hosting/deployment
- Brevo — SMTP para Supabase Auth
- n8n — automações quando configurado

## 3. Arquitectura lógica

```text
Utilizador
   ↓
Next.js / PCC
   ↓
Server Actions / lógica de aplicação
   ↓
Supabase
 ├─ Auth
 ├─ PostgreSQL
 ├─ RLS
 └─ Storage
   ↓
Serviços externos autorizados
 ├─ Brevo SMTP
 └─ n8n
```

## 4. Domínios funcionais

- Resumo / Dashboard
- Objectivos
- Projectos
- Entregáveis
- Acções
- Foco
- Agenda
- Bloqueios
- Evidências
- Métricas
- Decisões
- Ideias
- Automações
- Monetização
- Fábrica de Projectos
- Administração

## 5. Fábrica de Projectos

Fluxo actual:

```text
Ideia
→ Análise
→ Inteligência competitiva
→ Validação
→ Teste (quando necessário)
→ Preparação final
→ Decisão
→ Projecto
```

A Factory deve reutilizar informação já conhecida e evitar recolha redundante.

## 6. Hierarquia operacional

```text
Objectivo
→ Projecto
→ Entregável
→ Acção
→ Evidência
→ Métrica / Resultado
```

Inferências automáticas actualmente implementadas:
- Entregável pode determinar Projecto numa Acção.
- Acção pode determinar Entregável e Projecto em Evidências e Bloqueios.
- Teste pode herdar alternativa/agente/estratégia da rota de orquestração.

## 7. Separação de responsabilidades

### Cliente
- apresentação;
- interacção;
- navegação.

### Servidor
- autenticação;
- autorização;
- validação;
- escrita de dados;
- regras de negócio;
- acesso a segredos.

### Base de dados
- persistência;
- integridade;
- ownership;
- RLS;
- funções controladas.

## 8. Source of truth

- aplicação: `/application`
- migrations: `/supabase/migrations`
- documentação oficial: documentos CURRENT definidos no índice oficial.


## 9. Modo offline

O PCC suporta trabalho offline em dispositivos que já tenham tido pelo menos uma sessão online autenticada.

Arquitectura:
- service worker fornece o workspace offline quando a navegação de rede falha;
- IndexedDB guarda snapshot local e fila de alterações;
- o snapshot inclui projectos, entregáveis e acções necessárias ao trabalho local;
- alterações offline recebem UUID local e são sincronizadas de forma idempotente;
- a API `/api/offline/sync` valida novamente autenticação, ownership e schemas antes de persistir;
- `sync_queue` mantém evidência das operações sincronizadas;
- o retorno da ligação dispara sincronização automática;
- logout explícito limpa os dados offline do dispositivo.

Operações offline suportadas:
- criar Acção;
- criar Ideia;
- criar Evidência associada a Acção;
- criar Bloqueio associado a Acção;
- actualizar estado de Acção.

Limite de segurança:
um dispositivo que nunca autenticou online não pode validar credenciais Supabase offline. O primeiro acesso ao modo offline exige uma sessão online prévia nesse dispositivo.
