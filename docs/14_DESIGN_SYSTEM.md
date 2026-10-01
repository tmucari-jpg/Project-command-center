# Command Center Design System

O Project Command Center usa um sistema visual próprio inspirado em princípios de design da Apple, sem copiar a identidade visual da Apple.

## Princípio central

**Clareza antes de decoração.**

## Herança

1. O Command Center define os tokens visuais globais.
2. Projetos integrados herdam layout, espaçamento, tipografia, estados, acessibilidade e comportamento dos componentes comuns.
3. Cada projeto pode manter a sua identidade de marca dentro do conteúdo e dos assets, mas não deve quebrar a hierarquia, acessibilidade ou padrões de interação do Command Center.
4. Estilos locais só são permitidos quando houver uma necessidade funcional ou de marca documentada.
5. Não usar sombras, gradientes, animações ou cores apenas para ornamentação.
6. A ação primária de cada contexto deve ser inequívoca; ações secundárias permanecem subordinadas.

## Tokens

### Tipografia

Pilha de sistema: -apple-system, BlinkMacSystemFont, Segoe UI, Inter, sans-serif.

Escala:
- display: 40–48px
- page title: 28–32px
- section title: 20–24px
- body: 15–16px
- secondary: 13–14px
- caption: 12px

Priorizar pesos 400, 500 e 600.

### Layout

- largura máxima de conteúdo: 1200px
- padding horizontal desktop: 32px
- padding horizontal mobile: 20px
- espaçamento em múltiplos de 4px
- grupos relacionados: 8–16px
- secções: 32–56px
- áreas de decisão importantes recebem mais espaço visual

### Superfícies

- background: #F5F5F7
- surface: #FFFFFF
- surface-muted: #F2F2F7
- foreground: #1D1D1F
- secondary: #6E6E73
- border: #D2D2D7
- accent: azul funcional usado com moderação

### Componentes

Cards usam raio de 16px, borda discreta e sombra mínima ou nenhuma.

Botões têm pelo menos 44px de altura, raio de 12px, estados de hover/focus/disabled e uma hierarquia clara entre ação primária e secundária.

Inputs têm pelo menos 44px de altura, labels explícitas, foco visível e mensagens de erro próximas do campo.

A navegação deve ter estado ativo claro, não depender apenas de cor e manter áreas de toque confortáveis.

### Movimento

Animação existe para comunicar mudança de estado, orientar atenção ou confirmar uma ação. Evitar movimento decorativo e respeitar prefers-reduced-motion.

### Acessibilidade

Todos os projetos devem manter contraste adequado, suporte a teclado, foco visível, nomes acessíveis, alvos de toque confortáveis e funcionamento com zoom/tamanho de texto aumentado.

## Regra prática

Antes de adicionar um elemento visual, perguntar:

**Isto ajuda a compreender, decidir ou executar?**

Se não ajudar, deve ser removido ou reduzido.
