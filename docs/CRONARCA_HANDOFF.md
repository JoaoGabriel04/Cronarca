# Cronarca: handoff para o Claude Code

Jogo web incremental (idle) medieval. Cada jogador joga logado, com estado guardado e validado no servidor, e ranking honesto. Este documento junta tudo o que foi decidido no design. Ele vem junto com `CRONARCA_MAPA_SPEC.md` (escala, camadas, tiles e slots do mapa), que continua sendo a fonte da verdade do mapa.

## Regras de trabalho (valem para todo o documento)

1. **Nenhum arquivo é escrito antes do Portão 0 ser aprovado.** Cada portão termina com uma entrega pequena e pede aprovação humana explícita antes do próximo.
2. Antes de cada portão: auditar o que existe, listar o que vai mudar e esperar o "pode seguir".
3. Números de economia deste documento são **valores do protótipo de design, sem balanceamento**. Ficam em arquivos de dados, nunca no código.
4. Regra de ouro do jogo: o servidor é a autoridade. O cliente envia intenções e nunca valores. Qualquer atalho que confie em número vindo do cliente precisa de aprovação explícita.
5. Interface sem emojis. Ícones só dos sprites (`Sprite/Icone`) ou Lucide React onde não houver sprite.
6. Pixel art: `image-rendering: pixelated`, zoom sempre inteiro, nunca esticar sprite.

## Referências no Figma

Arquivo "Cronarca - Telas", fileKey `e6AYbKy8d1uUd5gIYC857u`.

| Página | Conteúdo |
|---|---|
| Telas v2 | Início, Login, Mapa, Vila (desktop), Heróis, Expedições, Eras, 6 modais, 4 telas mobile |
| Sprites | Component sets no Figma (`Sprite/...`) com quadros 1 e 2. Os sprites animados do jogo têm de 2 a 6 quadros, em `public/sprites/<grupo>/` com a tabela `quadros.json` (ver seção Sprites) |
| Componentes | Chip de recurso, Botão |
| Telas | Versão antiga, só consulta |

Frames de Telas v2: `Mapa - Desktop`, `Vila - Desktop`, `Herois - Desktop`, `Expedicoes - Desktop`, `Eras - Desktop`, `Modal Melhorar/Construir/Ascensao/Configuracoes/Ranking/Pesquisa - Desktop`, `Construir - Desktop (Catalogo)`, `Construir - Mobile (Catalogo)`, `Modal Pesquisa - Mobile`, `Vila/Herois/Expedicoes/Eras - Mobile`. Frame desktop: 1440 x 900. Mobile: 390 x 844.

## Stack decidida

| Camada | Escolha |
|---|---|
| Infra | Docker Compose, `Makefile` na raiz (`make up` liga banco, backend e frontend) |
| Banco | PostgreSQL |
| Backend | Node, Express, TypeScript, Prisma, Zod para validar entradas |
| Frontend | Next.js (App Router), TypeScript, SWR nos GET |
| Login | obrigatório: e-mail e senha, Google, Discord |
| Avatar | Cloudinary (upload assinado pelo backend) |
| Animação de interface | GSAP (telas, modais, contadores). Sprites não usam GSAP: os do mapa animam no loop do canvas, os das telas num único `requestAnimationFrame` global |
| Mapa | Canvas 2D (Pixi.js só se o desempenho exigir) |
| Código compartilhado | pacote `game-core` em TypeScript puro, usado por servidor e cliente |
| Testes | Vitest no `game-core` e na API |

Estrutura de pastas (monorepo com workspaces):

```
cronarca/
  Makefile
  docker-compose.yml
  .env.example
  packages/game-core/   regras, dados e simulação (sem I/O)
  apps/backend/         Express, Prisma, rotas, auth
  apps/frontend/        Next.js, canvas do mapa, telas
```

Targets mínimos do Makefile: `up`, `down`, `logs`, `ps`, `migrate`, `seed`, `reset-db`, `test`, `shell-backend`, `shell-db`. Os serviços do Compose são `db`, `backend`, `frontend` e `mailpit` (só em desenvolvimento), com healthcheck no banco e o backend esperando o banco saudável.

## Arquitetura do jogo (servidor é a autoridade)

Requisito do dono: o jogador só joga logado, e o resultado precisa ser completamente honesto. O cliente nunca envia quantidades, só intenções.

1. **Estado vive no servidor.** Uma linha de estado por jogador, com `rev` (contador) para controle de concorrência.
2. **Liquidação preguiçosa.** Produção é função do tempo: o servidor guarda `atualizadoEm` e, em toda leitura ou ação, avança a simulação até agora, aplicando em ordem os eventos que ficaram no meio (obra que termina, expedição que volta, evento). Isso também resolve o tempo offline.
3. **Ações são comandos.** `POST /game/actions` com `{ tipo, dados, idempotencyKey, revEsperada }`: construir, melhorar, contratar, melhorar arma, partir em expedição, comprar relíquia, ascender, clique. O servidor liquida, valida custo, vagas, requisitos e aplica, ou recusa.
4. **Sorteios só no servidor.** O resultado de uma expedição e os eventos são sorteados no servidor (semente guardada) no momento da partida ou do evento. O cliente apenas exibe.
5. **Cliente prediz, servidor confirma.** O cliente roda o mesmo `game-core` para a tela ficar fluida e reconcilia com o estado devolvido pelo servidor. Se divergir, vale o servidor.
6. **Cliques.** Limite de taxa por usuário (valor inicial 10 por segundo, ajustável em dados) e o servidor aplica o ganho; o cliente envia lotes (`cliques: n`) e o servidor limita ao que o tempo permite.
7. **Ranking** lê só o estado do servidor, atualizado nos marcos (ascensão, era, ciclo). Nada do que o cliente envia entra direto no ranking.
8. **Segurança:** senhas com `bcrypt`, sessão em cookie `httpOnly` com `SameSite=Lax`, rotas protegidas, `helmet`, limite de taxa nas rotas de login, validação com Zod em toda entrada. O Next faz proxy de `/api` para o Express (mesma origem, sem CORS aberto).

## Banco (esboço do Prisma, a aprovar no Portão 2)

