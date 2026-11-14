# Cronarca: mundo gerado por semente (Portão 7b)

Esta spec substitui, no que for de terreno, rio, estrada, montanha, zonas, destinos e névoa, o mapa autoral fixo descrito em `CRONARCA_MAPA_SPEC.md` (seções 1, 4, 4b e 6). O que continua valendo de lá: tabela de escala (seção 2), camadas e ordenação por Y (seção 3), regra de pixel, câmeras Mapa 2x e Vila 3x, slots de construção (seção 5, agora relativos ao núcleo) e o mobile (4c).

Decisão do dono: **cada ciclo (ascensão) tem um mundo diferente**, com estradas, rio, zonas e florestas em lugares diferentes. O centro da vila é fixo. O jogador não desenha estrada nem terreno.

Referência visual do que se espera: `docs/referencia/galeria_mundos_prototipo.png` (protótipo em Python, 4 sementes). O protótipo valida o desenho do algoritmo; o gerador real é em TypeScript no `game-core`.

## 1. Dimensões

| Item | Valor |
|---|---|
| Mundo | 36 x 28 tiles (1152 x 896 de mundo) |
| Núcleo fixo | colunas 13 a 21, linhas 9 a 17 (9 x 9 tiles) |
| Janela da Era I | colunas 6 a 28, linhas 3 a 23 (23 x 21 tiles) |
| Fora da janela | névoa de Era II, sem cliques e sem pins |
| Origem do núcleo | os 9 x 9 tiles antigos (spec do mapa, tile 2 a 10 e 3 a 11) viram 13 a 21 e 9 a 17. Em unidades de mundo: `ORIGEM_NUCLEO = (352, 192)`, somada a toda coordenada da seção 5 da spec do mapa |

Câmeras: Mapa 2x centrada em (571, 370), Vila 3x em (558,5; 428,3) (as antigas somadas à origem). O pan na Era I é limitado à janela mais 1 tile de névoa; na Era II, ao mundo todo.

O tamanho (`LARGURA`, `ALTURA`, `NUCLEO`, `JANELA`) fica em constantes únicas em `game-core`. Nada de número solto no renderizador.

## 2. Semente, versão e determinismo

- O servidor sorteia a `semente` (uint32, `crypto`) ao criar o jogador e a cada ascensão. Guarda em `estado.mundo = { semente, versaoGerador }`. O mundo em si nunca é salvo: é sempre regenerado.
- `gerarMundo(semente, versaoGerador)` é função pura no `game-core`: sem `Math.random`, sem `Date`, sem leitura externa. Cliente e servidor rodam o mesmo código e obtêm exatamente o mesmo mundo.
- PRNG: `mulberry32`. Cada etapa usa um fluxo próprio, `rng(semente, "rotulo")` = `mulberry32(hash32(semente, fnv1a("rotulo")))`, para que mudar uma etapa não embaralhe as outras. Rótulos: `zona_cripta`, `zona_pantano`, `montanhas`, `destinos`, `rio`, `troncos`, `estradas_dest`, `ramais`, `arvores`, `decoracao`, `decoracao_arbusto`.
- Decisões (quem vence, quem é aceito) usam inteiros e comparações estáveis; ordem de iteração sempre definida (ordenar por coluna e linha, nunca por ordem de `Set`).
- **Regra de ouro de honestidade:** uma `versaoGerador` publicada nunca muda. Ajustes no algoritmo viram `versaoGerador` 2, e o jogador existente continua no 1. Teste de regressão: snapshot do mundo de 20 sementes fixas por versão.
- Ids estáveis dos objetos: `arvore_17`, `pedra_3`, etc., pelo índice de geração. O servidor valida cliques regenerando o mundo (com cache por `semente + versao`).

Saída (`Mundo`): `{ versao, semente, largura, altura, terreno[linha][coluna], transicoes[], rio[], estradas[], pontes[], montanhas[], destinos[], objetos[], nevoas[], slots[] }`. Peças já resolvidas (tipo, rotação, variante) para o renderizador apenas desenhar.

## 3. Ordem de geração

1. **Núcleo fixo.** Os 11 slots (spec do mapa, seção 5, mais `ORIGEM_NUCLEO`), poço, fogueira, cerca e flores que estão dentro do retângulo do núcleo. Os demais props antigos (tocos e arbustos de borda) viram decoração gerada. Estradas do núcleo (as da spec do mapa somadas à origem): cruz em (18, 13), vertical na coluna 18 (linhas 9 a 17) e horizontal na linha 13 (colunas 13 a 21). A estrada fica fora do centro do núcleo, como no design. As pontas dos prédios podem cobrir alguns pixels da borda da estrada, como já acontece no Figma (prédio desenhado por cima, em L4). As **portas** são os tiles logo fora: N (18, 8), S (18, 18), O (12, 13), L (22, 13).
2. **Zonas de terreno.** Cripta e Pântano, em formato de mancha orgânica (elipse com ruído, depois removendo tiles com menos de 2 vizinhos). Cada uma tem pelo menos 13 tiles e caixa de pelo menos 4 x 3. Restrições: a caixa da **Cripta** fica a 1 tile ou mais da borda da janela (sobra um tile aberto entre a névoa dela e o anel de névoa da Era II); a do **Pântano** a 2 tiles ou mais; as duas ficam a 1 tile ou mais do núcleo (o tile aberto entre elas e o núcleo é a faixa das portas, que nunca é coberta) e a 2 tiles uma da outra. Até 300 tentativas; se falhar, regenerar com sub-fluxo seguinte (`zona_x#2`). Zonas nunca encostam em grama de outro tipo sem faixa de grama entre elas.
3. **Montanhas.** 3 montanhas, sprite `Sprite/Montanha` redesenhado (canvas 160x160, multiplicador 1, variantes 1 a 5, as colinas laterais fazem parte do desenho). **Pegada de 5 x 3 tiles** (160 x 96), alinhada ao fundo do canvas: o canvas ocupa a pegada mais **2 linhas de tiles acima dela** (o pico "invade" essas 2 linhas, é só arte, ordenada por Y do pé). Pé da base em y 140 do canvas (`peY: 140`). Regras: pegada dentro da janela; sobreposição de arte (as 2 linhas de cima) dentro do mundo; pegada a 3 tiles ou mais do núcleo e a 2 tiles uma da outra; fora das zonas e **a 1 tile ou mais da caixa de névoa de qualquer zona** (pegada mais as 2 linhas de cima); nas 2 linhas de cima da arte não pode haver estrada, destino, objeto nem tile de rio (a arte cobriria).
4. **Destinos** (pins): `cripta` e `pantano` no tile de grama vizinho da zona mais próximo do núcleo; `mina` logo abaixo da primeira montanha, no tile `(c+2, l+3)`; `ruinas` e `floresta_lobos` em tile livre a 6 tiles (distância de Manhattan) ou mais de qualquer outro destino e a 3 do núcleo. Sempre os 5.
5. **Rio.** Caminhada que parte de uma borda do mundo e termina na borda oposta, com pesos 55% em frente e 22,5% para cada lado, sem voltar, sem encostar em si mesmo e sem U (uma virada lateral só pode ser seguida de outra oposta depois de 7 passos). Evita o núcleo com 1 tile de folga e as zonas, montanhas e destinos com 1 tile de folga. Precisa ter pelo menos 12 tiles dentro da janela, senão tenta de novo (até 80). Se nunca der certo, o mundo fica sem rio (válido). Opcional: 0 a 3 tiles de `Lago` isolados em grama, a 3 tiles ou mais de estrada, rio e núcleo.
6. **Estradas.** Ligações explícitas entre pares de tiles (nunca inferidas por vizinhança):
   - *Troncos:* de cada porta, com 80% de chance, uma estrada que segue para fora, com 22% de chance por passo de virar (e mantém o novo rumo por 2 passos), até sair da janela, bater em algo ou passar de 45 passos. Ao encostar em estrada existente, liga e termina (forma um T).
   - *Destinos:* na ordem sorteada, A* de cada destino até a rede de estradas existente. Custo: 1 mais ruído de 0 a 1,3 por tile, mais 0,8 por curva, mais 0,9 por vizinho que já é estrada (evita faixas lado a lado), mais 6 por tile de rio. Bloqueados: núcleo (exceto as estradas dele), zonas, montanhas, fora da janela.
   - *Rio:* só se atravessa em tile de rio reto, em linha reta e perpendicular, e o tile seguinte não pode ser rio. Esse tile vira **ponte**.
   - *Ramais:* de 0 a 2 ligações extras entre duas estradas que já existem (laços), nunca becos sem saída soltos.
7. **Objetos de L4.** Árvores por Poisson (distância mínima 30 de mundo na horizontal e 36 na vertical), aceitas por densidade (0,22 base, mais 0,7 num raio de 5 tiles do destino `floresta_lobos`), nunca a menos de 1 tile de estrada ou rio, nem sobre zona, montanha, núcleo ou destino. Espécie: carvalho se `hash(x, y, semente) % 3 == 0`, senão pinheiro. Depois: arbustos, pedras (clicáveis), toco, flores (estas com ruído de agrupamento), juncos e árvore morta dentro do pântano, lápides dentro da cripta. Todo objeto guarda `id`, `tipo`, posição do pé, e `clicavel` com recurso (árvore rende madeira, pedra rende pedra).
   - **Variante do arbusto** (`variante`, 1 a 7: liso, frutinhas, florido, rasteiro, seco, capim, azul): sorteada depois de todos os objetos colocados, no fluxo `decoracao_arbusto`, na ordem dos arbustos. Não muda posição nem colisão, nem os outros sorteios. Pesos base 3; 2; 2; 2; 0,5; 1; 1 (guardados em dobro, inteiros). Capim passa a peso 4 com estrada, ponte ou rio a 2 tiles ou menos; seco passa a peso 4 com tile de pântano a 4 tiles ou menos (distância Chebyshev a partir do tile do pé; os dois ajustes se somam). O sprite é `arbusto-<variante>-<quadro>`. Entrou com a versão 1 reaberta (Portão 9c, rodada 3).
8. **Névoa.** Região A: tudo fora da janela da Era I (some ao entrar na Era II). Região B: exatamente a caixa da cripta (sem tile de folga), enquanto a pesquisa Estradas Reais não termina. A borda da névoa fica rente ao terreno da cripta e se funde com a transição dele. As regiões nunca se tocam (folga de 1 tile aberto entre elas).

## 4. Regras de peças (autotile)

Convenção de rotação: horária, múltiplos de 90. Direções N, L, S, O.

**Estrada e rio** (peças em `Sprite/Estrada` e `Sprite/Rio`, base como na spec do mapa, seção 4):

| Conexões do tile | Peça | Rotação |
|---|---|---|
| uma só (ponta) | Reta | 0 se O ou L; 90 se N ou S |
| O+L | Reta | 0 |
| N+S | Reta | 90 |
| O+S | Curva | 0 |
| N+O | Curva | 90 |
| L+N | Curva | 180 |
| S+L | Curva | 270 |
| três | T | falta N: 0; falta L: 90; falta S: 180; falta O: 270 |
| quatro | Cruzamento | 0 |

Rio só tem Reta e Curva (sem T nem cruzamento). Ponte (`Sprite/Ponte`, desenhada vertical, atravessa rio horizontal): rotação 0 sobre rio O-L e 90 sobre rio N-S, desenhada em L2 por cima do rio. Variante de qualquer peça: `1 + ((coluna * 7 + linha * 13 + seed) % 5)`, com seeds: estrada Reta horizontal 2, Reta vertical e demais 1, Cruzamento 3, rio 1, ponte 2.

