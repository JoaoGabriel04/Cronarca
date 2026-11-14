# Cronarca: mapa grande fixo (A13)

Substitui o mundo por semente (`CRONARCA_MUNDO_SPEC.md`). O mapa é uma arte fixa, igual para todos os jogadores e em todos os ciclos. Continuam valendo da spec do mapa: seção 2 (escala), seção 3 (camadas, exceto as de terreno e objetos de cenário), regra de pixel, seção 5 (slots, somando a origem do núcleo) e 4c (mobile).

## 1. Arquivos entregues

| Arquivo | O que é |
|---|---|
| `mapa_base.png` | 3072 x 2304 px, RGB opaco. Terreno, rios, estradas, pontes, lago, pântano, cripta, pedras, arbustos, flores, minas, Easter eggs, o paredão de montanhas e a sombra de chão de cada árvore. **Versão 2 (árvores com vento): sem as árvores**, que são desenhadas por cima (seção 3b). **Não** tem as construções do núcleo, aldeões, aventureiros, pins, névoa nem contorno. |
| `arvores/` | 64 PNGs de 48 x 48: `<variante>_<quadro>_<k>.png`, 8 espécies x 2 desenhos (o `quadro` pintado) x 4 quadros de balanço. |
| `mapa_frente.png` | Camada de frente das árvores, gerada por `make gerar-frente` (`scripts/gerar-frente.cjs`): só os pixels de pedras, arbustos e flores que na arte ficavam na frente de uma árvore, mais a base semitransparente das árvores. Transparente no resto. |
| `docs/referencia/mapa_base_v1.png` | A arte original, com as árvores pintadas. É o gabarito: a composição parada tem de dar exatamente ela (não entra no jogo). |
| `contornos/` | 24 PNGs de contorno de silhueta (variante x quadro) para o destaque das árvores e pedras. |
| `mapa_meta.json` | tamanho, área jogável, núcleo, origem do núcleo, destinos (com `tipo`), **clicáveis (árvores e pedras)**, minas abandonadas, lago e Easter eggs, tudo em pixel de mundo. Versão 2: também `arvores` (1583) e `balanco` (seção 3b). |
| `mapa_referencia.png` | o mesmo mapa com as construções do núcleo e os marcadores dos destinos. **Só para olhar**, não entra no jogo. |

## 2. Mundo e câmera

- Mundo = 3072 x 2304 de mundo (96 x 72 tiles de 32). Unidade de mundo = 1 pixel de sprite. Zoom inteiro (1x a 4x), `image-rendering: pixelated`.
- **Área jogável** = `jogavel` do meta (x 224 a 2848, y 192 a 2080). Fora dela é o paredão de montanhas, que é só arte. O pan da câmera é limitado para que a viewport nunca saia do mundo; pode mostrar o paredão, não pode mostrar fora da imagem.
- Em 1x o mapa não cabe na tela de propósito: o jogador arrasta. Em telas grandes, o zoom mínimo é o menor inteiro que cobre a viewport.
- Um único mundo: Mapa (2x) e Vila (3x) são duas câmeras sobre ele, como na regra de ouro da spec do mapa. A Vila enquadra o núcleo.
- A imagem é 1 textura de 3072 x 2304: desenhar com um `drawImage` do recorte visível. Se algum dispositivo falhar, dividir em 4 pedaços de 1536 x 1152 (decisão do plano).

## 3. Camadas (revistas)

| Camada | Conteúdo | Origem |
|---|---|---|
| L0 | `mapa_base.png` | imagem |
| L4 | construções do núcleo (11 slots), props do núcleo, aldeões (um por ofício presente) e as árvores da arte (só as visíveis), ordenados pelo Y do pé; logo depois, a camada de frente | sprites, estado, `arvores` do meta |
| L5 | trilhas de expedição (por baixo da névoa) | `mapa_meta.json` + estado |
| L6 | névoa da Cripta | meta + estado |
| L7 | contorno do hover, destaque de slot, pins, rótulos, grupo em marcha, caixas de tempo e aviso da névoa (por cima da névoa) | meta + estado + interação |

Decisões do Portão 9: pin, rótulo e aviso ficam **por cima** da névoa e a trilha **por baixo**. Não há marcador do núcleo.