- `User`: id, email, nome, hash de senha (nulo se só OAuth), avatarUrl, criadoEm.
- `OAuthAccount`: userId, provedor (`google` ou `discord`), providerAccountId, único por par.
- `Session`: userId, tokenHash, expiraEm.
- `GameState`: userId (único), `rev`, `atualizadoEm`, `estado` (jsonb, esquema versionado), `versaoEsquema`.
- `ActionLog`: userId, idempotencyKey (único por usuário), tipo, resultado, criadoEm.
- `RankingEntry`: userId, era, ciclo, reliquias, tempoJogado, atualizadoEm, com índices para ordenação.

## Decisões do Portão 0

- **Pesquisa (decidida).** Faz parte do jogo. Não é aba: abre como painel ao clicar no Scriptorium no mapa (desktop: `Modal Pesquisa - Desktop`; mobile: `Modal Pesquisa - Mobile`, painel que sobe de baixo). Gasta Saber, uma pesquisa por vez, com tempo. Pesquisas da Era I: Hospitalidade (+1 vaga na guilda por taverna), Cartografia (abre Mina e Pântano), Colheita Farta (+10% de comida), Estradas Reais (abre a Cripta, requer Cartografia), Carta Real (objetivo da Era I, requer Estradas Reais). Estados do card: concluída, em andamento (barra e tempo), disponível (botão Pesquisar), bloqueada (mostra o requisito).
- **Clique (decidido).** O jogador clica em objetos do mapa (árvores, pedras e construções produtoras) e recebe o recurso daquele objeto. Regras de implementação na seção seguinte.
- **E-mail.** Sem domínio próprio por enquanto: cadastro por e-mail e senha funciona sem verificação (campo `emailVerificado` já existe e fica `false`; Google e Discord já chegam verificados). Em desenvolvimento, serviço `mailpit` no Compose para ver e-mails localmente. Provedor transacional e recuperação de senha entram quando houver domínio.
- **Fórmulas:** valem as de v0 abaixo, a ajustar depois dos primeiros testes.

## Decisões do Portão 0, rev 2 (resposta ao relatório do Claude Code)

Portão 0 aprovado com estas decisões. Tudo que é número vai em `packages/game-core/data/`, nada fixo em lógica. Onde algum documento ou frame do Figma discordar desta seção, vale esta seção.

### Conflitos resolvidos

| # | Decisão |
|---|---|
| A1 | **Slot tem tipo fixo** (spec seção 5). O Modal Construir, em slot vazio, mostra só a construção daquele slot (nome, efeito, custo e tempo do nível 1) com o botão Construir. O Figma lista os 10 tipos; ele será ajustado se necessário no Portão 13. **Atualizado pela A12:** o slot continua com tipo fixo, mas a construção se faz pelo catálogo. |
| A2 | Casa dá **+4 aldeões por nível**, nível máximo das construções = 10. O objetivo de 40 aldeões = Casa no nível 10. O teto de armazenamento passa a crescer exponencial (ver fórmulas), para o custo da Casa 10 caber. |
| A3 | A Cripta **não é Era II**. Fica bloqueada até concluir a pesquisa Estradas Reais (Era I). O texto "Requer a Era II" do Figma está errado; usar "Requer Estradas Reais". A névoa da Cripta sai quando a pesquisa termina. |
| A4 | Mina e Pântano começam **bloqueados** (pin com cadeado, sem névoa) até Cartografia. A spec foi corrigida. |
| A5 | Celeiro **só guarda comida**. Quem produz comida são os Fazendeiros (ver Aldeões). |
| A6 | Vila mobile (2x) é uma **exceção declarada**: aldeões desenhados a 32 de tela (pixel inteiro, metade da escala de mundo). Aprovado pelo dono no design. No Mapa desktop (2x) continuam escondidos (aparecem a partir do zoom 3, como na Vila desktop). **Aventureiros parados não são desenhados no mapa** (decisão do Portão 8); só o grupo em marcha, como marcador. |
| A7 | **Lápide = 12** (valor aprovado no Figma; o 24 da spec era antigo). Corrigido na spec. |
| A8 | Componentes de interface pertencem ao **Portão 11**. |
| A9 | Só Lucide React (além dos sprites). |
| A10 | Healthcheck nos **4 serviços** do Compose. São **6 modais**. |
| A11 | `GameState.versaoEsquema` é a referência. `estado.versao` é espelho e o Zod recusa se divergir. |
| A12 | **Construir por catálogo (rev 3, substitui a parte de interação da A1).** O jogador não precisa achar o terreno no mapa. Um botão **Construir** no HUD abre o **Catálogo de construções** (modal no desktop, folha de baixo no mobile): uma linha por **slot** (11 linhas; a segunda Serraria aparece como "Serraria II"), com o sprite, o custo e o estado. O slot continua com tipo fixo (A1), então o comando segue `construir { slotId }`, sem mudança de contrato. Detalhes na seção "Catálogo de construções". |
| A13 | **Mapa grande fixo e pré-renderizado (substitui o mundo por semente).** O mapa do jogo passa a ser **uma imagem fixa** (`mapa_base.png`, 3072 x 2304 de mundo, 96 x 72 tiles) mais um `mapa_meta.json` com as coordenadas. Não há gerador, semente por jogador nem sorteio de mundo na ascensão. O Portão 7b (gerador) fica **cancelado**; o que já tiver sido entregue dele é reaproveitado só se servir ao novo portão (ver Portão 7c). Os 5 destinos de expedição (Floresta dos Lobos, Ruínas, Mina, Pântano, Cripta) são pontos do mapa; os outros 4 pontos (Acampamento, Menires, Aldeia, Torre Velha) são decorativos na v0, reservados para eras futuras. Detalhes em `CRONARCA_MAPA_GRANDE.md`. |

### Economia v0

**Estado inicial do ciclo** (também o estado após ascender, somado ao bônus de Legado):
- Recursos: madeira 100, pedra 50, comida 80, ferro 15, ouro 40, saber 0.
- Construções prontas, nível 1: `casa_1`, `armazem_1`, `celeiro_1`, `serraria_1`. Demais slots vazios.
- Aldeões: 2 (um Fazendeiro, um Lenhador). Aventureiros: 1 (Guerreiro nível 1, nome sorteado de uma lista fixa). Guilda: 4 vagas.

