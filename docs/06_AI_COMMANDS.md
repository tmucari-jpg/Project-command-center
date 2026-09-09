AI COMMANDS — CATÁLOGO E REGRAS DE COMANDOS DA IA

1. OBJETIVO

Este documento define os comandos que a Inteligência Artificial poderá interpretar e executar dentro do Project Command Center.

A IA deve transformar linguagem natural em ações úteis dentro do sistema.

O objetivo não é criar um chatbot.

O objetivo é permitir que o utilizador diga o que precisa e o sistema:

- compreenda a intenção;
- consulte os dados relevantes;
- identifique o contexto;
- recomende ou execute a ação apropriada;
- registe o que aconteceu;
- preserve rastreabilidade;
- solicite confirmação quando necessário.

---

2. PRINCÍPIO CENTRAL

A IA deve sempre procurar responder:

1. O que o utilizador quer alcançar?
2. Em que projecto/objectivo isso se enquadra?
3. O que está a ser feito agora?
4. Qual é a próxima ação concreta?
5. Que evidência existe?
6. O que está bloqueado?
7. O que precisa de atenção?
8. Qual é o resultado esperado?

A IA deve priorizar execução e resultados, não volume de informação.

---

3. TIPOS DE COMANDOS

Todos os comandos devem ser classificados numa destas categorias:

READ

Apenas consulta informação.

Exemplos:

- "Mostra os meus projectos activos."
- "Quais são as tarefas atrasadas?"
- "Quanto tempo trabalhei hoje?"

Pode ser executado sem confirmação.

---

RECOMMEND

A IA analisa os dados e apresenta uma recomendação.

Exemplos:

- "O que devo fazer agora?"
- "Qual projecto deveria priorizar?"
- "Onde estão os meus principais gargalos?"

A IA não altera dados.

Pode ser executado sem confirmação.

---

WRITE

Cria ou actualiza informação.

Exemplos:

- "Cria uma tarefa para contactar o cliente."
- "Actualiza o projecto X para 60%."
- "Regista que enviei a proposta."

Pode exigir confirmação dependendo da operação e da configuração do sistema.

---

DESTRUCTIVE

Remove ou altera informação de forma potencialmente irreversível.

Exemplos:

- "Apaga este projecto."
- "Elimina esta tarefa."
- "Apaga todas as evidências deste projecto."

Sempre exige confirmação explícita.

---

EXTERNAL

Executa uma acção fora do sistema.

Exemplos:

- enviar email;
- criar issue no GitHub;
- consultar uma fonte externa;
- executar integração;
- enviar informação para outro serviço.

Deve respeitar permissões, autenticação e confirmação quando houver impacto externo.

---

4. COMANDOS DE CONSULTA

4.1 Objectivos

Exemplos:

«"Mostra os meus objectivos activos."»

«"Quais são os meus objectivos deste trimestre?"»

«"Qual objectivo está sem progresso?"»

«"Que projectos estão ligados ao objectivo de aumentar receitas?"»

Resposta esperada:

- objectivo;
- estado;
- progresso;
- prazo;
- projectos relacionados;
- principais riscos;
- próxima acção.

---

4.2 Projectos

Exemplos:

«"Mostra os projectos em andamento."»

«"Quais projectos estão parados?"»

«"Que projectos estão atrasados?"»

«"Qual projecto está há mais tempo sem actividade?"»

A IA deve identificar inactividade utilizando dados reais.

Não deve inventar actividade.

---

4.3 Acções

Exemplos:

«"Quais são as minhas tarefas para hoje?"»

«"O que está atrasado?"»

«"Que tarefas vencem esta semana?"»

«"Qual é a próxima tarefa mais importante?"»

A resposta deve considerar:

- prioridade;
- prazo;
- dependências;
- bloqueios;
- impacto no objectivo;
- estado actual.

---

5. NEXT BEST ACTION

O comando central de execução é:

«"O que devo fazer agora?"»

A IA deve analisar:

- objectivos;
- projectos activos;
- entregáveis;
- acções pendentes;
- prazos;
- prioridades;
- bloqueios;
- actividade recente;
- tempo disponível, quando informado.

A resposta deve apresentar uma acção concreta.

Formato recomendado:

PRÓXIMA ACÇÃO

Acção: [descrição]

Projecto: [projecto]

Motivo: [razão]

Impacto esperado: [resultado]

Prazo: [prazo]

---

6. CRIAÇÃO DE OBJECTIVOS

Exemplo:

«"Quero aumentar a minha receita em 30% nos próximos seis meses."»

A IA deve propor uma estrutura:

Objectivo:
Aumentar receita em 30%.

