# Cronarca: especificação do mapa (escala, camadas e slots)

Documento de apoio para implementar o mapa a partir do Figma (arquivo "Cronarca - Telas", páginas "Telas v2" e "Sprites"). Tudo aqui sai dos frames `Mapa - Desktop` e `Vila - Desktop`.

**Atenção (rev 3):** o terreno, o rio, as estradas, as montanhas, as zonas, os destinos e a névoa deste documento descrevem o mapa autoral do Figma e viram **referência visual**. O mapa real passa a ser gerado por semente, conforme `CRONARCA_MUNDO_SPEC.md`, que prevalece nas seções 1 (grade), 4 (estradas e rio atuais), 4b e 6. Continuam valendo aqui: seção 2 (escala), 3 (camadas), regra de pixel, seção 5 (slots, somando a origem do núcleo) e 4c (mobile).

Regra de ouro: existe um único mundo. O Mapa (zoom 2x) e a Vila (zoom 3x) são duas câmeras sobre os mesmos objetos. Nada é posicionado em pixel de tela, só em coordenada de mundo.

## 1. Unidades e câmera

- Unidade de mundo = 1 pixel de sprite. Um tile de terreno = 32x32 de mundo.
- Zoom sempre inteiro (1x a 4x), `image-rendering: pixelated`.
- Zoom pela roda do mouse e, no toque, pela **pinça com dois dedos** (`apps/frontend/lib/mapa/pinca.ts`): cada abertura (ou fechamento) de 1,4x na distância entre os dedos sobe (ou desce) um nível inteiro, com folga para não oscilar; o centro do zoom é o ponto médio entre os dedos e mover os dois juntos arrasta. A janela do mapa tem `touch-action: none`, então a pinça do navegador não age sobre a página.
- Tela do jogo = 876x712 px de viewport (área "Cena da Vila").
- Conversão: `tela = (mundo - camera) * zoom + viewport / 2`.

| Visão | Zoom | Centro da câmera (mundo) | Área visível (mundo) |
|---|---|---|---|
| Mapa (Reino) | 2x | (219, 178) | 438 x 356 |
| Vila | 3x | (206,5; 236,3) | 292 x 237 |

Grade do mapa atual: 14 x 12 tiles (448 x 384 de mundo), origem em (0, 0) no canto superior esquerdo. O mapa cresce por era, então o código deve aceitar tamanho variável.

## 2. Tabela de escala (proporção entre tipos)

O tamanho de cada tipo no mundo é `canvas do sprite x multiplicador`. Essa tabela é a fonte da verdade; nenhuma instância deve ter tamanho avulso.

| Tipo | Canvas do sprite | Mundo | Mapa 2x | Vila 3x |
|---|---|---|---|---|
| Construções | 48 | 48 | 96 | 144 |
| Árvore (Pinheiro e Carvalho) | 48 | 48 | 96 | 144 |
| Arbusto | 32 | 32 | 64 | 96 |
| Pedra | 24 | 24 | 48 | 72 |
| Toco | 16 | 16 | 32 | 48 |
| Flores | 16 | 16 | 32 | 48 |
| Cerca | 16 | 16 | 32 | 48 |
| Poço, Fogueira, Placa | 32 | 32 | 64 | 96 |
| Montanha | 160 | 160 | 320 | 480 |
| Aldeão, Aventureiro | 32 | 32 | 64 | 96 (só aparece no zoom 3x; exceção no mobile, ver 4c) |
| Tiles de estrada, rio, terreno e névoa | 32 | 32 | 64 | 96 |
| Árvore Morta | 48 | 48 | 96 | 144 |
| Lápide | 12 | 12 | 24 | 36 |
| Juncos | 16 | 16 | 32 | 48 |

Regra de pixel: o tamanho no mundo é sempre igual ao canvas do sprite (multiplicador 1), então o pixel do sprite fica inteiro em 2x e 3x. Para mudar a proporção de um tipo, redesenha-se o sprite em outro canvas, nunca se estica o existente.

Sprites usados: `Pinheiro 48px`, `Carvalho 48px`, `Arbusto` (32px original), `Pedra 24px`, `Toco 16px`, `Flores 16px`, `Cerca 16px`. O `Arbusto 48px` ficou no Figma, sem uso, caso queira um arbusto maior depois. Os sprites antigos de Pedra, Toco, Flores e Cerca em 32px continuam na biblioteca, mas não entram mais nas telas.