**Produção por nível, por segundo** (base): Serraria 1,0 madeira; Pedreira 0,8 pedra; Forja 0,15 ferro; Scriptorium 0,12 saber; Mercado 0,04 ouro. Duas serrarias somam. Armazém, Celeiro, Casa, Taverna e Muralha não produzem.

**Aldeões.**
- Chegada: 1 aldeão a cada 20 s, de graça, enquanto houver vaga (`4 × soma dos níveis das casas`) e comida > 0.
- Ofícios (Portão 17): Fazendeiro, Lenhador, Mineiro, Sábio, Ferreiro e **Ocioso** (não produz, mas come). Números em `packages/game-core/data/aldeoes.ts`.
- Distribuição automática (`estado.aldeoesConfig = { automatica, politica, proporcao? }`, esquema 6): ligada, quem chega vai para o ofício de menor `quantidade / peso` da política, desempate pela ordem dos ofícios, contando quem está a caminho. Políticas prontas: Equilibrada 1/1/1/1/1, Comida primeiro 3/1/1/1/1, Construção 1/2/2/0/0, Pesquisa 1/1/0/3/0, Ferro 1/0/1/0/3 (fazendeiro/lenhador/mineiro/sábio/ferreiro). Numa conta nova a Equilibrada dá a mesma ordem do antigo rodízio. Desligada, quem chega é Ocioso. Começa ligada na Equilibrada (conta nova, cada ciclo e saves do esquema 5).
- Ajuste manual (`alocar_aldeoes { de, para, quantidade }`, validado no servidor e previsto no cliente): "+" tira do Ocioso, "−" manda para o Ocioso. Ir para Ocioso é na hora; para um ofício, o aldeão leva 10 s (`ativoEm`) e só então produz. Depois de um ajuste a Automática continua como estava e a política vira **Manter proporção atual** (a distribuição dos ofícios produtivos naquele momento; toda zerada, vale a Equilibrada). Escolher uma política pronta (`configurar_aldeoes`) substitui isso. Ajustes não escrevem na Crônica.
- Sem vagas por construção: o limite continua `4 × níveis das casas` (40 alcançável).
- Efeito: Fazendeiro produz 0,35 comida/s. Lenhador, Mineiro, Sábio e Ferreiro dão +5% cada na produção de madeira, pedra, saber e ferro, respectivamente (o Mineiro vale para pedra e o Ferreiro para ferro).
- Consumo de comida: conforme a tabela de fórmulas.
- Cada chegada escreve uma linha na Crônica ("Um lenhador chegou à vila.").
- Interface: cartão **Aldeões** no topo do painel da Vila (e na Vila do celular): "N de M", como chegam, a situação (próximo em X s, Casas cheias ou sem comida), os cinco ofícios e o Ocioso com quantidade, efeito de agora (ou o que falta para render, ex.: "+5% de pedra quando houver Pedreira"), "N a caminho" e os botões − e + (44 px no celular); embaixo, a chave Automática e a política dos novos aldeões. Desligada, o aviso "Aldeões novos chegam ociosos". O Ocioso ainda não aparece no mapa (fica para o portão dos aldeões no mapa).

**Comida zerada.** Ninguém morre. Os bônus dos ofícios param e expedições não podem partir. Construções continuam produzindo. **Com vaga nas Casas, o próximo aldeão chega como Fazendeiro**, mesmo com a Automática desligada, se a comida estiver abaixo de 20 (`COMIDA_MINIMA_ALDEAO`) ou se o saldo de comida por segundo ficaria negativo com ele (contando como produzindo quem está a caminho para Fazendeiro). Portão 18a; a política volta quando a comida sobe. O cartão avisa "Próximo em X s, como Fazendeiro (comida curta)": a vila não fica presa sem comida, porque melhorar a Casa sempre traz quem produz. A tela avisa em texto: chip de comida em alerta, aviso na aba Expedições ("Sem comida: … Pesquise Colheita Farta ou melhore a Casa") e, no Contratar, o saldo de comida de agora e o de depois (em vermelho se ficar negativo).

**Pesquisa.** Abre pelo botão Pesquisa no HUD (desktop e topo do celular, com selo das que dá para começar), pelo chip de Saber e pelo Scriptorium no mapa.

**Expedição.** O botão "Enviar" já traz o grupo (quem está na vila, do mais forte, até 3); pela aba direto o grupo começa vazio. O motivo de não partir aparece em texto acima dos destinos; o retrato ferido mostra quanto falta; a recusa do servidor diz o motivo (`lib/jogo/recusas.ts`).

**Teto** vale para os 6 recursos. Produção que passaria do teto é descartada. O recurso que chega de saque ou evento também é cortado no teto. **Piso do Legado (Portão 18a):** o teto de cada recurso é o maior entre o do Armazém (ou Celeiro) e o estoque inicial com Legado (`pisoDoTeto`), então o Legado rende o que promete sem nada passar do teto. Sem Legado, o piso fica abaixo de 300 e nada muda; com Legado 8, madeira 580 e comida 400 até o Armazém/Celeiro 3. O Melhorar mostra o teto efetivo ("Guarda 300 (madeira 580)"). Conferir: `make conferir-teto`.

**Obras.** Uma obra por slot, sem limite global. Nível máximo de toda construção: 10.

**Ouro.** Entra por saque, pelo Mercado (passivo, 0,04/s por nível) e pelo evento Mercador Viajante. Não há ação de vender na v0. O Mercado nível 1 **não pede ouro**: a conta nova tem só 40 de ouro, que pagam a 1ª contratação, e o Mercado é a única fonte passiva de ouro (auditoria dos aldeões, opção c2).

**Pesquisas da Era I** (uma por vez):

| Pesquisa | Custo | Tempo | Efeito |
|---|---|---|---|
| Hospitalidade | 40 saber | 1:00 | +1 vaga na guilda por Taverna |
| Cartografia | 60 saber | 1:30 | abre Mina e Pântano |
| Colheita Farta | 30 saber | 2:00 | +10% de comida |
| Estradas Reais | 150 saber, 40 ouro | 2:00 | abre a Cripta; requer Cartografia |
| Carta Real | 300 saber, 80 ouro | 3:00 | objetivo da Era I; requer Estradas Reais |

