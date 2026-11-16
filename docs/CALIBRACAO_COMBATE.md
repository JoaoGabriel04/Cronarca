# Calibração do combate (Portão 20c)

Gerado por `make calibrar-combate` (`scripts/calibrar-combate.ts`). Sementes fixas: 11, 23, 37, 41, 59. O script só mede: os valores em uso estão em `packages/game-core/data/combate.ts` (multiplicadores e poder mínimo/recomendado aprovados pelo dono no Portão 20c). Endurecimento e peso por classe no Poder seguem em aberto.

**Como ler.** A curva de vitória é íngreme (decisão do dono: sem crítico nem erro aleatório). Então a pergunta não é "com que sorte se vence", e sim "com que preparo". Medimos:
- **tropas plausíveis**: todas as combinações das 4 classes no tamanho da tropa, cada classe numa linha que faz sentido (corpo a corpo na frente ou no meio; Arqueiro e Mago no meio ou atrás);
- **arquétipos**: razoável (a composição do Eco, linhas padrão), só corpo a corpo, só Arqueiros, Mago pesado;
- **jogador tipo**: poder E(n) repartido igualmente; o Eco é `gerarEco(n)` (mesmo tamanho de tropa);
- **limiar de poder**: a menor razão poder da tropa / poder do Eco com que a tropa vence a maioria das sementes. Abaixo dele perde, acima vence: é onde a vitória "vira".
- vencer uma fase = vencer a maioria das 5 sementes, com tática equilibrada.

## 1. Limiar de poder por tamanho de tropa

| Tropa | Tropas plausíveis | Melhor contra-escalação | Razoável | Pior | Largura (pior / melhor) | Mediana das plausíveis |
|---|---|---|---|---|---|---|
| 3 | 88 | 0,88 | 1,01 | 1,46 | 1,66x | 1,00 |
| 4 | 192 | 0,83 | 0,99 | 1,71 | 2,07x | 1,05 |
| 5 | 360 | 0,78 | 1,02 | 1,77 | 2,29x | 1,02 |
| 6 | 608 | 0,79 | 1,02 | 1,95 | 2,48x | 1,04 |
| 7 | 952 | 0,75 | 1,00 | 1,81 | 2,40x | 1,00 |
| 8 | 1408 | 0,72 | 1,00 | 1,90 | 2,62x | 0,99 |

Melhor e pior tropa de cada tamanho:

- **3**: melhor 1 Arq@1 + 2 Mag@2 (0,88); pior 1 Lan@1 + 2 Cav@0 (1,46).
- **4**: melhor 1 Lan@0 + 2 Arq@2 + 1 Mag@1 (0,83); pior 2 Lan@1 + 2 Cav@0 (1,71).
- **5**: melhor 1 Lan@0 + 3 Arq@2 + 1 Mag@1 (0,78); pior 2 Lan@1 + 3 Cav@0 (1,77).
- **6**: melhor 3 Arq@1 + 1 Cav@0 + 2 Mag@2 (0,79); pior 4 Lan@1 + 2 Cav@0 (1,95).
- **7**: melhor 3 Arq@1 + 1 Cav@0 + 3 Mag@2 (0,75); pior 4 Lan@1 + 3 Cav@0 (1,81).
- **8**: melhor 1 Lan@0 + 3 Arq@1 + 1 Cav@1 + 3 Mag@2 (0,72); pior 5 Lan@1 + 3 Cav@0 (1,90).

Arquétipos (limiar):

| Tropa | Razoável (composição do Eco, linhas padrão) | Só corpo a corpo (Lanceiros e Cavaleiros na frente) | Só Arqueiros (atrás) | Mago pesado (metade Magos no meio, Lanceiros na frente) |
|---|---|---|---|---|
| 3 | 1,01 | 1,18 | 0,98 | 1,02 |
| 4 | 0,99 | 1,35 | 1,00 | 0,99 |
| 5 | 1,02 | 1,35 | 0,88 | 1,01 |
| 6 | 1,02 | 1,35 | 0,88 | 1,06 |
| 7 | 1,00 | 1,30 | 0,95 | 1,01 |
| 8 | 1,00 | 1,33 | 0,90 | 0,99 |

Escala (tropa de 3): o limiar quase não depende do tamanho do poder; só no começo (poder pequeno, atributos pequenos) o arredondamento pesa.