Árvores: há duas espécies, Pinheiro e Carvalho (copa redonda, a primeira árvore que criamos). No mapa, 1 a cada 3 árvores é carvalho; o resto é pinheiro. Na implementação, sortear a espécie pela posição (determinístico), igual às variantes de tile.

Hierarquia de proporção (regra fixa, vale para todo sprite novo): altura visível no mundo, em px.

| Objeto | Altura |
|---|---|
| Flores, Cerca | 16 |
| Toco | 16 |
| Pedra | 24 |
| Arbusto | 32 |
| Aldeão, Aventureiro | 32 |
| Árvore, Construção | 48 |
| Montanha | 125 a 140 (mínimo de 2,5 vezes a árvore) |

Nenhum arbusto, pedra, planta ou árvore novo pode passar da altura da sua linha, e nenhuma árvore pode chegar perto da altura de uma montanha. Mudar um tipo exige redesenhar o sprite e atualizar esta tabela. A montanha tem canvas 160x160 com pegada de 5 x 3 tiles no mapa (ver `CRONARCA_MUNDO_SPEC.md`, seção 3).

## 3. Camadas (ordem de desenho, de baixo para cima)

| Camada | Conteúdo | Observação |
|---|---|---|
| L0 Terreno | tiles de grama, pântano e cripta (32x32 de mundo) | grade de 14 x 12 tiles, um sprite por célula |
| L0b Transições | degradê grama para pântano e cripta (`Sprite/Transicao`) | ver `CRONARCA_MUNDO_SPEC.md` seção 4 |
| L1 Rio | tiles de rio | |
| L2 Estradas | tiles de estrada | |
| L3 Montanhas | montanhas | |
| L3b Sombras | sombra pela silhueta de cada objeto de L4 (montanhas incluídas) e elipse `sombra-16` do grupo em marcha | todas desenhadas antes de qualquer objeto de L4, sem ordem por Y entre elas; ver seção 3b |
| L4 Objetos (ordem por Y) | árvores, construções, props, flores | ordenar por Y do pé |
| L5 Trilhas | pontos das rotas de expedição | |
| L6 Névoa | tiles de névoa cheia e de borda (áreas bloqueadas) | ver seção 4b |
| L7 Marcadores de expedição | pins, rótulos, grupo em marcha | |
| L8 UI sobre o mapa | chip de evento, Vila/Reino, zoom, minimapa | tela, não mundo |
| L9 Evento (popup) | só na Vila | tela, não mundo |

Ordenação em L4: `yPe = y + altura * 0.9` (o pé fica a 90% da altura do sprite). Desenhar do menor para o maior `yPe`. A âncora de posição é o pé (centro horizontal, 90% da altura).

## 3b. Sombras (L3b)

- A sombra é gerada da silhueta de cada sprite, uma vez por sprite e por quadro (em cache, no carregamento, em canvas fora da tela), no espaço 1x do sprite. Para cada pixel com alfa 255 em `(x, y)`, com `d = pe - y` (`pe` = pé da sombra, abaixo) (pixels com `d < 0` ficam de fora): destino `(x + floor(d * S), pe + floor(d * K))`, cor `#1c3a24` com alfa constante `A`, sem dither nem gradiente. Depois fecham-se os buracos de 1 px na vertical.
- **Pé da sombra:** sai do desenho de cada quadro, não do `peY`: a última linha com alfa 255, menos 1 px (a sombra entra um pouco por baixo da base e não deixa faixa de grama), mais um ajuste manual opcional por tipo em px de mundo (`AJUSTE_PE_SOMBRA`, padrão 0). O `peY` continua valendo para a ordenação por Y e para os marcadores.
- A imagem gerada tem a mesma origem do sprite e é desenhada com a escala inteira do zoom, sem suavização. Luz do canto superior esquerdo: a sombra cai para a direita e para baixo.
- Os sprites dos objetos não têm sombra embutida (a linha fina foi removida no Portão 9c).
- Aldeões e aventureiros têm tamanho fixo de 32 px de tela, então a sombra também fica fixa na tela: a elipse `sombra-16` em 1x, com o centro do miolo em `(pe + 2, pe + 1)` px de tela, andando junto com eles. Abaixo do zoom 2 o grupo em marcha vira o ícone de expedição, sem sombra.
- Os números ficam em `packages/game-core/data/mundo.ts` (`SOMBRA_OBJETO`, `SOMBRA_CONSTRUCAO`, `SOMBRA_MONTANHA`, `SOMBRA_AVENTUREIRO`), com S e K em milésimos:

| Tipo | S | K | A |
|---|---|---|---|
| Montanha | 0,50 | 0,22 | 100 |
| Árvore (Pinheiro, Carvalho, Morta) | 0,50 | 0,30 | 100 |
| Construção | 0,40 | 0,25 | 100 |
| Arbusto, Pedra, Poço, Fogueira, Placa, Lápide | 0,40 | 0,30 | 90 |
| Aldeão, Aventureiro | elipse `sombra-16`, +2 em x | | |
| Flores, Toco, Cerca, Juncos | sem sombra | | |

## 4. Tiles de estrada e rio

Cada peça é um sprite de 32x32 com orientação base. Para as outras direções, gira-se a instância em múltiplos de 90 graus.

| Peça | Conexões na orientação base | 90 graus (horário) | 180 | 270 |
|---|---|---|---|---|
| Reta | O, L | N, S | O, L | N, S |
| Curva | O, S | N, O | L, N | S, L |
| T | O, L, S | N, S, O | O, L, N | N, S, L |
| Cruzamento | N, S, O, L | igual | igual | igual |
| Lago | nenhuma (peça isolada) | | | |

Variante (1 a 5): `1 + ((coluna * 7 + linha * 13 + seed) % 5)`. Seeds usadas: reta de estrada na horizontal 2, na vertical 1, cruzamento 3, rio 1. Assim o desenho é determinístico e não pisca ao recarregar.

Estradas no mapa atual (coluna, linha):

- Vertical: coluna 7, linhas 3 a 11, exceto a 7.
- Horizontal: linha 7, colunas 0 a 11, exceto a 7.
- Cruzamento: (7, 7).

Rio no mapa atual:

- (8,0) e (8,1) retas verticais; (8,2) curva girada 180.
- (9,2), (10,2), (11,2) retas horizontais; (12,2) curva base.
- (12,3) reta vertical; (12,4) curva girada 180; (13,4) reta horizontal.

## 4b. Terreno e névoa em tiles (L0 e L6)

Sprites na página Sprites do Figma, todos 32x32, variantes 1 a 5: `Sprite/Terreno` (Grama, Pantano, Cripta), `Sprite/Nevoa` (Nevoa Cheia, Nevoa Borda) e `Sprite/Ponte`. Variante do tile: `1 + ((coluna * 7 + linha * 13 + seed) % 5)`, com seed 0 para grama, 4 para pântano, 5 para cripta e 3 para névoa.

Zonas de terreno (coluna, linha):

- Pântano: colunas 0 a 4, linhas 8 a 11, sem os cantos (4,8) e (4,11).
- Cripta: colunas 5 a 8, linhas 0 a 2.
- Todo o resto é grama.

Névoa (a Borda base é transparente em cima e densa embaixo; gira-se para apontar o lado denso):

| Área | Peças |
|---|---|
| Cripta (bloqueada até a pesquisa Estradas Reais) | Cheia em colunas 5 a 8, linhas 0 e 1; Borda girada 180 na linha 2; Borda girada 270 em (4,0) e (4,1) |
| Canto sudeste | Borda base em (10 a 13, 9); Cheia em colunas 11 a 13, linhas 10 e 11; Borda girada 270 em (10,10) e (10,11) |

Ao desbloquear a área, remover só os tiles de névoa daquela região. A ponte (`Sprite/Ponte`, vertical, gira 90 para atravessar rio vertical) ainda não é usada no mapa atual, porque nenhuma estrada cruza o rio.

Objetos novos em L4 (ordenados por Y do pé): Árvore Morta (canvas 48) e Juncos (16) no pântano, Lápides (12) na zona da cripta. Todos têm Quadro 1 e 2 para a animação.

## 4c. Mobile (390 x 844)