**Expedições.**

| Destino | Perigo | Duração | Saque (faixa por recurso) |
|---|---|---|---|
| Floresta dos Lobos | 9 | 0:30 | madeira 25–45, comida 20–40, ferro 4–9, ouro 0,4–1 |
| Ruínas Esquecidas | 20 | 0:55 | pedra 10–20, ferro 4–10, ouro 9–20, saber 1–2,2 |
| Mina Abandonada | 30 | 2:00 | pedra 30–60, ferro 8–16, ouro 2–5 |
| Pântano Sombrio | 48 | 3:00 | comida 20–40, saber 3–6, ouro 6–14, ferro 4–10 |
| Cripta do Rei Cinzento | 70 | 5:00 | ouro 30–60, saber 8–15, ferro 10–20 |

As durações do Figma (6:00, 8:30, 12:00) são ilustrativas; valem as desta tabela.

**Aventureiros.** Classes são só visuais (sem diferença mecânica na v0). Nível inicial 1, ou `1 + nível de Linhagem Heroica`. XP: vitória dá 2, recuo dá 1; subir de nível n para n+1 custa `4 × n` XP; nível máximo 20. Arma e armadura vão de 0 a 6 (6 melhorias cada). Custo base de melhoria: arma 12 ferro e 15 ouro; armadura 10 ferro e 12 ouro, multiplicado por `(n + 1)` com n = nível atual.

**Bônus.** Dentro da mesma categoria os percentuais somam; entre categorias, multiplicam. Categorias: produção geral (Bênção da Colheita), comida (Colheita Farta), saber (Sabedoria Ancestral), clique (Mãos Calejadas), velocidade de expedição (Caminhos Eternos: duração × `(1 − 0,06 × nível)`).

**Eventos.** Um evento a cada 10 a 20 min (sorteio no servidor, vale também offline). Efeitos instantâneos, uma linha na Crônica:

| Evento | Efeito |
|---|---|
| Mercador Viajante | única escolha do jogo: **Aceitar troca** (100 madeira por 15 ouro, exige ter a madeira) ou **Recusar**. Sem resposta em 120 s vale Recusar; offline vale Recusar. Os termos vão no evento (`estado.mercador = { expiraEm, paga, recebe }`, esquema 5): o popup mostra o que se recebe, o que se paga (em vermelho se faltar, com Aceitar desativado), o prazo e a nota "Se recusar ou o tempo acabar, o Mercador segue viagem e nada muda"; a resposta cobra e paga exatamente esses termos. Para conferir: `make evento-mercador` (só dev) e `make conferir-mercador` |
| Bandidos na Estrada | com Muralha nível 1 ou mais, repelidos sem perda; sem Muralha, perde 15% de ouro e de comida |
| Tempestade | +30 madeira ou 10% do teto de madeira, o maior (Portão 18a) |
| Festival da Colheita | +40 comida ou 10% do teto de comida, o maior |
| Incêndio | perde 10% da madeira (Muralha não protege) |
| Cometa | +20 saber ou 3% do teto de saber, o maior (o saber só serve às pesquisas). Perdas (Bandidos, Incêndio) não crescem: eventos acontecem offline |

**Clique.** Árvores e pedras são infinitas. O catálogo de objetos clicáveis (id estável, recurso, hitbox) fica nos dados do mapa, não no estado. Limite por objeto: 5 cliques/s, além do limite de 10/s por usuário, ambos como balde de fichas guardado no estado com o relógio do servidor.

**Offline.** Sem teto de tempo offline (o armazenamento já limita o ganho).

**Ranking** (decidido no Portão 15): ordem por era desc, ciclo desc, relíquias totais desc (as gastas contam), desempate por quem chegou primeiro à posição (`marcoEm`).

- Todo reino entra, desde o ciclo 1 com 0 relíquias; a entrada nasce com o estado. Apagar progresso devolve a entrada ao início (ciclo 1, 0 relíquias, tempo 0).
- A entrada só muda nos marcos (era, ciclo ou relíquias mudaram numa ação aplicada), na mesma transação da ação, a partir do estado do servidor.
- `tempoJogado` = soma dos intervalos entre requisições autenticadas de jogo (`/game/state` e `/game/actions`) de até 5 min (`RANKING.janelaAtividadeMs`); acumula em `GameState.tempoJogado` e vai à entrada no marco.
- `GET /ranking?aba=geral|era`, só logado: os 50 primeiros (`RANKING.tamanhoLista`) e a linha do jogador com a posição real. A aba Era filtra pela era do jogador; Amigos fica desativada ("Em breve").
- Nome público = primeiro nome + inicial do último sobrenome ("Marcos V."); e-mail, id e nome completo de outros jogadores não saem do servidor.

### Riscos técnicos: aprovação dos planos

Os três planos do relatório estão aprovados, com um acréscimo: **a simulação usa inteiros** (recursos e taxas em milésimos, tempo em ms), sem ponto flutuante, para cliente e servidor nunca divergirem. O teste do Portão 4 inclui o caso "obra termina e comida zera no mesmo intervalo", e o caso "mesmo estado liquidado em um passo ou em muitos passos dá o mesmo resultado".

## Interação com o mapa (clique)

Para o clique nunca "pegar fora" nem "falhar dentro":

1. **Teste de acerto em coordenadas de mundo**, não em elementos da página. Converter o ponto do mouse ou toque para mundo com a mesma função usada para desenhar (considerando zoom, câmera, `devicePixelRatio` e a escala CSS do canvas).
2. **Hitbox por objeto, em arquivo de dados**, no mesmo lugar da tabela de escala: retângulo no espaço do sprite, ajustado ao corpo visível (copa da árvore, não o canvas inteiro), com tamanho mínimo de 44 px de tela para toque.
3. **Objeto da frente vence.** Testar do último desenhado para o primeiro (ordem inversa da ordenação por Y) e parar no primeiro acerto.
4. **Arrastar não é clicar.** Se o ponteiro se mover mais de 6 px entre pressionar e soltar, é pan e não gera clique.
5. **Só objetos clicáveis entram no teste.** Cada objeto declara `clicavel` e o recurso que rende; o resto do cenário é ignorado.
6. **Cliente só envia o id do objeto**, nunca coordenadas nem quantidade. O servidor valida que o objeto existe no estado do jogador, aplica o ganho e a taxa limite por usuário e por objeto.
7. **Retorno visual imediato:** realce do contorno ao passar o mouse, cursor de mão e pequena tremida do objeto. Ao clicar, sobe do ponto do clique o **ícone do recurso (sprite `Sprite/Icone`, 16 px a 2x) com o "+N" ao lado**, que flutua cerca de 32 px para cima em uns 600 ms e some (GSAP, numa camada HTML por cima do canvas). O chip do recurso no HUD dá um pulso curto e o número sobe até o novo valor. Cliques rápidos reutilizam elementos de um pool e somam o "+N" em vez de empilhar dezenas de textos. Se o servidor recusar, o valor previsto é desfeito e o "+N" some.
8. **Modo de depuração:** atalho que desenha as hitboxes por cima do mapa, para ajustar no olho.
9. **Testes automáticos:** teste unitário do teste de acerto com pontos dentro, na borda e fora de cada objeto, e com objetos sobrepostos.

## Catálogo de construções (rev 3, Portão 13)

Hoje o jogador teria de procurar no mapa o terreno vazio para construir. O padrão do gênero é um menu, então a construção passa a ser feita por um catálogo. Frames de referência no Figma (Telas v2): `Construir - Desktop (Catalogo)` e `Construir - Mobile (Catalogo)`.

**Entrada.** Botão **Construir** no HUD (ícone Lucide `Hammer`) com selo numérico quando há slots vazios que o jogador já pode pagar. O selo some quando ele abre o catálogo. No mobile é um botão flutuante sobre o mapa, acima das abas, e não uma aba nova.

**Conteúdo.** Uma linha por slot do núcleo (spec do mapa, seção 5), na ordem: construíveis primeiro, depois construídas. Cada linha mostra sprite 48 (animado, ver seção Sprites), nome, e um dos estados:

| Estado | Quando | Mostra | Ação |
|---|---|---|---|
| Construível | slot vazio, recursos suficientes | custo com ícones | botão dourado **Construir** |
| Sem recursos | slot vazio, falta algum recurso | custo, com o recurso que falta em vermelho | botão cinza desativado |
| Em obra | `obraAte` no futuro | barra e tempo restante | nenhuma |
| Construída | nível >= 1 | nível atual | botão escuro **Melhorar** (abre o Modal Melhorar) |
| Bloqueada | reservado para eras futuras | cadeado e o requisito | nenhuma |

Na v0 **nenhuma construção tem requisito**, então o estado Bloqueada existe no componente mas não aparece. Mina, Pântano e Cripta são destinos de expedição (A3 e A4), **não** entram no catálogo. Os 11 slots ficam no núcleo fixo, que nunca tem névoa, então não existe estado "zona na névoa". O mockup do Figma mostra a Casa e a Muralha como exemplos de Melhorar e Em obra.

**Filtro.** Chips **Todas** e **Disponíveis** (construíveis e com recursos). Só estado de tela, não vai ao servidor.

**Ao construir.** O cliente envia `construir { slotId }` como hoje. Com a confirmação do servidor: o catálogo fecha, a câmera do mapa anima (GSAP) até o slot, o slot ganha um contorno que pisca por cerca de 1,2 s e a obra aparece no mapa. Com `prefers-reduced-motion`, a câmera salta sem animar.

**No mapa.** O terreno vazio continua clicável, mas só o hit test do 9b muda de destino: `slotVazioClicado { slotId }` abre o catálogo já rolado até aquela linha, com ela realçada. Não aparece mais um modal Construir por slot. Slot construído continua abrindo o Modal Melhorar.

**Acessibilidade.** Foco preso no modal, `Esc` fecha, Enter confirma a linha focada, botão desativado com `aria-disabled` e o motivo em texto (não só cor).


## Fórmulas iniciais (v0, só ponto de partida)

O dono não tem fórmulas prontas. Estas valem até a primeira rodada de testes e ficam em `packages/game-core/data/formulas.ts`, trocáveis sem mexer em lógica. Os números das telas do Figma são ilustrativos e serão trocados pelos resultados destas fórmulas.

| Item | Fórmula |
|---|---|
| Custo de construir ou melhorar (nível n) | `round(custoBase × 1,55^(n−1))`; a Muralha usa 1,50 (`fatorCusto` próprio, portão Custo x capacidade) |
| Tempo de obra (nível n) | `30 s × 1,4^(n−1)` |
| Produção por segundo | `base × n`, base por construção na seção "Economia v0" |
| Teto de recurso | `round(300 × 1,55^(nível−1))`, nível do Armazém para os 5 recursos e do Celeiro para comida (mínimo nível 1). Mesmo fator do custo: todo `custoBase` ≤ 300 por recurso cabe em todos os níveis. Regra testada em `game-core/test/capacidade.test.ts`: nenhum gasto (construção em todo nível, contratação até lotar a guilda, pesquisa, equipamento, Mercador) passa da capacidade alcançável |
| Aldeões máximos | `4 × soma dos níveis das casas` |
| Consumo de comida | `0,05/s por aldeão` e `0,08/s por aventureiro` |
| Poder do aventureiro | `5 + 4 × nível + 3 × arma + 2 × armadura` |
| Chance de êxito | `clamp(0,5 + 0,02 × (poderGrupo − 1,5 × perigo), 0,05, 0,98)` |
| Saque | sorteio uniforme na faixa do destino, `× (1 + 0,1 × (aventureiros − 1))` |
| Derrota | o grupo recua sem saque e cada aventureiro tem 25% de ficar ferido por 60 s |
| Custo de melhorar arma ou armadura (n = nível atual, 0 a 5) | `round(custoBase × (n + 1))`, bases na seção "Economia v0"; todo custo usa `round` (meio para cima) |
| Custo de contratar | `40 × 1,58^(aventureiros contratados)` de ouro e `20` de comida (era 1,6: a 14ª contratação passava do Armazém 10) |
| Relíquias na ascensão | `3 + 2 × (ciclo − 1)` |
| Custo de relíquia (nível n) | `custoBase × (n + 1)` |
| Clique | `1 × (1 + 0,25 × nível de Mãos Calejadas)` do recurso do objeto, limitado por taxa |

