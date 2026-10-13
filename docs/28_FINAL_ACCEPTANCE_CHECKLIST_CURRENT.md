# PCC — Checklist Final de Aceitação

**Estado:** OFICIAL / CURRENT  
**Uso:** preencher imediatamente após o próximo deploy de produção.

## A. Build e release

- [ ] Último commit da `main` identificado.
- [ ] GitHub CI PASS.
- [ ] Typecheck PASS.
- [ ] Testes PASS.
- [ ] Lint PASS.
- [ ] Build PASS.
- [ ] Deployment Vercel target production criado.
- [ ] Deployment em estado READY.
- [ ] Alias/domínio de produção aponta para o deployment correcto.

## B. Identidade visual

- [ ] Landing usa identidade PCC.
- [ ] Login usa fundo PCC leve e delicado.
- [ ] Logo oficial correcto.
- [ ] Cabeçalho/sidebar usam marca correcta.
- [ ] Sem ícone genérico antigo.
- [ ] Mobile sem overflow/clipping.

## C. Autenticação

- [ ] Login PASS.
- [ ] Logout PASS.
- [ ] Recuperação de palavra-passe PASS.
- [ ] Rotas privadas bloqueadas sem sessão.
- [ ] Sessão mantém-se correctamente.

## D. Administração

- [ ] Admin autorizado vê “Administração”.
- [ ] Utilizador não-admin não vê “Administração”.
- [ ] Acesso directo não-admin a rota admin é negado/redireccionado.
- [ ] Orquestração acessível ao admin.
- [ ] Configuração técnica acessível ao admin.

## E. Fluxo operacional principal

- [ ] Criar/abrir Objectivo.
- [ ] Criar/abrir Projecto.
- [ ] Criar Entregável.
- [ ] Criar Acção ligada ao Entregável.
- [ ] Projecto é inferido correctamente.
- [ ] Marcar próxima acção.
- [ ] Criar Evidência ligada à Acção.
- [ ] Entregável/Projecto são inferidos.
- [ ] Criar Bloqueio ligado à Acção.
- [ ] Hierarquia é inferida.
- [ ] Criar Decisão.
- [ ] Dados persistem após logout/login.

## F. Factory

- [ ] Novo projecto abre.
- [ ] Caso é criado.
- [ ] Inteligência competitiva guarda.
- [ ] Validação guarda.
- [ ] Teste abre quando necessário.
- [ ] Metadados do teste são derivados.
- [ ] Preparação final consolida.
- [ ] Decisão final funciona.
- [ ] “Go” converte/cria projecto correctamente.

## G. Segurança / dados

- [ ] RLS continua activo.
- [ ] Teste cross-user PASS.
- [ ] Nenhum utilizador vê dados de outro.
- [ ] Admin allowlist funciona.
- [ ] Nenhum secret exposto no browser/repositório.
- [ ] Security Advisor revisto.
- [ ] Warnings intencionais documentados.

## H. Base de dados

- [ ] Migrations alinhadas com produção.
- [ ] 14 índices presentes.
- [ ] RLS initplan warnings removidos.
- [ ] Sem migration pendente destrutiva.
- [ ] Backup/rollback conhecido.

## I. Offline e sincronização

- [ ] Abrir PCC online e activar snapshot local.
- [ ] Desligar a internet.
- [ ] Reabrir/navegar no PCC e obter workspace offline.
- [ ] Snapshot mostra projectos/acções locais.
- [ ] Criar uma Acção offline.
- [ ] Criar uma Ideia offline.
- [ ] Registar Evidência offline.
- [ ] Registar Bloqueio offline.
- [ ] Actualizar estado de uma Acção offline.
- [ ] Fechar/reabrir a aplicação e confirmar persistência local.
- [ ] Recuperar internet.
- [ ] Sincronização inicia automaticamente.
- [ ] Fila local fica vazia após sucesso.
- [ ] Registos aparecem no Supabase/PCC.
- [ ] Repetir sincronização não cria duplicados.
- [ ] Logout online limpa o workspace offline local.
- [ ] Dispositivo sem sessão online prévia não desbloqueia dados offline.

## J. Operações

- [ ] Runtime logs sem erro crítico após release.
- [ ] Supabase healthy.
- [ ] Vercel healthy.
- [ ] GitHub CI healthy.
- [ ] Release Record preenchido.

## Resultado

- [ ] **APPROVED**
- [ ] **APPROVED WITH ACCEPTED LIMITATIONS**
- [ ] **REQUIRES FIX**
- [ ] **BLOCKED**

Observações:
