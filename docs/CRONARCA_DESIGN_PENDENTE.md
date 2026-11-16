# Cronarca: o que ainda precisa de design (telas e arte)

Levantamento feito em 15/11/2026 lendo a especificação (rev 7), o registro de portões e o Figma "Cronarca - Telas" (fileKey `e6AYbKy8d1uUd5gIYC857u`).

Regra de trabalho: **o design de cada portão fica pronto antes do prompt dele**. O Claude Code implementa a partir do Figma e da arte entregue; sem isso ele improvisa, como aconteceu nos portões 16 a 18.

## 1. O que já existe no Figma
- **Telas v2** (28 frames): Início, Login, Mapa, Vila, Heróis, Expedições, Eras, 6 modais (Melhorar, Construir, Ascensão, Configurações, Ranking, Pesquisa), Catálogo de construção, versões mobile. Desktop 1440 x 900, mobile 390 x 844.
- **Componentes:** chip de recurso (6), botão (3 estilos).
- **Sprites:** árvore, recurso, aldeão (6 ofícios), **aventureiro (5 classes antigas)**, construção (10), expedição (5 destinos), evento (6), cenário, montanha, estrada, rio, terreno, névoa, ponte, arbusto, objetos de terreno, futuro (castelo, torre arcana, portal, cavaleiro, cristal).
- Outro arquivo, "Logo e ícone": mockups mobile de Início e Login.

## 2. Já foi implementado sem desenho no Figma (dívida)
O Claude Code montou estas telas por conta própria, seguindo os padrões existentes. Funcionam, mas o Figma está desatualizado e nunca passaram por design:
| Portão | Tela |
|---|---|
| 16 | Chip Objetivo, painel de objetivos, Diário, prólogo (3 cartões) |
| 17 | Cartão de Aldeões (alocação, política, chave Automática) |
| 18 | Etiqueta e modal da Falha, prévia na Ascensão |
| Ajustes | Texto de ajuda de aldeões e aventureiros |
Sugestão: registrar estas no Figma a partir das capturas em `docs/referencia/`, para o arquivo voltar a ser a fonte da verdade. Prioridade baixa, mas evita divergência futura.

## 3. O que falta, por portão
Legenda de quem faz: **Eu** = desenho no Figma e arte pixel que entrego; **CC** = só código.

### Portão 21: descoberta do QG
| Item | Tipo | Quem |
|---|---|---|
| Destino "Ruínas do Quartel General" (pin e cartão na lista de Expedições, desktop e mobile) | tela + sprite de expedição 64 px | Eu |
| Ruínas do QG no mapa (objeto na camada L4, perto da vila) | sprite | Eu |
| Estado "reerguer" (botão, custo, confirmação) | tela pequena | Eu |
| Dica do Sábio e capítulo do Diário | texto | Eu (texto), CC |

### Portão 22: QG e aventureiros unificados
| Item | Tipo | Quem |
|---|---|---|
| **Quartel General** construído (sprite do prédio, 48 ou 64 px, e variações por nível se houver) | sprite | Eu |
| **Tela do QG** com abas Tropa e Mesa de Guerra, desktop e mobile | tela | Eu |
| **Aba Tropa**: lista de guerreiros, nível, equipamento, Alojamento (capacidade) | tela | Eu |
| Decisão: a tela **Heróis** atual some, vira a aba Tropa ou convive? | decisão de design | Você e eu |
| **Contratação com escolha de classe** (seletor das 4 classes, custo, vaga) | modal | Eu |
| **Arte das 3 classes novas** (Lanceiro, Cavaleiro, Mago do Tempo), 6 quadros de 32 px | sprites | Eu |
| Ícones de classe (4) e de estado (marcha, ferido) no set de 16 px | ícones | Eu |
| Botão do QG no HUD e indicador de marcha (Lucide) | componente | Eu |

### Portão 23: Mesa de Guerra e Ecos (o maior)
| Item | Tipo | Quem |
|---|---|---|
| **Mesa de Guerra**: lista de fases, próxima destacada, vencidas com melhor resultado | tela | Eu |
| **Cartão do Eco**: tema, nível de dificuldade, poder recomendado e mínimo, **composição visível do inimigo**, regra do Eco, butim, melhor resultado | componente | Eu |
| **Preparação**: escolher guerreiros, **formação em 3 linhas** (frente, meio, trás), tática, "Poder da tropa X / mínimo Y", aviso de feridos, botão Enviar com tempo de marcha | tela (a mais complexa; no mobile precisa de interação por toque, não arrastar) | Eu |
| **Marcha**: contador no QG e indicador no HUD | componente | Eu |
| **Replay**: cenário, dois lados, barras de vida, números de dano, controles 1x/2x/pular/pausar | tela (canvas) | Eu |
| **Resultado**: vitória ou derrota, butim, XP por guerreiro, feridos, "tentar de novo" | tela | Eu |
| **Dica do Sábio após 3 derrotas** | componente | Eu |
| Arte de batalha: **variante do inimigo** das 4 classes (paleta própria para distinguir o Eco), **quadros de ataque, golpe recebido e queda** por classe, projétil (flecha, magia), efeitos do Mago (atraso e pressa), barra de vida, fonte dos números de dano | sprites | Eu |
| **Cenários por tema** (clareira, ruínas, pântano, cripta, ponte, floresta sombria) com tamanhos pequeno a enorme (tendas, torres, muralha) | sprites e composição | Eu |
| **Chefes** (a cada 10 fases): sprite maior | sprites | Eu |
| Ícones: tema, dificuldade, butim, **Fragmento de Tempo** (a decidir se é um recurso novo) | ícones | Eu |

### Portão 24: Enfermaria e derrota
| Item | Tipo | Quem |
|---|---|---|
| Enfermaria (sprite do prédio e tela: feridos, tempo de cura, custo, acelerar) | sprite + tela | Eu |
| Estado ferido visível (ícone, faixa) na Tropa e na Preparação | componente | Eu |

### Portão 25: ascensão com Bônus e avançar de era
| Item | Tipo | Quem |
|---|---|---|
| Modal de Ascensão atualizado (o que persiste: QG, tropa, relíquias) | tela | Eu |
| **Avançar de era**: tela e momento narrativo (a Falha zera, conteúdo novo) | tela | Eu |
| Novas relíquias de combate e do QG (cartões e ícones) | tela + ícones | Eu |
| **Era II**: construções, terreno, classe, equipamentos e **possivelmente um mapa novo**. É o maior item de arte do projeto | planejamento à parte | Você e eu |

### Portão 26: exploração completa
| Item | Tipo | Quem |
|---|---|---|
| Névoa por região (máscaras, bordas) a partir do set Névoa existente | sprites | Eu |
| Marcadores de pontos de interesse (relíquia do mapa, ruínas, lote) | sprites | Eu |
| Marcos de revelação (25, 50, 75, 100%) e toast de descoberta | componente | Eu |
| Lotes de construção com vantagem (indicador no mapa e no Catálogo) | tela | Eu |

### Portão 27: eventos ampliados
| Item | Tipo | Quem |
|---|---|---|
| Modal de evento com escolha (generalização do Mercador) | tela | Eu |
| Arte dos 5 eventos restantes: **já existe no Figma** (6 x 6 quadros de 64 px) | pronto | CC |

### Portão 19: construção com consequência
Ainda **sem regra desenhada**. Antes de qualquer tela é preciso uma conversa de design (o que são lotes e vizinhança, o que muda para o jogador).

## 4. Ordem de trabalho sugerida
1. **Agora, enquanto o 20b e o 20c rodam:** QG (Tropa e Mesa de Guerra), contratação com classe, arte das 3 classes novas e do prédio do QG. É o que o 21 e o 22 pedem.
2. **Depois:** Cartão do Eco, Preparação, Resultado, Marcha. Em seguida o Replay e a arte de batalha, que é o trabalho pixel mais pesado.
3. **Por último:** Enfermaria, Ascensão e avançar de era, exploração, eventos.