## Dados do jogo

### Recursos (6)

Madeira, Pedra, Comida, Ferro, Ouro, Saber. Cada um tem quantidade, teto de armazenamento (`/300` na Era I) e taxa por segundo. O HUD mostra os 6 em chips com ícone.

### Construções (10, sprite 48)

Casa, Armazém, Celeiro, Serraria, Pedreira, Scriptorium, Forja, Mercado, Taverna, Muralha. Slots e coordenadas: ver spec do mapa seção 5, somando `ORIGEM_NUCLEO` (spec do mundo, seção 1). Cada slot guarda `{ id, tipo, nivel }`.

| Tipo | Efeito (texto do design) | Custo de exemplo |
|---|---|---|
| Casa | +4 aldeões por nível | 120 madeira, 60 pedra |
| Armazém | guarda mais recursos | 150 madeira, 100 pedra |
| Celeiro | só guarda comida (não produz) | 130 madeira, 50 pedra |
| Serraria | produz madeira | 210 madeira, 12 ferro |
| Pedreira | produz pedra | 180 madeira, 8 ferro |
| Scriptorium | produz saber | 160 madeira, 120 pedra |
| Forja | produz ferro | 200 pedra, 100 madeira |
| Mercado | troca recursos por ouro | 240 madeira (nível 1, sem ouro: `custoNivel1`); do nível 2 em diante, a fórmula com 240 madeira, 40 ouro |
| Taverna | abre vagas na guilda | 300 madeira, 60 ouro |
| Muralha | defende a vila de bandidos | 400 pedra, 40 ferro |

Melhorar: tempo de obra (ex.: 0:45), o slot fica ocupado, o efeito atual continua valendo até terminar.

### Aldeões

Ofícios com sprite: Lenhador, Mineiro, Ferreiro, Fazendeiro, Sábio, Sem função. Em campo: 96 na Vila desktop (3x), 32 no mobile (1x). Não aparecem no zoom do Mapa.

### Aventureiros e guilda

Classes com sprite: Guerreiro, Arqueiro, Mago, Ladino, Clérigo. Campos: nome, classe, nível, poder, estado (`na_vila`, `em_expedicao`, `ferido` com contagem), arma 0 a 6, armadura 0 a 6. Guilda: 4 vagas na Era I, consomem comida. Contratar custa ouro e comida (exemplo: 43 ouro, 20 comida). Melhorar arma e armadura custa ferro e ouro (exemplo: arma 3 = 19 ferro, 29 ouro).

### Expedições (5 destinos, sprite 64)

| Destino | Perigo | Duração | Estado inicial | Requisito |
|---|---|---|---|---|
| Floresta dos Lobos | 9 | 0:30 | aberto | nenhum |
| Ruínas Esquecidas | 20 | 0:55 | aberto | nenhum |
| Mina Abandonada | 30 | 2:00 | bloqueado | Cartografia |
| Pântano Sombrio | 48 | 3:00 | bloqueado | Cartografia |
| Cripta do Rei Cinzento | 70 | 5:00 | bloqueado | Estradas Reais (ainda dentro da Era I) |

Grupo de até 3 aventureiros. Mostra poder do grupo, chance de êxito e faixa de saque por recurso (ex.: Floresta: madeira 25–45, comida 20–40, ferro 4–9, ouro 0,4–1). Resultados: vitória (saque), recuou (sem saque), aventureiro ferido. Relatório e entrada na Crônica ao terminar. Pins e trilhas no Mapa: spec seção 6.

### Eras e ascensão

Era I Aldeia, II Reino, III Arcana, IV Dimensões (só a I está jogável). Objetivos da Era I: pesquisar a Carta Real, vencer a Cripta do Rei Cinzento, reunir 40 aldeões. Ascender reinicia vila, aldeões e pesquisas e mantém relíquias, níveis delas e registro do ciclo. Cada ascensão dá relíquias (exemplo: +3). Botão desativado até cumprir todos os objetivos.

### Relíquias (moeda de ascensão, 6 tipos)

| Nome | Nível máx. | Efeito por nível | Custo (relíquias) |
|---|---|---|---|
| Mãos Calejadas | 10 | +25% de força por clique | 3 |
| Bênção da Colheita | 10 | +10% de toda a produção | 5 |
| Legado | 8 | cada ciclo começa com 60 madeira, 30 pedra, 40 comida | 3 |
| Caminhos Eternos | 5 | expedições 6% mais rápidas | 6 |
| Sabedoria Ancestral | 8 | +15% de saber | 5 |
| Linhagem Heroica | 5 | novos aventureiros chegam um nível acima | 8 |

### Eventos (aparecem na Crônica e no popup da Vila)

Mercador Viajante, Bandidos na Estrada, Tempestade, Festival da Colheita, Incêndio, Cometa. Cada um com efeito curto (ex.: tempestade dá +30 de madeira) e linha na Crônica com horário.

## Marca (portão Logo e ícone)

Selo do relógio (selo redondo de pedra, C dourado, ponteiros no vazio da letra) e o nome "CRONARCA" em pixel art dourado. **O nome é imagem, nunca texto.** Toda ampliação é por múltiplo inteiro, com `image-rendering: pixelated` (o 16 px tem arquivo próprio, desenhado à mão). Constantes em `apps/frontend/lib/marca.ts`; arquivos em `apps/frontend/public/marca/`; fontes vetoriais em `docs/referencia/marca/`.

| Onde | O quê |
|---|---|
| Aba do navegador | `icone-16.png` e `icone-32.png` declarados com o tamanho real; `/favicon.ico` (16 + 32) para quem pede direto |
| iPhone / Android | `apple-touch-180.png` (opaco); manifest (`app/manifest.ts`) com `android-192.png` (opaco) e `icone-512.png`; `theme-color` `#14201c` |
| Início e Login | `logo-completa.png` (546 x 192, a 6x) no palco 1440 x 900: 6 px do palco por pixel da arte = `--u` px de tela. Início: logo em `top: 24`, subtítulo e ornamentos 32 px abaixo de antes. Login: logo em (48, 24), lema em `top: 228` |
| Carregamento | selo `icone-128.png` (4x) no lugar da fogueira e `nome-cronarca.png` a 4x (224 x 40) |
| HUD | selo `icone-64.png`: 64 px no desktop, 32 no topo compacto e no celular |
| Compartilhamento | título "%s · Cronarca", descrição curta, Open Graph/Twitter `summary` com o selo 512 |

