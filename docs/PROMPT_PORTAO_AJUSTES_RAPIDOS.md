# Portão: ajustes rápidos (aldeões visíveis e explicação da guilda)

Leia tudo e devolva um **plano** (auditoria + passos). **Não implemente antes da minha aprovação.** Este portão é pequeno e não depende do plano de combate.

## Contexto
A auditoria mostrou que os aldeões existem e são desenhados no mapa (Portão 8), mas só aparecem com zoom 3 ou mais, e o jogo abre na visão Reino (zoom 2). Por isso o jogador nunca vê um aldeão ao abrir o jogo. Também não há nenhum lugar que explique o que é a guilda nem a diferença entre aldeão e aventureiro.

## Ajuste 1: aldeões visíveis em qualquer zoom e largura
- **Decisão minha, que substitui a regra anterior de esconder os aldeões no Reino do desktop:** mostrar os aldeões em qualquer zoom e em qualquer largura de tela.
- Tamanho: o mesmo usado hoje na exceção do celular (32 px), com escala inteira e `image-rendering: pixelated`.
- Manter a ordenação por Y com construções e o resto da camada L4, as animações e a fase própria por id.
- Verificar e me dizer no plano: desempenho com 40 aldeões (limite da Casa 10) no Reino, sobreposição visual com construções e marcadores, e se há contorno ou área clicável que precise ajuste.
- Aventureiros parados continuam não desenhados (decisão anterior mantida).

### Ocioso no mapa (pendência do Portão 17)
O Portão 17 criou o ofício **Ocioso** (aldeão sem trabalho), mas ele ainda não aparece no mapa: `CanvasMapa.tsx` tira os ociosos da lista antes de desenhar e `POSICOES_ALDEOES` (`data/mapa.ts`) não tem lugar para ele. A arte já existe (grupo aldeão, 4 quadros).
- Dar ao Ocioso uma posição junto da fogueira (praça), com um sprite por Ocioso presente, como os outros ofícios.
- Remover o filtro que tira os ociosos antes de desenhar.
- Aldeão em deslocamento aparece já no ofício novo (regra do Portão 17).
- Confirmar no plano que a ordenação por Y, a animação e a fase por id valem para o Ocioso também.

## Ajuste 2: explicação na interface
Adicionar, em um lugar discreto e fácil de achar (por exemplo, um ícone de ajuda no cartão "Aldeões" e no painel da guilda), um texto curto. Sem emojis, só Lucide.

Texto sugerido, que você pode ajustar ao tom do jogo:
- **Aldeões:** "Gente da vila. Chegam sozinhos enquanto houver moradia e trabalham em um ofício que produz recursos."
- **Aventureiros:** "Heróis da guilda. Você os contrata, eles saem em expedições, ganham experiência e ficam mais fortes. Não ocupam moradia, mas comem."

No plano, diga onde cada texto aparece e se já existe um componente de ajuda ou tooltip reaproveitável.

## Fora do escopo
- Alocação de ofícios, mudança de classes, Quartel General, combate, ascensão e era. Tudo isso é de portões futuros.
- Não alterar os documentos em `docs/` neste portão. Eles serão substituídos por versões novas depois.

## Aceite
- Ao abrir o jogo em qualquer largura, aldeões aparecem no mapa, em qualquer zoom, inclusive os Ociosos junto da fogueira.
- Sem queda perceptível de fps com 40 aldeões.
- O texto de ajuda aparece nos dois lugares e não tem emoji.
- Sem regressão nos testes existentes.

## No plano, entregue
Lista de arquivos tocados, como ficou a regra de zoom, e qualquer risco visual que encontrar.
