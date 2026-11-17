# Portão B: conta convidado (plano B1, 17/11/2026)

Estado: **B2 e B3 implementados e testados (17/11)**; aceito pelo dono em 17/11; falta o deploy. A migração `20261117120000_convidado` está aplicada só no banco de desenvolvimento e no de teste; produção não foi tocada.

Decisões do dono no B1: o endereço do backend no Render é o **público**, então o limite por IP fica **desligado** (`LIMITE_CONVIDADO_IP=desligado`) e só o teto total vale; a tela de vínculo reutiliza o `Modal` do jogo e os campos do login.
Decisões do dono (B0): ranking opção (a), limpeza de 30 dias a cada 24 h e na subida, atividade por `GameState.ultimaAtividadeEm` com fallback em `criadoEm`, tetos 5 por IP/hora e 200 no total/hora, nome "Convidado" + 4 dígitos e pedido de nome no vínculo.

## 1. Esquema e migração (`20261117120000_convidado`)

```sql
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;   -- o unique continua; o Postgres aceita vários nulos
ALTER TABLE "users" ADD COLUMN "convidado" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "users_convidado_criado_em_idx" ON "users" ("convidado", "criado_em");
```

- `User.email String? @unique`, `User.convidado Boolean @default(false)`, `@@index([convidado, criadoEm])`.
- Sem coluna de atividade nova: a limpeza usa `GameState.ultimaAtividadeEm`, e `User.criadoEm` quando ele é nulo ou não há `GameState`.
- Contas existentes: `convidado = false`, e-mails intactos. Nenhum dado é reescrito.
- **Verificação offline (como no 20d-3), sem tocar em produção:** `make conferir-migracao-convidado` sobe um Postgres descartável (`postgres:17-alpine`, contêiner novo), aplica as migrações 1 a 3, insere usuários, sessões, estados, logs e ranking sintéticos, aplica a 4 e confere: mesmas contagens em todas as tabelas, e-mails preservados, `convidado = false` em todos, unique ainda recusa e-mail repetido, aceita dois usuários sem e-mail. Opcional: contagem de linhas de produção só com `select count(*)`, somente leitura.

## 2. Criação: `POST /auth/convidado`

- Corpo vazio (`z.strictObject({})`), mesma checagem de origem das demais rotas.
- Ordem das checagens: (1) teto total: `count(users where convidado and criadoEm > agora - 1 h) >= 200` responde 429 `convidados_esgotados` com `Retry-After`; (2) teto por IP, só se ligado (item 7); (3) cria `User { nome: "Convidado NNNN", convidado: true, email: null, senhaHash: null, emailVerificado: false }`, abre sessão por cookie (`criarSessao`, igual às demais) e responde 201 com `usuario`.
- O teto total vem do banco, então sobrevive ao reinício. Duas requisições simultâneas podem passar de 200 por poucas unidades; aceito, e o teste fixa o comportamento.
- `NNNN` = `randomInt(1000, 10000)`, sem garantia de unicidade (o nome não identifica ninguém; o `id` identifica).
- Não cria `RankingEntry` (item 5).
- Convidado nunca entra por senha: `senhaHash` nulo já falha em `conferirSenha`, e não há e-mail para digitar.
- Números em `config.ts`: `CONFIG_CONVIDADO = { janelaMs: 1 h, porIpPorJanela: 5, totalPorJanela: 200, inatividadeMs: 30 dias, limpezaIntervaloMs: 24 h, limpezaTeto: 500 }`.

## 3. Vínculo (código novo: não havia vínculo para usuário logado)

Todas as rotas exigem sessão e `convidado = true`; senão 409 `nao_e_convidado`. O mesmo `User` é migrado (mesmo `id`, mesmo `GameState`).

**E-mail e senha, `POST /auth/vincular/email { nome, email, senha }`** (uma etapa, já pede o nome):
- Reaproveita `esquemaCadastro` e `gerarHashSenha`.
- `updateMany({ where: { id, convidado: true }, data: { email, senhaHash, nome, convidado: false } })`; `count = 0` vira 409. `emailVerificado` fica `false`, como no cadastro.
- E-mail já em outro usuário (P2002): **não mescla**; responde 409 `conta_ja_vinculada`.
- No sucesso, cria a entrada do ranking (item 5) na mesma transação.

