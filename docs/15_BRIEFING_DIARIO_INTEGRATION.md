# Briefing Diário — Integração no Command Center

## Estado

**Editorial Engine v2 — integrado em produção**

Repositório do produto:
- `tmucari-jpg/Briefing_Di-rio-`
- branch de produção: `main`
- integração editorial: alertas → eventos → cruzamento de fontes → selecção → briefing

## Regra editorial que o Command Center deve representar

**Alertas são matéria-prima, não notícias publicadas.**

O fluxo oficial é:

```
ALERTAS / RSS
    ↓
RECOLHA
    ↓
FILTRO DE RELEVÂNCIA
    ↓
AGRUPAMENTO POR EVENTO
    ↓
CRUZAMENTO DE FONTES
    ↓
SELECÇÃO EDITORIAL
    ↓
SÍNTESE
    ↓
IMPACTO PARA MOÇAMBIQUE
    ↓
BRIEFING
```

O Command Center não deve representar cada alerta como uma tarefa, notícia ou deliverable independente.

## Unidade de acompanhamento

A unidade principal é o **evento editorial**.

Um evento pode reunir várias fontes sobre o mesmo acontecimento. O Command Center deve mostrar:
- evento;
- estado;
- secção;
- tópico;
- fonte principal;
- número de fontes;
- resumo;
- por que importa;
- impacto para Moçambique;
- oportunidade apenas quando existir evidência.

## Estados

- **HOJE** — acontecimento novo;
- **ACTUALIZAÇÃO** — desenvolvimento novo de um evento anterior;
- **CONTEXTO** — informação de enquadramento, não apresentada como notícia nova.

## Indicadores para o Command Center

O cartão do projecto deve privilegiar estado e evidência de execução, não volume bruto de alertas.

Indicadores recomendados:
- última actualização;
- número de eventos publicados;
- distribuição Mundo / África / Moçambique;
- eventos com múltiplas fontes;
- eventos com impacto identificado para Moçambique;
- oportunidades editoriais identificadas;
- última execução do workflow;
- último resultado de integração.

## Critério de qualidade

O Command Center deve tratar como sinal de qualidade:
1. menos duplicação;
2. melhor agrupamento de fontes;
3. relevância editorial;
4. actualidade;
5. impacto contextualizado para Moçambique.

**Mais alertas não significa melhor briefing.**

## Herança visual

O Briefing Diário continua a herdar do Command Center:
- hierarquia;
- tipografia;
- espaçamento;
- componentes;
- acessibilidade;
- alvos de toque;
- comportamento mobile;
- reduced-motion.

A identidade editorial do Briefing Diário permanece própria.

## Fonte de verdade

O estado técnico do produto deve ser lido do repositório do Briefing Diário e dos seus workflows. O Command Center é a camada de acompanhamento e decisão; não deve duplicar manualmente o conteúdo editorial.