**Transições de terreno (novo, camada L0b entre L0 e L1).** Corrigem o corte seco entre grama e Pântano ou Cripta. Sprites em `Sprite/Transicao` (Borda, Canto, Canto Interno, variantes 1 a 5), desenhados em cima de tiles que **não** são grama, com pixels de grama (e transparência), o que dá um degradê pontilhado para a grama. Substituem totalmente os antigos `Pantano Borda` e `Pantano Canto` (não usar mais).

Para cada tile não grama, ver os 4 vizinhos e as 4 diagonais; vizinho fora do mundo conta como não grama:

1. Para cada canto cujos dois lados vizinhos são grama, desenhar **Canto** (base: grama em N e O) com rotação NO 0, NE 90, SE 180, SO 270, e marcar esses dois lados como cobertos.
2. Para cada lado vizinho que é grama e ainda não coberto, desenhar **Borda** (base: grama em N) com rotação N 0, L 90, S 180, O 270.
3. Para cada diagonal que é grama quando os dois lados adjacentes não são, desenhar **Canto Interno** (base: grama na diagonal NE) com rotação NE 0, SE 90, SO 180, NO 270.

Variante: `1 + ((coluna * 7 + linha * 13 + 6) % 5)`. Pântano e Cripta nunca ficam vizinhos entre si (folga de grama), então só existem transições com grama.

**Névoa** (`Sprite/Nevoa`: Cheia, Borda, Canto, **Canto Interno** novo). Tile em região de névoa, vendo os vizinhos *abertos* (fora da região):

| Abertos | Peça | Rotação |
|---|---|---|
| nenhum lado e nenhuma diagonal | Cheia | 0 |
| nenhum lado, uma diagonal | Canto Interno (base: aberto em NE) | NE 0, SE 90, SO 180, NO 270 |
| um lado | Borda (base: aberto em N) | N 0, L 90, S 180, O 270 |
| dois lados adjacentes | Canto (base: abertos N e O) | N+O 0, N+L 90, S+L 180, S+O 270 |

Fora do mundo conta como névoa. As regiões da seção 3 garantem que não aparecem lados opostos abertos nem três lados abertos.

## 5. Invariantes e testes (Portão 7b)

Testes automáticos em `game-core`, rodando em 500 sementes:

1. Determinismo: duas gerações da mesma semente dão JSON idêntico; hash estável entre execuções.
2. Núcleo intacto: slots, poço, fogueira e estradas do núcleo exatamente nas posições da spec. Nada **gerado** (zonas, rio, montanhas, estradas de fora, objetos) entra no retângulo do núcleo, exceto os troncos que partem das portas. Os pixels que os prédios cobrem da estrada do núcleo são aceitos e não entram no teste.
3. Os 5 destinos existem e cada um liga ao núcleo por estrada (busca em largura sobre as ligações, atravessando pontes).
4. Nenhum objeto sobre estrada, rio, ponte, zona, montanha, núcleo ou destino.
5. Rio: cada tile tem 2 conexões (1 na borda do mundo); só Reta e Curva; toda ponte é Reta de rio com estrada reta perpendicular; nenhuma curva, T ou cruzamento sobre rio.
6. Zonas: caixa mínima 4 x 3, folga de grama com o núcleo e entre si, dentro da janela.
7. Névoa: regiões retangulares, sem lados opostos abertos, sem se tocar.
8. Tempo de geração abaixo de 50 ms em Node.
9. Snapshot de 20 sementes por `versaoGerador`.

## 6. Entregas do Portão 7b

1. `gerarMundo` e tipos em `game-core`, com os testes acima.
2. Renderizador atualizado: L0 e L0b (transições), L1 a L3, L6 (névoa), tudo vindo do `Mundo` e não de tabelas fixas. Camera e tile já feitos no Portão 6 e 7 continuam.
3. Preview em desenvolvimento: parâmetro `?semente=NNN` e botão "Nova semente" na página de preview.
4. **Galeria de revisão:** script que gera uma imagem com 12 sementes (reduzidas) para o dono aprovar o visual antes do Portão 8. Aprovação é visual, como nos outros portões.
5. `estado.mundo` no esquema de estado e no Prisma/Zod (semente e versão); o servidor sorteia a semente na criação do jogador e na ascensão.

Não entra no 7b: árvores, construções, aldeões e pins desenhados com sprites (Portões 8 e 9). Pode usar marcadores simples na galeria.

## 7. Decisões do relatório do Portão 7b

Resposta do dono ao relatório do Claude Code. Valem como parte desta spec.

- **Núcleo, zona da cripta e teste de núcleo:** conforme as seções 3 e 5 (estrada na coluna 18, teste só do que é gerado). A exigência de "cripta a 2 tiles do núcleo" foi **retirada** porque não cabia junto com as demais folgas: vale cripta a 1 tile do núcleo e névoa só sobre a caixa (decisão do dono, opção 3 do relatório).
- **Montanhas:** variante sorteada de 1 a 5 no fluxo `montanhas`. `(c, l)` é o canto superior esquerdo da pegada de 5 x 3. A montanha só é aceita se o tile da mina, `(c+2, l+3)` (centro, logo abaixo da pegada), estiver livre e dentro da janela. Sem encaixe das 3 montanhas, refaz o fluxo `montanhas` com sub-fluxo `#2`, `#3`...
- **Ruínas e Floresta:** sorteio entre os tiles válidos em ordem estável (linha, coluna). Sem nenhum válido, refaz montanhas e destinos com sub-fluxo `#2`.
- **Rio:** sorteia eixo (N-S ou O-L), sentido e posição de partida. Se a caminhada chegar a uma borda que não é a oposta, a tentativa falha. Lagos usam o fluxo `rio`.
- **Troncos:** virada 50% para cada lado, sem voltar. Cruzam rio com ponte quando a regra permite; se não permite, o tronco é descartado. Um tronco que para num obstáculo antes de sair da janela, e que não liga em estrada nem destino, é descartado (sem becos). Um tronco pode se ligar a um destino.
- **Estrada de destino:** começa no tile do destino, e o pin fica na ponta da estrada.
- **Ramais:** pares de tiles de estrada a até 10 tiles de distância e a 20 passos ou mais pela rede, ligados pelo mesmo A* sem passar por outra estrada, de 0 a 2.
- **Objetos:** quantidades em arquivo de dados, ajustadas na galeria. O tile do pé da árvore e os 8 vizinhos não podem ser estrada nem rio. Objetos só dentro da janela.
- **`hash32` e inteiros:** fórmula de inteiros de 32 bits, congelada na versão 1. Todo custo e distância em inteiros (A* com custo x10, Poisson com distância ao quadrado). Iteração sempre ordenada por linha e coluna.
- **Tentativas:** no máximo sub-fluxo `#8`. Se ainda falhar é erro, e os testes com 500 sementes devem pegar.
- **Versão do gerador:** a versão 1 só é congelada (snapshot das 20 sementes) depois da aprovação visual da galeria.
- **Estado:** `VERSAO_ESQUEMA` sobe para 2. Não há jogadores reais, então **não** se escreve conversor: usa-se `make reset-db`. A semente fica só no jsonb, validada pelo Zod, sem coluna nova no Prisma. A semente é sorteada no backend com `crypto`; o `game-core` recebe a semente de fora.
- **Preview:** `/jogo?semente=NNN` com botão "Nova semente"; sem parâmetro, semente fixa até o Portão 10. Galeria em `/jogo/galeria`, só em desenvolvimento, com `make galeria` (Playwright em Docker) gravando `docs/referencia/galeria_mundos_v1.png`.
- **Exportação de sprites:** conferir a transparência antes de usar. O PNG do `download_assets` pode vir com fundo; preferir SVG (preserva alfa parcial) convertido para PNG 1x, comparando um sprite com a exportação do plugin do Figma.