- O mapa da Vila no celular usa zoom 2x, igual ao Mapa, para o Poço ficar em 64, as Flores em 32 e as árvores em 96. Janela do mapa: 346 x 408 de tela, centrada no mundo (206,5; 236,3).
- Aldeões e aventureiros aparecem em 32 de tela (1x do sprite de 32, pixel inteiro), apoiados pelo pé como os demais objetos. É uma exceção declarada à regra de multiplicador 1 (aqui são metade da escala de mundo), aprovada no design.
- Pin bloqueado (Mina, Pântano e Cripta no início): cadeado no lugar do ícone; a névoa só existe na zona da Cripta e no canto sudeste.
- O popup de evento (L9) não faz parte do mapa mobile. O chip de evento é UI e fica sobre a janela.
- Layout fixo: topo de 56 + faixa de recursos que rola na horizontal, área de conteúdo rolável e barra de abas de 72 no rodapé (Vila, Heróis, Expedições, Eras).

## 5. Slots de construção (coordenadas de mundo, canto superior esquerdo, 48x48)

Cada slot guarda `{ id, tipo, nivel, x, y }`. O save só precisa de `id -> tipo + nivel`; a posição vem desta tabela.

| id | Tipo | x | y |
|---|---|---|---|
| casa_1 | Casa | 147 | 186 |
| scriptorium_1 | Scriptorium | 188 | 186 |
| mercado_1 | Mercado | 247 | 187 |
| taverna_1 | Taverna | 138 | 224 |
| armazem_1 | Armazém | 271 | 228 |
| forja_1 | Forja | 187 | 253 |
| serraria_1 | Serraria | 95 | 165 |
| serraria_2 | Serraria | 252 | 267 |
| celeiro_1 | Celeiro | 166 | 279 |
| muralha_1 | Muralha | 184 | 309 |
| pedreira_1 | Pedreira | 280 | 115 |

Props fixos (posições aproximadas, antes do ajuste de tamanho; reancorar pelo pé): Poço (203, 236), Fogueira (176, 250), Cerca (316, 257), Toco (30, 250) e (20, 310), Arbusto (52, 266) e (117, 306), Flores (125, 208), (161, 224), (298, 215), (143, 267), (235, 283).

Sugestão: alinhar todos os slots a uma grade de 8 de mundo na hora de implementar (hoje alguns estão a 1 ou 2 px de distância). É um ajuste de dado, não de código.

## 6. Montanhas, árvores e marcadores

- Montanhas (mundo, canto superior esquerdo, 96x96): variante 2 em (295, -15) e variante 5 em (342, -13). O topo corta 15 de mundo na borda, de propósito, para a base ficar acima do rio.
- Floresta: 18 árvores (12 pinheiros e 6 carvalhos), todas já sem sobreposição com construções, estradas e marcadores. Densidade mínima entre pés: 29 de mundo na horizontal e 23 na vertical.
- Marcadores de expedição (centro do pin, mundo):

| id | Destino | x | y | Estado inicial |
|---|---|---|---|---|
| floresta_lobos | Floresta dos Lobos | 80 | 107 | desbloqueado |
| mina | Mina Abandonada | 350 | 116 | bloqueado (Cartografia) |
| ruinas | Ruínas Esquecidas | 374 | 215 | desbloqueado |
| pantano | Pântano Sombrio | 75 | 285 | bloqueado (Cartografia) |
| cripta | Cripta do Rei Cinzento | 220 | 38 | bloqueado (Estradas Reais) |

A trilha de cada destino sai do cruzamento (240, 240) em linha reta, com um ponto a cada 10 de mundo.

## 7. Itens que ainda são desenhados à mão

Só o minimapa, que será gerado por código a partir da grade.

## 8. Portões de aprovação para implementar

Cada portão exige aprovação humana explícita antes de seguir. A numeração e a ordem oficiais estão no `CRONARCA_HANDOFF.md`; os cinco itens abaixo são a parte do mapa (portões 6 a 10 de lá).

1. **Câmera e grade:** viewport, zoom inteiro, conversão mundo-tela, pan limitado ao mapa. Entregar só um canvas com a grade desenhada.
2. **Terreno:** L0 a L3 com os tiles, variantes determinísticas e rotações.
3. **Objetos:** L4 com ordenação por Y e a tabela de escala da seção 2 lida de uma constante única.
4. **Marcadores e névoa:** L5 a L7 lendo `slots` e `destinos` de dados, não de código.
5. **Estado:** o mapa lê `id do slot -> tipo + nivel` do estado que vem do servidor (ver `CRONARCA_HANDOFF.md`, portões 5 e 10) e desenha o mesmo mapa a cada carga. Não há save no localStorage.
