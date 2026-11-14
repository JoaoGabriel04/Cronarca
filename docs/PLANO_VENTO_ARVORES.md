# Cronarca: árvores animadas pelo vento (auditoria e plano)

Status: **substituído** (2026-11-12). O dono entregou o mapa sem árvores, os sprites e o meta v2 (`entrega_arvores.zip`), e o Portão 14c foi feito por essa entrega. O que vale está no `CRONARCA_MAPA_GRANDE.md`, seção 3b. Este documento fica só como histórico da auditoria.

Objetivo: as 1206 árvores do mapa balançam com o vento. As 249 pedras continuam na imagem.

---

## 1. Auditoria

### 1.1 Como o `mapa_base.png` é gerado

- **O gerador não está no repositório.** Não há script, ferramenta nem passo a passo de geração no projeto. O `mapa_base.png` (3072 x 2304) e o `mapa_meta.json` chegaram prontos, entregues pelo dono no Portão 7c (A13). O meta tem um campo `semente`, sinal de que vieram de um gerador externo e determinístico.
- A imagem tem tudo pintado junto: chão, estradas, rio, árvores, pedras, arbustos, tocos, flores, juncos, cogumelos, minas e o paredão. Uma árvore cobre o que está atrás dela, e o que está na frente (arbusto, toco, pedra, outra árvore) cobre a árvore.
- **Medidas tiradas da imagem e dos contornos** (cada sprite de árvore é 48 x 48; o contorno tem 50 x 50, com 1 px de borda):

| Medida | Valor |
|---|---|
| Árvores cuja silhueta cruza a de outra árvore | **760 de 1206 (63%)**; até 13 vizinhas numa só |
| Pixels de mundo cobertos por 2 ou mais silhuetas | 111.154 |
| Árvores que cruzam uma pedra | 157 (em 43 a pedra está **na frente** da árvore) |
| Variantes de árvore | 8 (pinho 573, carvalho 251, salgueiro 107, pinho nevado 83, bétula 70, árvore morta 60, carvalho outonal 38, cipreste 24) |
| Quadro pintado de cada árvore (`quadro` do meta) | 0 ou 1, cerca de meio a meio |
| Semelhança entre o quadro 0 e o quadro 1 da mesma variante (IoU da silhueta) | 0,82 (árvore morta) a 1,00 (bétula); pinho 0,93; carvalho 0,97 |
| Árvores a menos de 4 tiles do núcleo | 26 (o núcleo e 2 tiles em volta continuam limpos) |
| Pé dentro do sprite (x, y a partir do canto) | (24, 44) a (24, 46), conforme a variante |

  Os quadros 0 e 1 são dois momentos de um balanço: a silhueta muda pouco. O mapa congelou cada árvore num deles. Isso é a base da abordagem B.

- **Gerar uma versão sem as árvores, mantendo as pedras, só é viável com o gerador.** Recortar as árvores da imagem atual não funciona. Em 63% delas o que está atrás é outra árvore, e o chão por trás nunca foi pintado. Tentar reconstruir esse fundo (copiar grama vizinha, por exemplo) deixaria buracos e emendas visíveis nas florestas densas. Recortes ampliados confirmam a densidade.
- **O que é preciso do gerador:** a mesma semente e a mesma arte, com uma única diferença, que é não pintar as 1206 árvores da lista `clicaveis`. Ficam pedras, arbustos, tocos, flores, a linha de pinheiros da borda do paredão (que não está na lista) e, se for o caso, as sombras das árvores (decisão D2).
- **Sprites das árvores:** não há sprites de árvore no projeto. Os antigos saíram no 7c, e só os 24 contornos ficaram. São necessários os 16 PNGs de 48 x 48 (8 variantes x 2 quadros) iguais aos que o gerador pinta. O plano confere automaticamente que a silhueta de cada sprite é exatamente o interior do contorno correspondente.

### 1.2 Como a L4 desenha hoje e como se comportaria com mais 1206 sprites