Pendências: imagem Open Graph própria (1200 x 630) e ícone "maskable" para Android.

## Sprites (component sets na página Sprites)

| Set | Variantes | Canvas |
|---|---|---|
| Recurso | 6 recursos x 4 quadros | 32 |
| Icone | 21 ícones | 16 |
| Aldeao | 6 ofícios x 4 quadros (inclui o ocioso, sem uso na v0) | 32 |
| Aventureiro | 5 classes x 6 quadros | 32 |
| Construcao | casa, serraria, pedreira, scriptorium, taverna, mercado, forja x 4 quadros; muralha, armazém, celeiro x 2 quadros | 48 |
| Expedicao | 5 destinos x 4 quadros | 64 |
| Evento | 6 eventos x 6 quadros | 64 |
| Cenario | pinheiro, carvalho, arbusto, pedra, toco, flores, cerca, poço, fogueira, placa | 16 a 48 |
| Montanha, Estrada, Rio | 5 variantes por peça | 48 / 32 / 32 |
| Terreno | grama, pântano, cripta, bordas e cantos do pântano | 32 |
| Nevoa | cheia, borda, canto | 32 |
| Ponte | 5 variantes (ainda sem uso) | 32 |
| Objetos Terreno | árvore morta 48, lápide 12, juncos 16 | 12 a 48 |
| Futuro | castelo, torre arcana, portal, cavaleiro, cristal x 4 quadros | 32 e 48 |

Escala e tamanhos exatos: spec seção 2.

**Animação (Portão 14b).** A fonte da verdade é `packages/game-core/data/quadros.json`: `{ grupo: { nome: { quadros, duracoesMs[], tamanho, arquivos[] } } }`, com 47 sprites e 202 PNGs em `apps/frontend/public/sprites/<grupo>/<nome>_<k>.png` (k a partir de 1). O código não tem contagem de quadros nem duração escrita à mão: trocar o JSON muda o jogo.

- Cada sprite tem de 2 a 6 quadros e uma duração por quadro (ex.: aldeões com a batida mais rápida no impacto, aventureiros com 6 quadros de 100 ms). Cerca e flores do núcleo seguem com 2 quadros de 450 ms, também no JSON.
- O quadro atual é o que cobre `t % soma(duracoesMs)` no relógio global. Cada instância tem um deslocamento de fase derivado do id, para dois iguais lado a lado não andarem juntos.
- Um único loop (`requestAnimationFrame`) por superfície: o do canvas do mapa e um global para as telas. Nada de timer por sprite.
- Com `prefers-reduced-motion` ou com a preferência "Animações dos sprites" desligada, tudo fica no quadro 1.
- Hitboxes, máscaras de acerto e o pé da sombra (L3b) usam sempre o quadro 1: os quadros têm o mesmo tamanho e o pé no mesmo ponto (o impacto do lenhador e do mineiro desce 1 px e não mexe a sombra). Os sprites não trazem sombra embutida; a sombra é a da L3b.
- Todos os quadros são pré-carregados atrás da tela de carregamento.
- Ids do jogo com outro nome no JSON (sem renomear arquivos): `floresta_lobos` = `floresta`, `festival_colheita` = `festival`.
- Sem tela na v0 (ficam no catálogo, pré-carregados): recursos de 32 (o HUD usa os ícones de 16), os eventos além do Mercador, o aldeão ocioso e o cristal.
- **Cena do Início e do Login** (portão Início/Login no celular): `packages/game-core/data/quadros_cena.json` (grupo `cena`, 14 sprites, 58 PNGs em `public/sprites/cena/`), fora do pré-carregamento de `/jogo`. Castelo, cavaleiro, fogueira e placa usam o `SpriteAnimado` (mesmo desenho e mesmo quadro dos SVGs antigos, mesma posição; fase pelo id da instância); os quadros pedem pré-carga com o navegador ocioso. Pinheiro, arbusto, flores e cerca seguem com os dois SVGs em CSS: os quadros novos são de outro desenho (pinho de 48 px, 7 arbustos, flores de 16) e ficam no catálogo para uso futuro (pedido ao artista: pinheiro de 32 px). Estrelas e lua são parte do fundo, paradas.
- **Início e Login no celular**: abaixo de 900 px de largura ou 500 de altura (`CONSULTA_CENA_CELULAR`), coluna única que rola na vertical, com arte em escala inteira: fundo a 2x (4x acima de 480 px de largura) com o castelo no horizonte, pinheiros cortados pelas bordas e a fileira cavaleiro, fogueira e arbusto (Início); logo compacta e castelo atrás do cartão (Login). Teclado: `interactiveWidget: 'resizes-content'` e `lib/cena/teclado.ts` (`--altura-visivel`, `html[data-teclado]`). Conferência: `make conferir-inicio`.
- Cenário de terreno, pedras, arbustos e objetos de terreno estão na imagem do mapa (estáticos). As árvores do mapa balançam (Portão 14c): quadros e durações no `balanco` do `mapa_meta.json`, não no `quadros.json`, e parado fica o quadro de repouso (2), não o 1. Ver `CRONARCA_MAPA_GRANDE.md`, seção 3b.

Pendência de arte: aldeões e aventureiros em 32 de tela sobre canvas de 32 estão corretos (1x). Em tamanho menor que isso seria preciso redesenhar em 16.

## Estado salvo (jsonb em `GameState.estado`)

Esquema proposto, a aprovar no Portão 2 e implementado no Portão 4:

```json
{
  "versao": 2,
  "era": 1, "ciclo": 1,
  "mundo": { "versaoMapa": 1 },
  "recursos": { "madeira": 0, "pedra": 0, "comida": 0, "ferro": 0, "ouro": 0, "saber": 0 },
  "slots": { "casa_1": { "tipo": "Casa", "nivel": 3, "obraAte": null } },
  "aldeoes": [{ "oficio": "Lenhador" }],
  "aventureiros": [{ "nome": "Aldric", "classe": "Guerreiro", "nivel": 4, "arma": 3, "armadura": 2, "estado": "na_vila", "feridoAte": null }],
  "expedicoes": [{ "destino": "floresta_lobos", "grupo": ["Brenna"], "fim": 0, "semente": 0, "resultado": null }],
  "reliquias": { "total": 7, "gastas": 0, "niveis": { "maos_calejadas": 1 } },
  "cronica": [{ "icone": "Check", "texto": "", "em": 0 }]
}
```