As **pedras** do mapa estão na imagem e ficam **estáticas**. As árvores balançam com o vento (seção 3b). O núcleo não tem vegetação (o núcleo e 2 tiles em volta dele estão limpos; nenhuma árvore cruza o núcleo, conferido em teste), então as construções nunca passam "por trás" de uma árvore.

## 3b. Árvores com vento (versão 2 do mapa)

- O meta traz `arvores`: 1583 itens em ordem de `y`, `{id, variante, quadro, x, y, ox, oy, clicavel}`. `x, y` é o pé; `ox, oy`, o canto do sprite; `clicavel` é o id em `clicaveis` (as 1206 árvores) ou `null` (377 decorativas: pinheiros da borda, cenários dos destinos, ciprestes da cripta). O Zod confere ids únicos, a ordem e que cada árvore clicável aparece uma vez, no mesmo pé e desenho.
- `balanco`: 4 quadros de `[300, 400, 300, 400]` ms. Os quadros 2 e 4 são o desenho pintado (repouso); no 1 e no 3 a copa vai 1 px de sprite para cada lado. Tronco e pé não se mexem. As durações ficam no meta, junto com a arte (exceção ao `quadros.json` do Portão 14b).
- Quadro atual = `indiceNoTempo` do relógio global com a fase da árvore (`faseDe(id)`): a floresta não balança em sincronia. Parado (preferência "Animações dos sprites" desligada ou `prefers-reduced-motion`): **o quadro de repouso (2)**, e o mapa fica idêntico à arte.
- Culling: as árvores ficam numa grade de células de 256 px (pelo canto do sprite); a cada quadro só entram as células que a viewport toca, com margem do lado do sprite, e só as árvores que a cruzam. Medido: 238 a 391 árvores por quadro no desktop em 1x, 38 a 208 em 2x, 2 a 154 no celular.
- Camada de frente: as árvores são desenhadas por cima da imagem e cobririam pedras e arbustos que estavam na frente delas (707 árvores na arte). `mapa_frente.png` repõe esses pixels logo depois das árvores. Ela é desenhada em ladrilhos de 64 px (só os que têm pixel e só os visíveis), não como imagem inteira. Limite conhecido: no quadro 1 e no 3, a copa pode cobrir 1 px na borda de uma dessas pedras.
- Clique e hover não mudam: caixa `x, y, w, h` e contorno `contornos/<variante>_<quadro>.png` do `clicaveis`, no desenho pintado. O contorno não acompanha o balanço (1 px de mundo).
- O minimapa reduz a arte parada (mapa + árvores em repouso + frente), composta uma vez.
- Saves: `estado.mundo.versaoMapa` aceita 1 e 2, que abrem o mesmo mapa (jogabilidade igual). Jogo novo começa na 2.

## 4. Núcleo e slots

- `nucleo` do meta é o retângulo do núcleo (x 1376 a 1664, y 1024 a 1312) e `origemNucleo` (1312, 928) é a origem somada às coordenadas da spec do mapa: slots (seção 5), props do núcleo e lugares dos aldeões. Nada muda nos slots.
- O cruzamento das estradas do núcleo fica em `origemNucleo + (240, 240)` = (1552, 1168). As trilhas saem dele (spec do mapa, seção 6).
- O núcleo nunca tem névoa (A12).

## 5. Destinos

| Destino | `tipo` | Estado | Observação |
|---|---|---|---|
| Floresta dos Lobos | expedicao | aberto | |
| Ruínas Esquecidas | expedicao | aberto | |
| Mina Abandonada | expedicao | bloqueado (Cartografia) | fica no pé da montanha, ao norte |
| Pântano Sombrio | expedicao | bloqueado (Cartografia) | |
| Cripta do Rei Cinzento | expedicao | bloqueado (Estradas Reais) | |
| Acampamento, Menires, Aldeia, Torre Velha | poi | decorativo | **sem pin, sem clique** na v0; reservados para eras futuras |

Cada destino tem `x` e `y` (centro, em mundo) e `tile`. O pin e a área de clique saem daí. Pins e trilhas: spec do mapa seção 6, usando estes pontos.