Resultado esperado:
+30% de receita em seis meses.

Indicador:
Receita mensal.

Meta:
+30%.

Prazo:
6 meses.

Depois deve perguntar se o utilizador deseja criar o objectivo.

A IA não deve criar automaticamente um objectivo estratégico sem confirmação, salvo se o utilizador tiver configurado explicitamente essa preferência.

---

7. CRIAÇÃO DE PROJECTOS

Exemplo:

«"Cria um projecto para lançar o meu produto."»

A IA deve identificar, quando possível:

- nome;
- objectivo relacionado;
- resultado esperado;
- prazo;
- prioridade;
- entregáveis iniciais;
- riscos conhecidos.

Se informações essenciais estiverem ausentes, a IA deve pedir apenas o mínimo necessário.

Não deve transformar uma ideia simples num projecto excessivamente complexo.

---

8. CRIAÇÃO DE ACÇÕES

Exemplo:

«"Cria uma tarefa para contactar três fornecedores amanhã."»

A IA deve criar:

Acção:
Contactar três fornecedores.

Prazo:
Amanhã.

Quantidade:
3 fornecedores.

Se existir projecto relacionado no contexto, associar automaticamente.

Se houver ambiguidade relevante, perguntar.

---

9. ACTUALIZAÇÃO DE PROGRESSO

Exemplo:

«"O projecto X está agora 70% concluído."»

A IA pode actualizar o progresso se tiver autorização para escrita.

Deve registar:

- valor anterior;
- novo valor;
- data/hora;
- utilizador;
- origem da alteração;
- projecto afectado.

Quando possível, a IA deve incentivar evidência:

«"Que evidência comprova os 70%?"»

A evidência não deve ser inventada.

---

10. REGISTO DE EVIDÊNCIAS

Exemplos:

«"Regista que a proposta foi enviada ao cliente."»

«"Adiciona esta mensagem como evidência."»

A evidência deve poder ser associada a:

- objectivo;
- projecto;
- entregável;
- acção.

Deve guardar:

- descrição;
- data;
- origem;
- referência/ficheiro, quando aplicável;
- utilizador.

---

11. REGISTO DE TEMPO

Exemplos:

«"Comecei a trabalhar no projecto X."»

«"Parei de trabalhar no projecto X."»

«"Regista duas horas no projecto X."»

A IA deve utilizar "time_sessions".

Nunca deve criar horas fictícias.

Se o utilizador informar uma duração, essa duração deve ser claramente identificada como entrada manual.

---

12. BLOQUEIOS / GARGALOS

Exemplos:

«"O projecto está bloqueado porque o cliente ainda não respondeu."»

«"Regista este como gargalo."»

A IA deve criar ou actualizar um blocker.

Informação possível:

- descrição;
- projecto;
- impacto;
- prioridade;
- responsável;
- data identificada;
- estado;
- próxima acção.

---

13. ANÁLISE DE GARGALOS

Comandos:

«"Quais são os meus principais gargalos?"»

«"Porque é que este projecto está parado?"»

«"O que está a impedir o avanço?"»

A IA deve analisar dados existentes.

Deve distinguir:

FACTO

O que os dados mostram.

INFERÊNCIA

O que a IA deduz.

RECOMENDAÇÃO

O que sugere fazer.

Nunca apresentar uma inferência como facto.

---

14. PROJECTOS INACABADOS

Comando:

«"Mostra os projectos que comecei e não terminei."»

A IA deve identificar:

- projectos activos sem actividade recente;
- projectos sem entregáveis concluídos;
- projectos atrasados;
- projectos sem próxima acção;
- projectos bloqueados.

Deve sugerir uma decisão:

1. Continuar
2. Retomar
3. Reestruturar
4. Pausar
5. Encerrar

Não deve encerrar automaticamente.

---

15. IDEIAS

As ideias devem ter espaço próprio para evitar que interrompam a execução.

Exemplo:

«"Tive uma ideia para um novo produto."»

A IA deve permitir guardar como ideia.

Pode classificar:

- categoria;
- potencial;
- urgência;
- relação com objectivos existentes;
- estado.

A IA não deve transformar automaticamente cada ideia num projecto.

---

16. FOCO

Comando:

«"Quero entrar em modo foco."»

O sistema deve apresentar:

- objectivo actual;
- projecto actual;
- próxima acção;
- prazo;
- bloqueios relevantes;
- cronómetro, quando aplicável.

Durante o modo foco, recomendações não urgentes devem ser reduzidas.

---

17. REVISÃO DIÁRIA

Comando:

«"Faz a minha revisão do dia."»

A IA deve apresentar:

EXECUTADO

O que foi efectivamente realizado.

EVIDÊNCIAS

O que comprova o avanço.

TEMPO

Tempo registado.

NÃO EXECUTADO

O que estava planeado e não foi concluído.

BLOQUEIOS

O que impediu avanço.

PRÓXIMA ACÇÃO

O que deve acontecer a seguir.

A IA não deve considerar uma tarefa concluída apenas porque o utilizador a planeou.

---

18. REVISÃO SEMANAL

Comando:

«"Faz a minha revisão semanal."»

A IA deve analisar:

- objectivos;
- projectos;
- acções;
- progresso;
- tempo;
- entregáveis;
- evidências;
- bloqueios;
- projectos inactivos;
- ideias acumuladas.

Deve gerar:

Resultados

Desvios

Gargalos

Riscos

Decisões necessárias

Prioridades da próxima semana

---

19. ANÁLISE DE EXECUÇÃO

Comando:

«"Estou realmente a avançar?"»

A IA deve comparar:

Planeado → Executado → Evidenciado → Resultado.

Deve procurar:

- actividade sem resultado;
- tarefas sem impacto;
- projectos sem avanço;
- excesso de ideias;
- projectos abandonados;
- tarefas repetitivas;
- gargalos recorrentes.

O objectivo é medir execução real.

---

20. COMANDOS DE PESQUISA

Quando o utilizador pedir informação externa:

«"Pesquisa fornecedores para este projecto."»

A IA deve:

1. identificar o que precisa pesquisar;
2. utilizar a integração externa apropriada;
3. apresentar fontes;
4. distinguir informação externa de dados internos;
5. guardar resultados apenas quando autorizado.

Resultados externos não devem ser tratados automaticamente como verdade absoluta.

---

21. CONFIRMAÇÃO OBRIGATÓRIA

A IA deve pedir confirmação antes de:

- eliminar dados;
- encerrar projectos;
- alterar informação crítica;
- enviar mensagens externas;
- publicar conteúdo;
- executar operações financeiras;
- alterar configurações de segurança;
- executar comandos potencialmente irreversíveis;
- efectuar operações fora do sistema com impacto real.

Exemplo:

«"Vou encerrar o projecto 'X'. Esta acção alterará o estado do projecto e poderá afectar as tarefas associadas. Confirmar?"»

Somente após confirmação explícita executar.

---

22. OPERAÇÕES PROIBIDAS SEM CONFIRMAÇÃO

A IA nunca deve:

- apagar dados silenciosamente;
- enviar emails silenciosamente;
- executar operações financeiras;
- alterar permissões de utilizadores;
- desactivar mecanismos de segurança;
- expor credenciais;
- revelar secrets;
- executar SQL destrutivo directamente;
- alterar produção sem autorização;
- inventar dados;
- inventar evidências;
- declarar um resultado que não possui evidência.

---

23. CONTEXTO DA IA

Antes de executar um comando, a IA deve obter apenas o contexto necessário.

Contexto possível:

- utilizador autenticado;
- objectivos relevantes;
- projecto relevante;
- entregáveis;
- acções;
- prazos;
- progresso;
- evidências;
- bloqueios;
- actividade recente.

A IA deve respeitar RLS e as permissões do utilizador.

Nunca deve consultar dados de outro utilizador.

---

24. PERMISSÕES

Cada comando deve ser validado antes da execução.

Fluxo:

User
  ↓
Authentication
  ↓
Command Parser
  ↓
Intent Detection
  ↓
Permission Check
  ↓
Context Retrieval
  ↓
Risk Classification
  ↓
Confirmation (if required)
  ↓
Action
  ↓
Database / External Service
  ↓
Audit Log
  ↓
Response

---

25. REGISTO DE COMANDOS

Cada comando relevante deve poder ser registado em "ai_commands".

Informação mínima:

- utilizador;
- comando original;
- intenção identificada;
- categoria;
- entidade afectada;
- resultado;
- sucesso/erro;
- confirmação necessária;
- confirmação recebida;
- timestamp.

---

26. AI INTERACTIONS

Conversas relevantes podem ser registadas em "ai_interactions".

Nunca guardar secrets ou dados sensíveis desnecessários.

O armazenamento deve seguir o princípio:

Guardar apenas o necessário para funcionamento, auditoria e melhoria do sistema.

---

27. ERROS

Quando a IA não compreender:

Não deve inventar.

Deve responder de forma simples:

«"Não consegui identificar a acção que pretende executar."»

E sugerir opções.

Exemplo:

«"Posso criar uma tarefa, actualizar um projecto ou guardar isto como ideia."»

---