## 5. Decisões fechadas (15/11/2026)
- **Heróis vira a aba Tropa do QG.** Na navegação, a aba principal continua **Heróis** (mantém as 4 abas do celular). Dentro dela há duas subabas: **Tropa** (a lista de guerreiros de hoje, com Alojamento e vantagens de classe) e **Mesa de Guerra**. Antes de reerguer o Quartel, a subaba Mesa de Guerra aparece bloqueada com a dica de explorar as Ruínas.
- **Contratação continua na Taverna**, mas passa a abrir um modal de **escolha de classe** (botão "Contratar aventureiro" na aba Tropa).
- **Eco inimigo:** paleta cinza e violeta com a silhueta das classes. Nos desenhos o fundo violeta da miniatura indica isso; a arte própria do inimigo ainda precisa ser criada.
- **Fragmento de Tempo é recurso novo no HUD** (7º chip, ícone de cristal azul). O desenho do HUD com 7 chips ainda está pendente, principalmente no celular, onde a fileira já rola na horizontal.
- **Preparação no celular:** tocar no guerreiro e depois tocar na linha (frente, meio, trás). Sem arrastar.
- **Posição do QG no mapa:** arredores do tile **65, 28**, perto do Grande Lago (escolha do dono). Falta conferir olhando o mapa que o ponto está livre de árvores e construções.

## 6. Já desenhado no Figma (arquivo "Cronarca - Telas", página Telas v2)
Fileira desktop em y = 3100, fileira mobile em y = 4100, a partir de x = 6400.
| Frame | ID | Conteúdo |
|---|---|---|
| Herois - Tropa - Desktop | 153:36898 | Quartel General, subabas (agora com a terceira, Enfermaria), lista de guerreiros com classe nova e vantagens, Alojamento, resumo |
| Herois - Mesa de Guerra - Desktop | 154:37180 | Lista de fases (vencida, selecionada, bloqueada), Cartão do Eco, composição inimiga, regra, barra de poder com mínimo e recomendado, butim, Preparar tropa |
| Modal Contratar - Desktop | 154:38103 | Escolha entre as 4 classes com atributos, vence e perde, custo e Alojamento |
| Herois - Tropa - Mobile | 155:37683 | Subabas e lista no celular |
| Herois - Mesa de Guerra - Mobile | 155:38063 | Lista de fases no celular |
| Eco da fase - Mobile | 156:37921 | Folha que sobe com o Cartão do Eco |
| Modal Contratar - Mobile | 156:38313 | Folha com as 4 classes em grade 2 x 2 |
| Marcha - Desktop / Mobile | 159:38742 / 159:39301 | Tropa em marcha: tempo restante, barra de progresso, tropa enviada, aviso de que a batalha corre sozinha |
| Resultado Vitoria - Desktop / Mobile | 159:39695 / 160:40394 | Faixa Vitória, butim (ouro, pedra, Fragmento de Tempo), resumo, estado da tropa com Enfermaria, Ver replay e Próxima fase |
| Resultado Derrota - Desktop / Mobile | 159:40710 / 160:40819 | Faixa Derrota, sem butim, feridos com tempo de Enfermaria, dica baseada no Eco, Preparar de novo |
| Replay - Desktop / Mobile | 159:41705 / 159:42423 | Campo com aliados (verde) e Eco (violeta) em 3 linhas, barra de vida, popup de dano, linha do tempo, controles (Pausar, 1x, 2x, 4x, Pular), registro de eventos |
| HUD 7 recursos - Desktop / Mobile | 164:40394 / 164:40883 | Chip Fragmento de Tempo (cristal azul, contorno azul claro de destaque) como 7º recurso, com dica "Você tem 3. A próxima era pede 10". Desktop: chips reduzidos de 138 para 124 px. Mobile: a fileira rola na horizontal, mostrada já rolada até o fim |
| Heroi - Enfermaria - Desktop / Mobile | 169:40942 / 169:41598 | Terceira subaba do Quartel (Tropa, Mesa de Guerra, Enfermaria): feridos em cura com barra e Acelerar (1 erva), fila de espera com custo, terceira vaga bloqueada até o nível 5, resumo (vagas, tempo, ervas) e Melhorar |
| Eras v3 - Desktop | 173:40860 | Era I com etiquetas Ciclo e Falha, 4 objetivos do ciclo, dois destinos lado a lado (Recomeçar com Bônus ativo, Avançar de era bloqueado), relíquias e, à direita, Caminho do Tempo e cartão A Falha com medidor de 10 níveis |
| Modal Recomecar com Bonus - Desktop / Mobile | 174:41086 / 175:42237 | Transição de ciclo e de Falha (2 para 3), +7 relíquias, Reinicia e Você leva, efeito da Falha |
| Modal Avancar de Era - Desktop / Mobile | 174:41766 / 175:42600 | Era I para Era II, Falha 2 para 0, Reinicia, Você leva, Novo na Era II, requisitos |
| Eras v3 - Mobile / (rolagem) | 175:41554 / 175:41895 | Topo com objetivos e Recomeçar com Bônus; rolagem com Avançar de era, A Falha e relíquias |
| Preparacao - Desktop | 157:38298 | Modal com formação em 3 linhas x 3 espaços, reserva, tática (Ofensiva, Equilibrada, Defensiva), barra de poder com mínimo e recomendado, Marchar |
| Preparacao - Mobile | 157:38981 | Folha: toque no guerreiro e depois na linha (dica no topo, linha alvo destacada), reserva, tática, poder, Marchar |

Observações para quem implementar:
- Os sprites das classes novas usam a arte antiga (Guerreiro para Lanceiro, Clérigo para Cavaleiro, Mago para Mago do Tempo) até a arte nova chegar no Portão 22.
- Os cenários do Eco são retângulos de apoio, o cenário real é procedural com sprites existentes.
- Os ícones de ouro, ferro e Fragmento de Tempo do desenho são provisórios; usar os ícones existentes do jogo e criar o do Fragmento.
- No celular, a linha "vence / fraco contra" da Tropa ainda não está no cartão do guerreiro (falta espaço); ela aparece no modal de contratação e na Preparação.

## 7. Ainda por desenhar (próxima rodada)
Ruínas do QG e prédio do QG (arte), as 3 classes novas (arte) e as variantes do Eco (arte). Depois: exploração (mapa, Ruínas do QG, brejo de ervas) e eventos.

Nota de Preparação: os textos de tática ("sem bônus nem perdas") são provisórios; os multiplicadores reais (±20%) vêm do Portão 20 e devem ser conferidos antes de implementar. O limite de 3 espaços por linha também é provisório.

Notas de Marcha, Resultado e Replay:
- Posições no canvas: linha desktop (y 3100) segue em x 6400, 7940, 9480 (Contratar), 11020 (Preparação), 12560 (Marcha), 14100 (Vitória), 15640 (Derrota), 17180 (Replay); linha mobile (y 4100) em x 6400 a 10560, de 520 em 520.
- O replay só reproduz o registro de eventos que o servidor já calculou; os controles de velocidade e "Pular" não mudam o resultado.
- O fundo do campo é um retângulo de apoio: falta o cenário por tema e a arte das animações (ataque, golpe, queda).
- A faixa do estado da tropa assume que cada guerreiro derrotado fica ferido e vai para a Enfermaria com um tempo; os tempos mostrados são exemplos.
- A mensagem da Derrota "Quem recua não leva nada, mas também não perde recursos" é um texto de apoio: confirmar a regra no Portão 20c antes de usar.

Replay, revisão visual (15/11): os guerreiros não têm mais fundo quadrado. Cada um tem contorno de 2 a 3 px na silhueta (verde para a sua tropa, violeta para o Eco), feito no Figma com 8 sombras sem desfoque, e uma sombra elíptica no chão. No jogo isso vira um contorno gerado no canvas ou um sprite de contorno por classe, para não depender de filtro CSS. O cenário agora tem camadas: céu em degradê com estrelas e sol baixo, montanhas ao fundo, colinas, névoa, ruínas, árvores secas e chão com faixas e tufos. É o tema "Ruínas Esquecidas"; cada tema de fase precisa de uma versão própria (paleta e elementos).

Correção (15/11): o texto da Derrota dizia que quem recua não perde recursos. O spec manda o contrário: parte do butim em disputa se perde, os feridos ficam com cooldown maior e ninguém morre. Os dois frames de Derrota já foram corrigidos.

Notas de Enfermaria e HUD:
- Decidido (15/11): a Enfermaria fica dentro do Quartel, como terceira subaba. Os quatro frames do Quartel (Tropa e Mesa de Guerra, desktop e celular) já têm a aba. A versão em modal foi removida.
- Decidido: 2 vagas de cura no início; no nível 5 a Enfermaria ganha a 3ª vaga (aparece bloqueada no desenho).
- Decidido: a meta de 10 Fragmentos por era fica por enquanto, e vai crescer quando as eras forem ampliadas (inclusive a primeira).
- Valores provisórios: redução de 20% no tempo, custo de cura (24 ouro), tempos de cura e o custo de melhoria. O spec só fixa que a cura custa recurso e tempo e que ervas (da exploração do pântano) aceleram. As ervas são um recurso novo: no desenho aparecem só dentro da Enfermaria, não no HUD.
- Fragmento de Tempo no HUD mostra "3 / de 10". O 10 é exemplo; a meta real vem da regra de avanço de era. O Fragmento não é produzido por segundo, por isso o chip mostra a meta no lugar do "+x/s".

Ervas, origem em aberto (15/11): o dono quer algo ligado ao pântano. Opções levantadas: (A) expedição curta "Colher ervas" a um brejo do mapa, (B) butim da fase Pântano Cinzento, (C) uma Horta de Ervas na vila que produz aos poucos, (D) nós de coleta renováveis no mapa ao explorar o pântano. Recomendação: A com D (nó de brejo no mapa, colhido por expedição, renovável a cada tanto tempo) e deixar a Horta (C) para um upgrade tardio. A decidir antes do Portão 24.

DECIDIDO (15/11): opção D. As ervas vêm de nós de coleta renováveis no mapa, nas áreas de pântano, encontrados ao explorar. Para desenhar na rodada de exploração: o pin do brejo no mapa (disponível e esgotado, com contagem até renovar), o cartão do nó ao tocar nele (quantidade possível, tempo de renovação, quem vai colher) e o ganho no resultado da expedição. A Horta de Ervas (C) fica como ideia tardia, não planejada.

Arte das classes novas (16/11): Lanceiro, Cavaleiro (montado) e Mago do Tempo, 6 quadros de 32 x 32 px cada, mesmo formato dos aventureiros atuais (PNG com transparência, contorno escuro, sombra suave, ciclo de 6 quadros em que o 4 repete o 1). Nomes: lanceiro_1.png a lanceiro_6.png, cavaleiro_1 a 6 e mago_do_tempo_1 a 6, para a pasta apps/frontend/public/sprites/aventureiro/. Os sprites foram gerados por um script (gen.py), então ajustes de cor ou pose são rápidos. Falta trocar os placeholders do Figma por essas imagens e mapear as classes no código (SpriteAnimado).

Ascensão e Avançar de era (16/11), notas:
- As telas antigas (Eras - Desktop 84:6510, Modal Ascensao - Desktop 85:8734, Eras - Mobile 86:12976 e Modal Ascensao - Mobile 127:26404) ficam substituídas pelas v3. Elas mostravam só "Ascender de era" e não tinham a Falha nem os dois destinos do spec.
- Regras usadas: Recomeçar com Bônus (mesma era) rende relíquias (3 + 2 × (ciclo - 1), por isso +7 no ciclo 3) e sobe a Falha em um nível; Avançar de era zera a Falha, traz conteúdo novo e exige os objetivos do ciclo mais o chefe da fase 30. Nos dois, a vila reseta e ficam QG, aventureiros, relíquias, campanha e Crônica.
- Efeitos da Falha mostrados: obras e pesquisas +3% de tempo por nível e Estradas Reais e Carta Real +5% de custo por nível (valores do código atual). O Perigo da Cripta não aparece de propósito: o spec manda ligar só no Portão 25.
- O objetivo "Vencer a fase 5 × Falha" (fase 10 na Falha 2) vem do rascunho do spec e só vale depois que o combate existir. O texto do botão bloqueado de Avançar de era assume que a Era II ainda não é jogável.
- Falta decidir: o que acontece quando o jogador está no máximo da Falha (nível 10). O spec tem o texto "A Falha já está no máximo", mas a tela ainda não mostra esse estado. Também falta desenhar o resultado depois de confirmar (a tela de "novo ciclo" ou "nova era").
- Correção visual: no desktop v3 o título "Sabedoria Ancestral" já não quebra em duas linhas sobre o contador. O mesmo defeito existe nas telas antigas de Eras.