Configurações de som e animação são do jogador, não do jogo: ficam em preferências do usuário (e cache local). Exportar e importar save deixam de ser botões de jogo: ou saem das Configurações, ou viram "baixar cópia" somente leitura. Decidir no Portão 13.

## Portões de aprovação

Cada portão exige aprovação humana explícita antes de seguir.

| # | Portão | Entrega | Referência |
|---|---|---|---|
| 0 | Decisões do Portão 0 | APROVADO (rev 2): decisões na seção "Decisões do Portão 0, rev 2" | este documento |
| 1 | Infra | monorepo, Docker Compose, Makefile, `.env.example`, `make up` subindo os 4 serviços (db, backend, frontend, mailpit) com healthcheck | seção Stack |
| 2 | Banco | schema Prisma, migrações, seed | seção Banco |
| 3 | Autenticação | e-mail e senha, Google, Discord, sessão, rotas protegidas, avatar no Cloudinary, telas `Inicio` e `Login` | frames Inicio e Login |
| 4 | `game-core` | dados do jogo em arquivos, simulação determinística com liquidação por tempo, testes | seção Dados e Arquitetura |
| 5 | API de jogo | estado, ações, idempotência, `rev`, limite de cliques, sorteios no servidor, testes | seção Arquitetura |
| 6 | Câmera e grade | canvas com viewport, zoom inteiro, conversão mundo-tela, pan limitado, grade | spec 1 |
| 7 | Terreno | L0 a L3: tiles, variantes determinísticas, rotações, zonas (já entregue; os dados fixos serão trocados pelo gerador no 7b) | spec do mapa 3, 4, 4b |
| 7b | ~~Mundo por semente~~ (cancelado pela A13) | `gerarMundo` no `game-core` com testes, transições de terreno (L0b), estradas e rio variados, mundo 36 x 28, galeria de 12 sementes para aprovação visual, `estado.mundo` | `CRONARCA_MUNDO_SPEC.md` |
| 7c | Mapa grande fixo | carregar `mapa_base.png` e `mapa_meta.json`, câmera com arraste e zoom inteiro sobre mundo 3072 x 2304, limites, minimapa opcional, núcleo e destinos lidos do meta, teste de carga em 1x a 4x | `CRONARCA_MAPA_GRANDE.md`; prompt `PROMPT_PORTAO_7C_MAPA_GRANDE.md` |
| 8 | Objetos | L4 só para o que **não** está na imagem: construções do núcleo, aldeões, aventureiros; ordenação por Y e tabela de escala numa constante única | spec do mapa 2, 5; mundo spec 3 (passo 7) |
| 9 | Marcadores e névoa | L5 a L7 lendo slots e destinos do `mapa_meta.json` e o estado | `CRONARCA_MAPA_GRANDE.md` |
| 9b | Interação com o mapa | teste de acerto, hitboxes em dados, depuração, testes | seção Interação com o mapa |
| 10 | Cliente e sincronização | SWR para ler o estado, ações com predição e reconciliação, tela de carregamento | seção Arquitetura |
| 11 | Casca da interface | HUD, abas, Crônica, painéis, botões, chips, etiquetas, GSAP nas transições | `Vila - Desktop` |
| 12 | Telas | Heróis, Expedições e Eras ligadas à API | frames desktop |
| 13 | Modais | **Catálogo de construções (A12)**, Melhorar, Ascensão, Pesquisa, Configurações; botão Construir no HUD | seção Catálogo de construções; frames de modal |
| 14 | Mobile | layout a 390 px, abas no rodapé, mapa em 2x, modais como painéis de baixo | frames mobile |
| 14b | Animação com mais quadros | sprites de 2 a 6 quadros com durações por quadro lidas do `quadros.json`, fase por instância, relógio único, pré-carregamento, quadro 1 com movimento reduzido | seção Sprites |
| 14c | Árvores com vento | mapa v2 sem árvores, 1583 árvores na L4 com culling por grade, balanço de 4 quadros com fase por id, camada de frente, conferência contra a arte original | `CRONARCA_MAPA_GRANDE.md`, seção 3b |
| 15 | Ranking | tabela lida do servidor, atualização nos marcos | `Modal Ranking` |
| 17 | Alocação de ofícios dos aldeões | Ocioso, ajuste manual com deslocamento de 10 s, distribuição automática por política, "Manter proporção atual", esquema 6, cartão com − e + | seção Aldeões |

A A13 cancela o 7b: o mapa é uma imagem fixa (ver `CRONARCA_MAPA_GRANDE.md`, que prevalece sobre as seções 1, 4, 4b e 6 da spec do mapa e sobre o `CRONARCA_MUNDO_SPEC.md`, agora só histórico). Os portões 6 a 9 podem usar um estado de exemplo até o 5 estar pronto, mas o 10 só começa depois do 5.

## Componentes de interface (para o Portão 11)

- **Painel de pergaminho:** borda de 6 px `#3a261c`, fundo `#e8dcc0`, realce `#f4ecd4`, sombra `#c8b890`, linha interna `#b8a078`.
- **Card:** borda de 4 px `#8a6a48`, fundo `#f6efdc`, sombra `#e4d8b8`.
- **Botões:** dourado (`#d8a63f`, realce `#ffd060`, sombra `#a07820`, texto `#2a1c12`), escuro (`#4a3220`), cinza para desativado (`#b8a888`), vermelho para risco (`#a8342c`).
- **Fontes:** Alegreya SC Bold (títulos e rótulos), Alegreya Sans Regular (texto), IBM Plex Mono Medium (números).
- **Fundo da tela:** `#14201c` com texturas de 6 px. HUD: `#3a2818`, 72 px de altura no desktop e 56 no mobile.
- **Estados do aventureiro:** Na vila (verde `#4a8a52`), Em expedição (azul `#3a62a8`), Ferido (vermelho `#8a2420`).