- A L4 (`lib/mapa/objetos.ts`) é uma lista de itens ordenada pelo Y do pé, montada quando o estado muda. Hoje são cerca de 25 itens: props, construções e aldeões.
- A cada quadro de tela, `planoL4` percorre todos os itens, calcula o retângulo na tela, descarta os que estão fora e gera os comandos de sombra e de objeto. O quadro de cada item sai do relógio do Portão 14b (`quadros.json` com a fase pelo id), num único `requestAnimationFrame`, sem timer por sprite.
- **Com mais 1206 árvores:**
  - Percorrer 1206 itens por quadro só para descartar os de fora é desperdício. Uma grade espacial de células de 256 px de mundo resolve.
  - Pior caso de árvores visíveis: **367** no desktop em 1x (viewport de cerca de 1100 x 812 de mapa), **172** no Reino em 2x e **77** no celular em 2x. É uma chamada `drawImage` por árvore, com sprites de 48 x 48 vindos de imagens já decodificadas.
  - A lista de árvores não muda nunca. Ela pode ser ordenada uma vez no carregamento, e o resto da L4 entra por intercalação.
- **Medição do Portão 14b como referência:** o mapa cheio dá 60 fps no desktop em 4x. No celular (390 px, DPR 3) dá 60 fps sem limitar a CPU e de 33 a 45 fps com a CPU 4x mais lenta. Esse custo vem de pintar a tela inteira a cada quadro, e não da quantidade de sprites: com a animação parada o resultado é o mesmo. Não há medição em 1x nem no Reino, e o plano faz essa medição antes e depois.

### 1.3 Impacto nas regras existentes

| Regra ou peça | Hoje | Com o vento |
|---|---|---|
| "Núcleo sem vegetação, nada passa por trás de árvore" | Garante que construções e aldeões nunca precisem passar por trás da imagem | **Continua válida.** O núcleo e 2 tiles em volta seguem limpos. Uma árvore 2 tiles abaixo da borda não alcança o núcleo (o sprite sobe no máximo 46 px a partir do pé). As árvores entram na L4, mas não se cruzam com o núcleo. A ordenação única pelo pé fica, por segurança |
| Objetos fixos na frente de uma árvore (arbusto, toco, pedra, pinheiro da borda) | Pintados por cima, na imagem | O sprite da árvore, desenhado depois da base, os cobriria. Solução: uma **camada de frente**, uma imagem transparente só com os pixels de objetos fixos que estão na frente de alguma árvore, desenhada logo depois das árvores. Ela é calculada no carregamento ou num script: compor base sem árvores + árvores e comparar com o `mapa_base.png` atual. Onde der diferente, o pixel original vai para a camada de frente |
| `make conferir-mapa` | Compara o canvas com o `mapa_base.png`: 0 px diferentes em 1x a 4x | Com o vento parado, a composição (base sem árvores + árvores no quadro do meta + camada de frente) tem de dar **exatamente o `mapa_base.png` de hoje**. O arquivo atual passa a ser o gabarito da conferência e sai de `public/`. É o principal critério de aceite do portão V1 |
| Contornos do hover (24 PNGs, `variante_quadro`) | Desenhados na L7 no `cx, cy` do meta, no quadro pintado | Na abordagem B, cada variante já tem contorno para os dois quadros: o hover desenha o contorno do quadro que a árvore mostra agora, no mesmo `cx, cy`. Não precisa de arte nova. Na A, o contorno recebe o mesmo deslocamento de linhas do sprite. Na C, o contorno de cada quadro novo pode ser gerado do sprite (dilatação de 1 px) |
| Caixa de clique (`x, y, w, h` do meta) | Só a caixa, sem pixel | **Não muda.** Medido: a caixa deixa uns poucos pixels de fora em 60 árvores, igual nos dois quadros (já é assim hoje). O servidor confere o clique pelo `id` e pela lista, sem relação com o desenho |
| Tremida e "+N" no clique | A árvore da imagem não treme | Árvore em sprite pode tremer como as construções. Fica como opção, fora do escopo mínimo |
| Pedras | Na imagem | Continuam na imagem. As 43 que estão na frente de uma árvore entram na camada de frente |
| Servidor e estado | Nada | Nada. É só visual |

---

## 2. Abordagens

Todas partem da mesma base: `mapa_base_sem_arvores.png`, árvores na L4 com recorte do que está fora da tela e a camada de frente.

### A. Balanço procedural, sem arte nova