| Poder do Eco | Razoável | Melhor |
|---|---|---|
| 100 | 1,00 | 0,86 |
| 400 | 1,01 | 0,88 |
| 2000 | 1,01 | 0,88 |
| 20000 | 1,01 | 0,88 |

## 2. Jogador tipo em E(n): % de tropas plausíveis que vencem, por nível

Fases 1 a 120 (todas), amostra fixa de cerca de 60 tropas plausíveis por fase.

| Nível | Multiplicador (sem endurecimento) | % das plausíveis que vencem | Razoável vence | Só corpo a corpo | Só Arqueiros | Mago pesado |
|---|---|---|---|---|---|---|
| Fácil | 0,75 / 0,80 | 92% | 100% | 40% | 100% | 100% |
| Média | 0,95 | 60% | 100% | 0% | 100% | 71% |
| Difícil | 1,05 | 17% | 0% | 0% | 25% | 0% |
| Muito difícil | 1,10 | 7% | 0% | 0% | 0% | 0% |
| Chefe | 1,30 | 0% | 0% | 0% | 0% | 0% |

Por faixa de fases (o endurecimento soma +0,05 a cada 30 fases nos difíceis, muito difíceis e chefes):

| Faixa | Fácil | Média | Difícil | Muito difícil | Chefe |
|---|---|---|---|---|---|
| 1–30 | 95% | 66% | 34% | 15% | 0% |
| 31–60 | 90% | 49% | 16% | 8% | 0% |
| 61–90 | 89% | 54% | 6% | 1% | 0% |
| 91–120 | 95% | 67% | 5% | 3% | 0% |

## 3. Multiplicador do Eco x % de tropas plausíveis que vencem (jogador tipo em E(n))

Pelos limiares da seção 1: uma tropa vence o Eco de multiplicador m quando o limiar dela é ≤ 1/m. Média simples entre os tamanhos de tropa (3 a 8).

| Multiplicador | 0,75 | 0,80 | 0,85 | 0,90 | 0,95 | 1,00 | 1,05 | 1,10 | 1,15 | 1,20 | 1,25 | 1,30 | 1,45 | 1,70 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| % das plausíveis que vencem | 95% | 89% | 81% | 70% | 62% | 44% | 30% | 20% | 7% | 2% | 1% | 0% | 0% | 0% |
| Razoável vence? | sim | sim | sim | sim | sim | às vezes | não | não | não | não | não | não | não | não |
| Melhor contra-escalação vence? | sim | sim | sim | sim | sim | sim | sim | sim | às vezes | às vezes | às vezes | às vezes | não | não |

## 4. Metas (seção 1.6, reescritas) e multiplicadores

Metas em % das tropas plausíveis que vencem com o jogador tipo em E(n) (sem endurecimento), o multiplicador que as entrega pelos limiares e o que está no código. A medição direta da seção 2 inclui o endurecimento e por isso fica abaixo nos difíceis.

| Nível | Meta | O que significa | Multiplicador pelos limiares | No código |
|---|---|---|---|---|
| Fácil | cerca de 90% | quase qualquer tropa plausível vence | 0,75 (95%) | 0,75 / 0,80 |
| Média | cerca de 60% | a composição razoável vence; tropas mal montadas, não | 0,95 (62%) | 0,95 |
| Difícil | cerca de 30% | só tropas bem montadas (contra-escalação ou formação boa) | 1,05 (30%) | 1,05 |
| Muito difícil | cerca de 10% | só as melhores contra-escalações | 1,10 (20%) | 1,10 |
| Chefe | 0% em E(n) | nem a melhor tropa vence em E(n): pede poder acima do esperado ("com preparo, sobe") | 1,45 (0%) | 1,30 |

## 5. Poder mínimo e recomendado

- **Poder mínimo** = o limiar da melhor contra-escalação: **0,88 do poder do Eco** (o maior entre os tamanhos de tropa, para nunca bloquear quem montou a melhor tropa). Abaixo disso nenhuma tropa plausível vence; a partir dele, só quem contra-escala bem. Hoje no código: 0,88.
- **Poder recomendado** = o limiar da composição razoável: **1,02 do poder do Eco**. Hoje no código: 1,02.
- **Largura da faixa** (pior / melhor): de 1,66x a 2,62x conforme o tamanho da tropa. É o quanto o planejamento vale: a mesma tropa em poder, mal montada, precisa desse fator a mais de poder para vencer.