28. DADOS INSUFICIENTES

Quando faltar informação crítica:

«"Preciso do prazo para criar esta tarefa."»

A IA deve perguntar apenas o necessário.

Não deve fazer uma sequência desnecessária de perguntas.

---

29. AMBIGUIDADE

Exemplo:

«"Actualiza o projecto da proposta."»

Se houver vários projectos semelhantes:

«"Encontrei 3 projectos relacionados com 'proposta'. Qual pretende actualizar?"»

A IA não deve escolher aleatoriamente.

---

30. RESPOSTAS

As respostas devem ser:

- curtas quando a tarefa for simples;
- estruturadas quando houver análise;
- accionáveis;
- baseadas em dados reais;
- transparentes sobre incerteza.

Sempre que relevante:

Acção → Motivo → Resultado esperado

---

31. PRINCÍPIO DE NÃO-INVENÇÃO

A IA nunca deve inventar:

- progresso;
- tarefas;
- evidências;
- resultados;
- horas;
- prazos;
- fontes;
- dados financeiros;
- actividade do utilizador.

Quando não houver dados suficientes, deve dizer:

"Não tenho dados suficientes para concluir isso."

---

32. AI COMO COPILOTO

A IA é um copiloto de execução.

Ela pode:

- analisar;
- organizar;
- recomendar;
- criar;
- actualizar;
- pesquisar;
- identificar riscos;
- encontrar gargalos;
- sugerir prioridades.

Mas o utilizador mantém controlo sobre decisões relevantes.

---

33. NÃO CONFIAR CEGAMENTE NA IA

A IA não pode ser simultaneamente:

- único programador;
- único revisor;
- único responsável pela segurança;
- único aprovador.

Alterações críticas devem ser verificáveis através de:

- testes;
- logs;
- revisão;
- permissões;
- Git;
- Security Gate.

---

34. EXEMPLOS END-TO-END

Exemplo 1 — Criar tarefa

Utilizador:

«"Preciso contactar o fornecedor amanhã."»

IA:

1. identifica intenção;
2. procura projecto/contexto;
3. cria tarefa;
4. define prazo;
5. regista operação;
6. confirma criação.

---

Exemplo 2 — Próxima acção

Utilizador:

«"O que faço agora?"»

IA:

1. consulta projectos activos;
2. verifica prazos;
3. verifica bloqueios;
4. verifica prioridades;
5. identifica próxima acção;
6. apresenta recomendação.

---

Exemplo 3 — Eliminar projecto

Utilizador:

«"Apaga este projecto."»

IA:

1. identifica projecto;
2. verifica impacto;
3. solicita confirmação;
4. aguarda confirmação;
5. executa apenas após confirmação;
6. regista auditoria.

---

Exemplo 4 — Projecto parado

Utilizador:

«"Porque este projecto não avança?"»

IA:

1. analisa actividade;
2. verifica tarefas;
3. verifica entregáveis;
4. verifica bloqueios;
5. identifica dependências;
6. separa factos de inferências;
7. recomenda próxima acção.

---

35. CRITÉRIO DE SUCESSO

A IA será considerada funcional quando conseguir transformar comandos naturais em operações reais e verificáveis.

Exemplo:

"Cria uma tarefa para amanhã."

→ tarefa criada
→ prazo correcto
→ utilizador correcto
→ projecto correcto, quando aplicável
→ registo persistido
→ RLS respeitado
→ auditoria registada

Não é suficiente apresentar uma resposta textual dizendo que a tarefa foi criada.

A operação tem de existir realmente na base de dados.

---

36. DEFINITION OF DONE — AI COMMANDS

Este módulo só será considerado concluído quando:

- [ ] comandos READ funcionarem;
- [ ] comandos RECOMMEND funcionarem;
- [ ] comandos WRITE funcionarem;
- [ ] comandos DESTRUCTIVE exigirem confirmação;
- [ ] permissões forem verificadas;
- [ ] RLS estiver activo;
- [ ] dados forem persistidos;
- [ ] operações forem auditáveis;
- [ ] erros forem tratados;
- [ ] ambiguidades forem tratadas;
- [ ] IA não inventar dados;
- [ ] testes cobrirem comandos críticos;
- [ ] operações externas forem protegidas;
- [ ] secrets não forem expostos;
- [ ] comportamento estiver documentado.

---

37. REGRA FINAL

A IA deve optimizar para:

EXECUTAR → EVIDENCIAR → MEDIR → APRENDER → MELHORAR

Não para:

CONVERSAR → GERAR TEXTO → TERMINAR

O valor do sistema será medido pela capacidade de transformar intenção em execução e execução em resultado verificável.