O sprite de cada árvore (um quadro por variante) é deslocado por faixas de linhas: o topo anda até 1 px de mundo para os lados, a base fica presa no pé, e a fase vem do id. A regra de pixel proíbe inclinação contínua ("nunca esticar sprite", zoom inteiro). Então o deslocamento é inteiro, por faixas, e os quadros seriam gerados no carregamento (por exemplo: 0, +1, 0, -1), não calculados a cada frame.

- Prós: não precisa de arte de balanço; dá para ter 4 ou mais passos.
- Contras: deslocar linhas de pixel art cria degraus no tronco e no contorno da copa, a menos que a faixa coincida com a arte. Com 1 px de mundo, o salto em 4x é de 4 px de tela, sem suavidade. O contorno do hover tem de ser deslocado junto. Visualmente tende a ficar pior que dois quadros desenhados à mão.
- Esforço: médio. Gerar os quadros, gerar os contornos e ajustar as faixas por variante.

### B. Os 2 quadros pintados de cada variante, alternando com fase pelo id (recomendada)

Usa a arte que já existe: o quadro 0 e o 1 de cada variante são um balanço (IoU de 0,82 a 1,00). As árvores entram no `quadros.json` como um grupo `arvore`, com 2 quadros e durações entre 400 e 600 ms. Usam o mesmo relógio, a mesma fase e o mesmo loop do Portão 14b.

- Prós: arte do artista, sem degraus. Os 24 contornos servem sem mudança. Encaixa no `quadros.json` e no relógio existentes.
- Contras: só 2 passos, o que dá um "tique-taque" se todas forem iguais. A fase por id quebra a sincronia, e uma onda de vento pelo x (decisão D3) dá a sensação de rajada. A bétula tem IoU 1,00, então nela o balanço é só de cor ou detalhe interno.
- Esforço: baixo, depois da base sem árvores e dos sprites.

### C. Mais quadros (5 a 10), como evolução

É arte nova por variante e quase só muda o JSON: com a B feita, basta entregar os PNGs e acrescentar as entradas no `quadros.json`. O contorno de cada quadro novo pode ser gerado do sprite no carregamento, por dilatação de 1 px. Isso aposentaria os 24 PNGs de contorno. Fica para depois.

### Comparação

| | A procedural | B 2 quadros | C mais quadros |
|---|---|---|---|
| Arte nova | Não | Não (só exportar os 16 sprites que já existem) | Sim |
| Qualidade do pixel | Risco de degraus | Fiel à arte | Fiel à arte |
| Contornos | Gerar deslocados | Os 24 de hoje | Gerar do sprite |
| Encaixe no 14b | Parcial (quadros gerados) | Total | Total |
| Esforço | Médio | Baixo | Baixo no código, alto na arte |

---

## 3. Plano (com a abordagem B)

### Recorte e desempenho

- As árvores são ordenadas pelo pé uma vez no carregamento e indexadas numa grade de 256 x 256 px de mundo (12 x 9 células).
- A cada quadro, só entram as células que tocam a viewport. As árvores visíveis já saem em ordem e são intercaladas com os cerca de 25 itens do núcleo.
- Teste de fps antes e depois, com o mesmo roteiro:
  - desktop 1440 x 900 em 1x (mapa inteiro, pior caso de 367 árvores) e no Reino em 2x;
  - celular 390 x 844 com DPR 3 no Reino em 2x, com a CPU normal e com a CPU 4x mais lenta;
  - com o vento ligado e desligado.
- Critério: o vento não pode custar mais que 10% do fps medido antes nem passar de 33 ms no p95 do desktop.

### Hover enquanto balança

Desenhar o contorno do quadro que a árvore mostra naquele momento, no `cx, cy` do meta, com o mesmo relógio e a mesma fase. Como o contorno troca junto com o sprite, ele nunca descola da árvore. A caixa de clique é fixa.

### Desligar o vento

- Com `prefers-reduced-motion` ou com "Animações dos sprites" desligada, como no 14b: a árvore para.
- Árvore parada mostra o **quadro do meta**, não o quadro 1. Assim o mapa fica idêntico à arte original e a conferência de pixels continua valendo. É uma exceção à regra "parado = quadro 1" do 14b (decisão D6).
- Opcional: um interruptor próprio "Vento nas árvores" em Configurações, para quem quiser economizar bateria sem desligar as outras animações (decisão D4).

### Documentos e conferência

- `CRONARCA_MAPA_GRANDE.md`:
  - seção 1: arquivos novos (base sem árvores, sprites, camada de frente) e o `mapa_base.png` como gabarito;
  - seção 3: a L4 passa a ter as árvores, e sai "estáticas (a v0 não anima o vento)";
  - seção 5b: contorno do quadro atual.
- Handoff:
  - seção Sprites: grupo `arvore` no `quadros.json`;
  - tabela de portões: linhas novas.
- `scripts/conferir-mapa.cjs` passa a comparar com o vento parado contra o gabarito. Acrescenta:
  - uma conferência de que "o vento muda pixels só dentro das silhuetas das árvores";
  - a medição de fps em 1x e no Reino.
- Teste novo no Vitest, sem navegador: compor base sem árvores + sprites + camada de frente em memória e comparar com o gabarito, pixel a pixel.

---

## 4. Portões propostos

### V0. Arte e base (dono + conferência)

- **Entrega do dono:**
  - `mapa_base_sem_arvores.png`, do mesmo gerador e semente, sem as 1206 árvores da lista;
  - os 16 sprites de árvore (8 variantes x 2 quadros, 48 x 48, o mesmo pé da arte).
- **Eu confiro e entrego um relatório:**
  - dimensões e opacidade;
  - silhueta de cada sprite = interior do contorno;
  - a composição com a camada de frente calculada dá 0 px diferentes do `mapa_base.png`.
- **Aceite:** relatório com 0 px diferentes, ou a lista das diferenças para o dono corrigir no gerador.

### V1. Árvores na L4, paradas

- Árvores como sprites na L4, com recorte do que está fora da tela e ordem pelo pé, mais a camada de frente. Vento ainda desligado; cada árvore no quadro do meta.
- Clique, hover e "+N" iguais.
- `conferir-mapa` contra o gabarito e fps antes e depois.
- **Aceite visual:** capturas em 1x, 2x e 4x idênticas às atuais (0 px diferentes no `conferir-mapa`), fps dentro do critério, hover e clique iguais.

### V2. Vento (B)

- Grupo `arvore` no `quadros.json`, fase pelo id ou onda pelo x, contorno do quadro atual.
- Desligar com movimento reduzido e com a preferência (e o interruptor próprio, se aprovado).
- Docs atualizados.
- **Aceite visual:** tira de quadros e vídeo curto de uma floresta e do Reino com o vento; com movimento reduzido o mapa fica idêntico ao original; fps dentro do critério no desktop e no celular.

### V3. Mais quadros (C, futuro)

- Só arte e JSON, mais contornos gerados do sprite.
- **Aceite:** igual ao V2.

---

## 5. Decisões e perguntas para o dono

| # | Pergunta | Recomendação |
|---|---|---|
| D1 | O gerador do `mapa_base.png` existe e consegue exportar a mesma imagem sem as 1206 árvores da lista (mantendo pedras, enfeites e a linha de pinheiros da borda)? Ele também exporta os 16 sprites? Sem isso não há como seguir (seção 1.1) | Exportar pelo gerador |
| D2 | As sombras das árvores ficam pintadas na base sem árvores, ou viram sombra pela silhueta na L3b (Portão 9c)? | Na base: a sombra fica parada, o que é natural para um balanço curto, e não custa nada |
| D3 | Fase do balanço: sorteada pelo id de cada árvore, ou uma onda de vento que atravessa o mapa pelo x (mais um pequeno sorteio)? | Onda pelo x: parece rajada e não vira tique-taque |
| D4 | Desligar: só pela preferência "Animações dos sprites" e pelo movimento reduzido, ou também um interruptor próprio "Vento nas árvores"? | Interruptor próprio (mexe no modal de Configurações do Portão 13) |
| D5 | Duração dos 2 quadros | 500 ms cada, com a fase espalhando; ajustável no JSON |
| D6 | Árvore parada mostra o quadro do meta (mapa idêntico à arte), e não o quadro 1 como no 14b | Quadro do meta |
| D7 | Abordagem | B agora, C como evolução; A descartada pelo risco de degraus no pixel |
| D8 | As árvores em sprite podem tremer no clique, como as construções? | Sim, no V1, se não pesar no fps |
