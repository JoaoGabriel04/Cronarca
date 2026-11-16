# Cronarca: plano mestre (consolidado em 16/11/2026)

Este arquivo centraliza o que foi feito, o que está decidido e o que falta. Ele resume; o detalhe continua em `CRONARCA_DESIGN_PENDENTE.md`, `CRONARCA_REGISTRO_DE_PORTOES.md`, `CRONARCA_COMBATE_E_MAPA.md` (rev 7) e `CRONARCA_VISAO_E_DECISOES.md`.

Figma: arquivo "Cronarca - Telas", fileKey `e6AYbKy8d1uUd5gIYC857u`. Páginas: Telas (antiga), Componentes, **Sprites**, **Telas v2** (fonte da verdade das telas).

---

## 1. Estado do código (Claude Code)

| Portão | Status |
|---|---|
| 0 Ajustes rápidos | feito (dfc5238) |
| 16 Lore e objetivo | feito (82a7407) |
| 17 Alocação de ofícios | feito (sem desenho no Figma) |
| 18 Pressão, tetos e Falha | feito (sem desenho no Figma) |
| 19 Construção com consequência | sem regra desenhada; precisa de conversa de design |
| 20 Núcleo de combate (20a classes 5 para 4, 20b simulador, 20c calibragem) | **feito** (03ec0ae e 50ddcd9; 545 testes verdes, typecheck limpo). Ver 1.1 |
| 21 a 27 | não iniciados (ver seção 5) |
| Unificar animação das árvores | auditoria (Portão 0) entregue, aguardando aprovação com 5 decisões abertas; **suspenso**, substituído pela Tela inicial v2 |
| Tela inicial v2 | prompt reescrito (Opção 1); aguardando o envio |

### 1.1 Resultado do Portão 20 (relatório de 16/11)
- **20a:** classes Lanceiro (inicial), Arqueiro, Cavaleiro, Mago do Tempo; esquema 9, migração 8 para 9 (guerreiro vira Lanceiro, arqueiro e ladino viram Arqueiro, clérigo vira Cavaleiro, mago vira Mago do Tempo). A arte antiga entra por `EQUIVALENCIA_SPRITES.aventureiro`; com a arte nova basta apagar 3 linhas (Portão 22). Backend migra o save ao carregar.
- **20b:** simulador inteiro e determinístico, 3 linhas que se fecham, triângulo x1,5 a favor e x0,75 contra, Mago atrasa inimigos e acelera aliados em 10%, táticas de +-20% no dano causado e recebido, ticks de 100 ms com limite de 600 (empate vence o Eco), Poder de combate (Lanceiro nível 1 = 33; nível 20 com 6/6 = 166), `gerarEco` com E(n) em BigInt. 10 000 batalhas 6x6 em 1,1 s.
- **Desvios aceitos:** alcance do Arqueiro 4 e do Mago 3; defasagem inicial sorteada; tática aplicada direto no dano; orçamento do Eco dividido por unidade (Mago só aparece com 4 unidades, fase 21).
- **20c:** `make calibrar-combate` gera `docs/CALIBRACAO_COMBATE.md`. Multiplicadores aplicados: Média 0,95, Difícil 1,05, Muito difícil 1,10, Chefe 1,30; Fácil 0,75 e 0,80 sem mudança. **Poder mínimo 0,88 e recomendado 1,02 do Eco** (o 80% do texto antigo caiu). Vitória de tropas plausíveis: Fácil 92%, Média 60%, Difícil 17%, Muito difícil 7%, Chefe 0%.
- **Em aberto do 20:** (1) endurecimento +0,05 a cada 30 fases pode cair para +0,02 para subir Difícil (meta ~30%) e Muito difícil (~10 a 20%); (2) peso por classe no Poder (o Poder subestima Arqueiros e superestima só corpo a corpo); (3) seções 1.5 e 1.6 do `CRONARCA_COMBATE_E_MAPA.md` ainda têm os multiplicadores antigos (1,00, 1,20, 1,45, 1,70), documento é meu; (4) ninguém usa `poderMinimo` e `poderRecomendado` ainda (dependem da Mesa de Guerra); (5) produção: save real saindo do esquema 8 para o 9 ainda não visto.

Fora do código: erro de redirect OAuth (Google e Discord) é configuração de console, segue com você.

---

## 2. O que já está feito (design e arte)

### 2.1 Telas no Figma (Telas v2)
- Base: Início, Login, Mapa, Vila, Heróis, Expedições, Eras, 6 modais, Catálogo de construção e versões mobile.
- Combate: Tropa, Mesa de Guerra, Cartão do Eco, Contratar com 4 classes, Preparação, Marcha, Resultado (Vitória e Derrota), Replay, Enfermaria, HUD de 7 recursos (desktop e mobile).
- Ciclo: Eras v3, Recomeçar com Bônus, Avançar de Era, Falha nível 10, Novo ciclo, Nova era (estes três só desktop).
- Exploração: Expedições Ruínas do QG e Brejo, Mapa com pins, Resultado de Coleta de Ervas, Nó do Brejo (mobile).
- Início e Login v2 (desktop e mobile) reconstruídos com os sprites existentes do projeto, castelo novo e `fundo_inicio`. IDs: Início D 184:47341, Login D 184:47406, Início M 184:47468, Login M 184:47498.
- Placeholders de classe trocados pelos PNGs novos em Modal Contratar (154:38103 / 156:38313) e Replay (159:41705 / 159:42423).

### 2.2 Arte pixel entregue (fora do repositório ainda)
| Pacote | Conteúdo | Destino sugerido |
|---|---|---|
| sprites_classes_novas.zip | lanceiro, cavaleiro (montado), mago_do_tempo, 6 quadros 32 px | public/sprites/aventureiro/ |
| sprites_qg.zip | quartel_1-4 e ruinas_qg_1-2 (48 px) | public/sprites/construcao/ |
| sprites_extra.zip | fragmento e erva (32 px), ruinas_qg_1-4 e brejo_1-4 (64 px), brejo_esgotado_1-2, icones_classe (4), eco_{lanceiro,cavaleiro,mago_do_tempo}_1-6 | recurso/, expedicao/, icones_classe/, aventureiro/ |
| castelo novo | castelo_1-8.png (96 px, bandeiras em 8 quadros) | public/sprites/cena/ |
| fundo_inicio.png | 240x150, 1 px = 6 px do frame | public/cenas/inicio.png |

Na página **Sprites** do Figma: seção "Sprites existentes do projeto" (278 PNGs em catálogos por pasta, a partir de y=9300), coluna "Novos sprites" (x=2600: castelo, QG, recursos, expedições, ícones de classe, ecos, aventureiros) e a alternativa descartada ao fim.

### 2.3 Decisões fechadas
- Heróis vira a aba Tropa; subabas Tropa, Mesa de Guerra, Enfermaria. Contratação com escolha de classe pela Taverna.
- Fragmento de Tempo é o 7º recurso no HUD. Ervas vêm de nós de coleta renováveis no pântano (opção D); Horta de Ervas fica como ideia tardia.
- Enfermaria: 2 vagas de cura, 3ª no nível 5. Meta de 10 Fragmentos por era por ora.
- Derrota: parte do butim em disputa se perde, feridos com cooldown maior, ninguém morre.
- QG perto do tile 65, 28 (falta conferir se está livre de árvores e construções).
- Preparação no mobile: toque no guerreiro, depois na linha; sem arrastar.
- Regras: Falha máx. 10; Recomeçar rende 3 + 2 x (ciclo - 1) relíquias; só a Era I é jogável.
- **Tela inicial (Opção 1):** só sprites já existentes (pinho0, pinho1, cavaleiro, fogueira, flores, placa, cerca) + castelo novo + `fundo_inicio.png`. Nada redesenhado por mim entra além disso. SVGs antigos de castelo, cavaleiro, fogueira e placa são mortos; pinheiro, flores, cerca e arbusto migram para PNG; `icone-config` e `icone-saber` ficam.

---

## 3. O que falta: design (eu)

**Curto prazo**
1. Arqueiro: sprite de 6 quadros e `eco_arqueiro`. Depois trocar o placeholder do Arqueiro nas telas.
2. Login mobile: só tem o castelo no cabeçalho; completar a cena.
3. Falha 10, Novo ciclo e Nova era em versão mobile.
4. Ajustes: chip "Em construção" encostando no título "Reino"; aba ativa deve ser Eras nesses frames; HUD de 7 recursos nos frames de exploração; linha "vence / fraco contra" no cartão do guerreiro mobile.
5. Trocar a arte antiga do Guerreiro ainda usada em Mapa, Construir e "Selo classe" (página Telas antiga) pelas classes novas.
6. Registrar no Figma as telas feitas sem desenho (16, 17, 18) a partir de `docs/referencia/`.

**Arte de batalha (maior bloco pixel)**
- Quadros de ataque, golpe recebido e queda por classe; projétil (flecha, magia); efeitos do Mago; barra de vida e fonte dos números de dano.
- Variante Eco de cada classe com paleta própria (parcialmente feita).
- Cenários por tema (clareira, ruínas, pântano, cripta, ponte, floresta sombria), chefes (sprite maior a cada 10 fases).
- Ícones: tema, dificuldade, butim, estados (marcha, ferido), botão do QG no HUD.

**Ajustes ligados ao Portão 20**
- Atualizar as seções 1.5 e 1.6 da especificação com os multiplicadores novos e o poder mínimo 0,88 e recomendado 1,02.
- Conferir no Figma (Mesa de Guerra, Preparação, Cartão do Eco) os textos e valores de poder mínimo e recomendado, e a tática de +-20% (confirmada pelo 20b).
- Considerar mostrar na Preparação o aviso de que o Poder engana conforme a composição (só corpo a corpo, só Arqueiros).

**Portões seguintes**
- 24: arte do prédio da Enfermaria.
- 25: relíquias novas (cartões e ícones), Era II (maior item de arte, planejamento à parte).
- 26: máscaras de névoa por região, marcadores de pontos de interesse, marcos de revelação, lotes de construção.
- 27: modal de evento com escolha.
- 19: conversa de design antes de qualquer tela (lotes, vizinhança, o que muda para o jogador).

---

## 4. O que falta: Claude Code (ordem sugerida)

1. **Tela inicial v2**: enviar o novo prompt (seção 6). Substitui o Portão 2 de árvores.
2. **Importar a arte nova** no repositório (classes, QG, recursos, expedição, ecos, castelo) e mapear classes no `SpriteAnimado` (hoje as classes novas usam arte antiga: Guerreiro, Clérigo, Mago).
3. Decidir os pontos em aberto do 20 (endurecimento, peso por classe) e confirmar a migração em produção; depois seguir 21 e 22 (QG, aventureiros unificados, contratação com classe, apagar `EQUIVALENCIA_SPRITES` ao chegar a arte).
4. Substituir `docs/` pela rev 7 da especificação e incluir este plano e o registro de portões.
5. Fonte única das durações de animação (quadros_cena.json) e testes contra SVG antigo.
6. Árvores do mapa não mudam; a unificação de animação só volta se você quiser retomar depois.

---

## 5. Roteiro de portões à frente

| Portão | Conteúdo | Design pronto? |
|---|---|---|
| 19 | Construção com consequência | não |
| 20 | Núcleo de combate (20a, 20b, 20c): **feito** | sim |
| 21 | Descoberta do QG (Ruínas do QG, pontos de interesse) | sim |
| 22 | QG e aventureiros unificados, Alojamento, contratação com classe | sim (falta Arqueiro) |
| 23 | Mesa de Guerra e Ecos | telas sim; arte de batalha e cenários não |
| 24 | Enfermaria e derrota | tela sim; sprite do prédio não |
| 25 | Ascensão com Bônus, avançar de era, perigo da Cripta, relíquias | telas sim (mobile parcial); relíquias não |
| 26 | Exploração completa | parcial |
| 27 | Eventos ampliados | modal não |

Aviso: ajustes rápidos e acabamento do 17 mexem em `lib/mapa/objetos.ts` e `data/mapa.ts`; não rodar em paralelo.

---

## 6. Contexto para o novo prompt ao Claude Code

O prompt deve dizer, nesta ordem:
1. A auditoria de animação de árvores (Portão 0) está **suspensa**; a prioridade agora é a Tela inicial v2.
2. A lista fechada de sprites (Opção 1) e a proibição de qualquer sprite fora dela. Referência: `PROMPT_TELA_INICIAL_V2.md` e os frames Início/Login no Figma.
3. Pacotes de arte novos a importar, com pasta de destino (tabela da seção 2.2), cada um com aprovação por portão.
4. Classes novas: Lanceiro, Cavaleiro e Mago do Tempo passam a ter arte própria; Arqueiro mantém a antiga.
5. Regra permanente: nada é escrito sem aprovação explícita ao fim de cada portão; só os arquivos alterados são entregues; cada decisão é documentada em `docs/`.

---

## 7. Arquivos de apoio (em /home/claude)
- Documentos: `CRONARCA_PLANO_MESTRE.md` (este), `CRONARCA_DESIGN_PENDENTE.md`, `CRONARCA_REGISTRO_DE_PORTOES.md`, `CRONARCA_COMBATE_E_MAPA.md`, `CRONARCA_VISAO_E_DECISOES.md`.
- Prompts: `PROMPT_TELA_INICIAL_V2.md` (atual), `PROMPT_UNIFICAR_ANIMACAO_ARVORES.md` (suspenso), `PROMPT_PORTAO_16`, `17`, `18`, `20`, `PROMPT_PORTAO_AJUSTES_RAPIDOS.md`.
- Geradores de arte: `sprites/gen.py` (classes), `gen_qg.py`, `gen_extra.py`, `cena/gen_castelo.py`, `cena/gen_cena.py`.