**Google e Discord, duas etapas** (o nome precisa vir depois do retorno do provedor):
1. `GET /auth/:provedor/vincular`: guarda no cookie `cronarca_oauth` (já tem `state` e verificador PKCE) a intenção `i: "vincular"` e o `u: userId`; nada vem da URL. Redireciona ao provedor.
2. `/callback`: se o cookie traz `i: "vincular"`, exige sessão do mesmo `u` e `convidado = true`. Exige e-mail verificado pelo provedor (mesma regra do login). Se a conta do provedor ou o e-mail já pertencem a outro usuário, redireciona com `erro=conta_ja_vinculada`, sem mesclar. Senão cria o `OAuthAccount`, grava o e-mail e **mantém `convidado = true`** (vínculo pendente). Redireciona a `/jogo?vinculo=nome`, com o nome do perfil só como sugestão de pré-preenchimento.
3. `POST /auth/vincular/confirmar { nome }`: exige vínculo pendente (tem OAuth). Grava o nome, `convidado = false` e cria a entrada do ranking. O pré-preenchimento é o nome do provedor, ou a parte do e-mail antes do `@`.
- Efeito colateral útil: enquanto o nome não for confirmado, o jogador não aparece no ranking como "Convidado 4821". `UsuarioPublico` ganha `convidado` e `vinculoPendente`, e `email` passa a `string | null`.

**Conflito `conta_ja_vinculada`:** a tela oferece "Entrar na conta existente" (login normal; o convidado fica órfão e a limpeza o remove, com aviso de que o progresso dele se perde) ou "Cancelar" (continua como convidado). Nenhuma mesclagem automática.

## 4. Limpeza agendada

`limparConvidados(prisma, agora)` em `auth/limpeza.ts`:
- Candidatos: `convidado = true`, `senhaHash = null`, **sem nenhum `OAuthAccount`** e última atividade (`gameState.ultimaAtividadeEm`, ou `criadoEm` se nulo ou sem estado) anterior a `agora - 30 dias`. Ordem por `criadoEm`, no máximo **500** por execução.
- A remoção repete as mesmas condições no `deleteMany` (se o jogador voltou no meio, sai da lista). Um convidado vinculado, mesmo pendente, nunca é removido.
- A cascata do esquema (`onDelete: Cascade`) apaga sessões, estado, log de ações, ranking e contas OAuth.
- Registro: `[limpeza] convidados removidos: N (teto 500)`, e uma linha extra se N = 500 ("resto na próxima execução").
- Roda uma vez na subida do servidor (depois do `listen`, sem bloquear, com erro capturado) e a cada 24 h por `setInterval(...).unref()`. O encerramento (`SIGTERM`) já existente não é afetado.

## 5. Ranking (opção a)

- `obterOuCriarEstado` só chama `criarEntrada` se `user.convidado = false`.
- **`gravarMarco` ganha a mesma guarda.** Hoje ele faz `upsert` e, sem a guarda, criaria a entrada de um convidado no primeiro marco (achado do B1).
- No vínculo concluído: liquida o estado como as ações fazem, calcula `chaveRanking(estado)` e grava a entrada com `era, ciclo, reliquias` **do estado atual**, `tempoJogado = GameState.tempoJogado` e `marcoEm = agora`.
- **Desempate coerente:** a ordem é era, ciclo e relíquias (decrescentes), `marcoEm` crescente e `userId`. Quem vincula em T fica atrás de quem já estava naquela mesma posição antes de T e à frente de quem a alcança depois de T. `marcoEm` passa a significar "quando entrou nesta posição do ranking", o que vale para todos, e o próximo marco do jogador o regrava como hoje. Custo aceito: um convidado que ficou dias numa posição fica atrás de quem a atingiu enquanto isso. O teste fixa isso com dois jogadores empatados.
- `listarRanking` não muda: para convidado `jogador = null`, e a tela diz que é preciso vincular a conta.

## 6. Frontend

- `CONVIDADO_DISPONIVEL = true`, e o botão chama `POST /api/auth/convidado` (mesma rotina de sessão do login e o mesmo `destino`).
- Aviso discreto no jogo para quem tem `convidado`: "Conta de convidado: vincule para guardar seu reino e entrar no ranking."
- Tela de vínculo: e-mail e senha, Google e Discord, e o pedido de nome (pré-preenchido). `Modais.tsx:368` mostra "Convidado" sem e-mail. **Pergunta de layout:** não há frame no Figma para a tela de vínculo. Proponho reutilizar o `Modal` do jogo e os campos do login, sem tela nova no Figma. Se preferir um frame, eu espero.

## 7. Limite por IP e `trust proxy`

- Hoje `app.set('trust proxy', 'loopback, linklocal, uniquelocal')`: confia em qualquer salto de rede privada, não em "um salto". Com isso o Express anda a cadeia `X-Forwarded-For` da direita para a esquerda e usa o primeiro endereço **não** privado. Forjar o início do cabeçalho não funciona, desde que o salto de fora acrescente o IP real.
- O que decide é o caminho em produção: navegador, borda do Render, serviço do Next, rewrite, Express. **Se o Next fala com o backend por endereço interno (rede privada), `req.ip` é o do jogador. Se fala pelo endereço público, `req.ip` seria o da borda do Render, igual para todos.** Não consigo ver o Render daqui.
- Plano: o limite por IP nasce **desligado** (`LIMITE_CONVIDADO_IP=desligado` por padrão) e só o teto total de 200 vale. Na subida e na criação o servidor registra, sem gravar IP, `req.ips.length` e se `req.ip` é privado. O dono confere em produção (a variável do backend usada pelo `next.config.ts`, interna ou pública, e o registro) e liga a variável quando `req.ip` variar entre jogadores.
- Teste (B3): requisição com `X-Forwarded-For: 203.0.113.5` dá `req.ip = 203.0.113.5`; com `1.2.3.4, 203.0.113.5` continua `203.0.113.5` (forjar a esquerda não ajuda); o 6º convidado do mesmo IP recebe 429 e o de outro IP passa.

## 8. Testes (B3)

- **Criação:** 201, cookie `httpOnly`, `email` nulo, `convidado` verdadeiro, sem `RankingEntry`; `/me` devolve o usuário; login por senha com e-mail inexistente falha.
- **Taxa:** 200 no total na janela (banco), a janela reabre depois de 1 h simulada, o reinício do processo (novo limitador em memória) não zera o total; por IP, ligado e desligado.
- **Vínculo por e-mail:** sucesso com o **mesmo `id`**, o mesmo estado e a entrada criada com o estado atual; conflito 409 `conta_ja_vinculada` sem alterar nada; não é convidado, 409; sem sessão, 401.
- **Vínculo OAuth** (provedor simulado, como `oauth.test.ts`): pendente, depois confirmação com nome; conflito por conta de provedor e por e-mail; `u` do cookie diferente da sessão é recusado.
- **Ranking:** convidado fora da lista e `gravarMarco` não cria entrada; depois do vínculo ele entra com o estado atual, `marcoEm` = agora e o desempate descrito acima.
- **Limpeza:** remove convidado de 31 dias; mantém o de 29 dias, o vinculado, o pendente (com OAuth) e o que tem senha; respeita o teto de 500 (insere 501, remove 500); cascata de sessões, estado, log de ações e ranking; uso de `criadoEm` quando `ultimaAtividadeEm` é nulo; roda na subida.
- **Migração:** o script offline do item 1.
- **Relatório B3:** números de cada grupo, saída do `make test` e do `make typecheck`.

## 9. Arquivos do B2

Novos: `migrations/20261117120000_convidado`, `auth/convidado.ts`, `auth/vinculo.ts`, `auth/limpeza.ts`, `scripts/conferir-migracao-convidado.ts` (+ `make`), testes, front da tela de vínculo.
Alterados: `schema.prisma`, `config.ts`, `auth/rotas.ts`, `auth/cookies.ts` e `auth/oauth.ts` (intenção no cookie), `auth/usuario-publico.ts`, `jogo/repositorio.ts`, `ranking/repositorio.ts`, `server.ts` (limpeza), `lib/convidado.ts`, `CartaoLogin.tsx`, `Modais.tsx`, `JogoAoVivo.tsx`, `docs/` (handoff e registro).
Fora do escopo: recuperação de senha, mesclagem automática, Tela inicial e mapa.