**Névoa (decisão do Portão 9).** Só a Cripta tem névoa, enquanto a pesquisa Estradas Reais não termina (A3). Mina e Pântano bloqueados só têm o cadeado no pin (A4). A névoa é um círculo de centro (2496, 1651) e raio 232 de mundo (constante única), que cobre o cemitério da imagem; o centro não é o ponto do pin. Textura: o tile `Nevoa Cheia` do Figma (5 variantes de 32, translúcido), alinhado à grade de 32 do mundo; borda em xadrez de 2 x 2 px nos últimos 16 px do raio. O aviso "Estradas Reais" fica dentro do quadrado inscrito no círculo. Árvores e pedras dentro da névoa continuam clicáveis (a névoa é só visual).

As **minas abandonadas** (`minasAbandonadas`) e os **Easter eggs** (`easterEggs`) são arte da imagem. Na v0 não têm função; o meta só registra onde estão, para uso futuro (eventos, achados).

## 5b. Árvores e pedras clicáveis (decisão do dono, Portão 7c)

O `mapa_meta.json` tem a lista `clicaveis`: 1455 itens (1206 árvores e 249 pedras), cada um com `id` (`a0000` para árvore, `p0000` para pedra), `tipo` (`arvore` ou `pedra`), `variante` (pinho, carvalho, bétula, salgueiro, pedra, rocha_grande...), `x` e `y` (pé do sprite, em mundo) e `w` e `h` (caixa do sprite em px). As regras de clique de hoje (rendimento, tempo de recarga, limite de cliques, conferência no servidor) **não mudam**: só a fonte das posições troca, do mundo gerado para esta lista. O servidor confere o clique contra a lista, nunca contra o que o cliente diz.

- As árvores e pedras desenhadas na imagem são as mesmas da lista; o que não está na lista (toco, arbusto, flor, lápide, pedras de cenário dos destinos, linha de pinheiros da borda do paredão) é só enfeite.
- A lista tem mais itens do que o jogo precisa. Se o ritmo da economia pedir menos, o plano propõe um filtro determinístico por id (exemplo: ignorar as árvores da faixa de 64 px junto ao paredão). Não mude a lista na mão.
- Pedra de minério (`pedra_minerio`, 3 itens) vale como `pedra` na v0.
- **Árvores e pedras não se esgotam na v0**, como hoje. Nada é guardado por `id` no estado. Se um dia esgotarem, é regra nova de economia, com esquema próprio, em outro portão.
- Destaque ao passar o mouse (só desktop): **contorno pela silhueta do sprite**, não pela caixa nem elipse. Cada clicável tem `quadro` (0 ou 1) e `cx`,`cy` (canto superior esquerdo, em mundo, da imagem de contorno). A imagem é `contornos/<variante>_<quadro>.png` (24 PNGs, contorno dourado de 1 px, fundo transparente, 2 px maior que o sprite em cada eixo). Desenhar na L7 em `(cx, cy)`, em pixel inteiro, sem escala fracionária, mais o "+N". `x`, `y`, `w`, `h` continuam servindo só para o teste de clique. No toque não há destaque.

## 6. O que sai do projeto

- Gerador `gerarMundo`, semente, `versaoGerador`, galeria de sementes, parâmetro `?semente=`, transições de terreno (L0b) e rotação de tiles. Se o Portão 7b já entregou algo disso, o plano do 7c diz o que remover e o que reaproveitar.
- O servidor não sorteia mais semente na criação do jogador nem na ascensão.
- `estado.mundo` vira `{ "versaoMapa": 1 }`. `versaoMapa` existe para trocar o mapa no futuro sem quebrar saves. A versão 2 (árvores com vento, seção 3b) tem a mesma jogabilidade: 1 e 2 abrem o mesmo mapa.

## 7. Testes do Portão 7c

1. O meta valida com Zod (tamanho = 3072 x 2304, destinos dentro da área jogável, os 5 de expedição presentes).
2. Conversão mundo-tela ida e volta, em zoom 1 a 4, com `devicePixelRatio` 1 e 2.
3. O pan nunca expõe fora da imagem, em qualquer zoom e tamanho de viewport (390 x 844 e 1440 x 900).
4. A imagem carrega e desenha sem deformar (conferir pixel de canto, sem suavização). Versão 2: `make conferir-mapa` compara o canvas parado (movimento reduzido, névoa desligada) com o gabarito `mapa_base_v1.png` em 1x a 4x, dpr 1 e 2, e confere que com vento os pixels só mudam dentro dos sprites das árvores.
5. Desempenho: arrastar o mapa mantém 60 fps em 2x no desktop; registrar o resultado no relatório.
