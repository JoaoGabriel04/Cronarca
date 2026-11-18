# Cronarca: Registro de portões e decisões

Documento vivo. Serve para retomar o projeto em qualquer conversa sem depender de memória. Cada portão entra aqui quando é pedido, quando é implementado e quando é conferido. Atualizado em 15/11/2026.

Documentos relacionados:
- `CRONARCA_COMBATE_E_MAPA.md` (revisão 7): especificação completa de combate, Ecos, QG, exploração, eras e Falha. É a fonte de verdade onde houver divergência.
- `CRONARCA_VISAO_E_DECISOES.md`: visão geral, pilares e tom. Seções 4.1 a 4.5 e 8 estão desatualizadas.

Convenção de status: **FEITO** (implementado e conferido), **COMMITADO**, **PENDENTE** (prompt escrito, sem confirmação), **A ESCREVER**.

---

## 1. Estado do jogo hoje

- Produção: front em cronarca.vercel.app (Vercel), back em cronarca.onrender.com (Render).
- Esquema do estado: **versão 8**. v6 = aldeões (Portão 17). v7 = Falha (Portão 18b). v8 = Diário e prólogo (Portão 16). A migração de classes (Portão 20) será a **v9**.
- Testes: 497 passando no último relatório (Portão 18b). `make typecheck` ok. `conferir-mobile` ok em 360, 390, 600 e 601 px. Existe também `make conferir-falha`.
- Só a Era I é jogável. Eras 2 a 4 existem no modelo, sem conteúdo.
- Pendência técnica conhecida: `quadros.test.ts` estourou o tempo uma vez (7,3 s). Teste pesado instável. Backlog: aumentar o timeout.

---

## 2. Portões concluídos

### Portões 0 a 15 (fase anterior)
Aprovados pelo dono, incluindo: mapa grande fixo pré-renderizado (imagem + `mapa_meta.json`, igual para todos), menu/catálogo de construções por botão no HUD, Catálogo A12 confirmado, logo e ícone "Selo do relógio", login Google/Discord/credenciais, ranking com servidor como autoridade, aldeões desenhados no mapa (Portão 8).

### Auditoria de aldeões (geral)
Prompt: `PROMPT_AUDITORIA_ALDEOES.md`. Ampliada para auditoria geral do código. Achados principais:
- Aldeões existiam, mas só apareciam com zoom 3 ou mais, e o jogo abre no zoom 2. Por isso o jogador nunca via um.
- Nenhum texto explicava a diferença entre aldeão e aventureiro.
- Aventureiros tinham classe sem efeito mecânico.

### Auditoria complementar
Prompt: `PROMPT_AUDITORIA_COMPLEMENTAR.md`. Reconciliou o desenho do combate com o código real. Resultados incorporados na revisão 7 da especificação.

### Portão 17: alocação de ofícios (FEITO, 469 testes)
Prompt: `PROMPT_PORTAO_17_ALOCACAO_OFICIOS.md`.
- Novo estado real **Ocioso**.
- Alocação manual: deslocamento de 10 s (`ativoEm`), ida para Ocioso é imediata.
- **Automática ligada por padrão**, com políticas por pesos: Equilibrada 1/1/1/1/1, Comida primeiro 3/1/1/1/1, Construção 1/2/2/0/0, Pesquisa 1/1/0/3/0, Ferro 1/0/1/0/3, mais "Manter proporção atual".
- Regra de fome: com comida zerada, vai para Fazendeiro.
- Ações novas: `alocar_aldeoes`, `configurar_aldeoes`. Esquema v6.
- Efeito colateral corrigido no 18a: vila com fome estava mais lenta (19,6 contra 68,6 de comida aos 3 min).
- Ocioso ainda **não** é desenhado no mapa (depende do portão de ajustes rápidos).

### Portão 18a: Legado e eventos (COMMITADO, 2e7b028)
- Legado vira "piso de teto": teto por recurso = máximo entre capacidade do armazém/celeiro e estoque inicial com Legado.
- Ganhos de evento: máximo entre valor fixo e 10% do teto. Cometa: 3%.
- Regra do Fazendeiro ampliada: comida zero, ou saldo após chegada negativo, ou comida abaixo de 20.
- Madeira: sem mudança (o gargalo real é a pedra).

### Portão 18b: Falha (FEITO, 497 testes, aprovado, commit solicitado)
Prompt: `PROMPT_PORTAO_18_PRESSAO_TETOS_FALHA.md`.
- **Falha**: nível por jogador de 0 a 10, +1 a cada Ascensão, não retroativa (contas existentes começam em 0).
- Efeitos: tempo de obras e pesquisas +3% por nível; custo +5% por nível **somente** em Estradas Reais e Carta Real; perigo da Cripta com incremento 0 (função `perigoDestino` já existe, ativação no Portão 25 com valor calibrado).
- Migração para `falha: 0`, inclusive para quem já ascendeu.
- Tela de Eras e modal de Ascensão mostram a prévia do próximo nível. Texto: "A cada recomeço, o Relógio falha mais."
- Falha 0 é idêntica ao jogo anterior (teste compara os 10 níveis de obra).
- Descartado após auditoria: escalar custo de construção (Taverna 10 custa exatamente a capacidade máxima), meta de 40 aldeões (limite físico), perdas de evento (puniria jogo offline).
- Pendente de olho humano: ler o modal da Falha no navegador e ver se o texto fica claro para quem nunca viu o sistema.

---

### Portão 16: lore e objetivo (FEITO, commit 82a7407, conferido no GitHub)
Prompt: `PROMPT_PORTAO_16_LORE_E_OBJETIVO.md`; textos finais: `TEXTOS_PORTAO_16_FINAIS.md`.
- `data/lore.ts`: prólogo de 3 cartões e 9 capítulos do Diário (prologo, scriptorium, cartografia, estradas_reais, carta_real, cripta_vencida, aldeoes_40, primeira_ascensao, falha_3). Regra: nunca apagar um id.
- Esquema 8: `diario` (ids liberados) e `prologoVisto`, ambos atravessam a Ascensão. Migração: conta existente recebe o que já vale e não vê o prólogo de novo; quem já ascendeu (ciclo 2+) recebe a Era I inteira.
- Liberação determinística em `src/diario.ts` (`CONDICOES`), na liquidação e na ascensão; uma linha na Crônica por capítulo, sem recompensa. Ação nova `fechar_prologo`.
- `proximoPasso` (`src/objetivo.ts`, função pura): passo principal, 3 trilhas (Carta Real, Cripta, 40 aldeões) e dica do Sábio. Prioridade: fome, Carta Real, Casas cheias, Cripta (chance mínima 50%), primeiro objetivo pendente. Inclui o aviso de guardar o ouro das Estradas Reais.
- Interface: chip Objetivo (faixa fina abaixo dos recursos em menos de 1024 px), painel com as trilhas, modal do Diário, prólogo na primeira entrada, Marco da era na tela de Eras. `make conferir-lore` (1440, 601, 390, 360 px), capturas em `docs/referencia/lore`.
- Testes: game-core 193 passando (conferido por mim numa cópia). Os testes novos estão em `lore.test.ts` (20 casos) e `apps/frontend/test/diario.test.ts`.
- Observações para o futuro: o Diário e a Pesquisa usam dois ícones de livro parecidos no HUD; o espaçamento entre palavras no texto do Diário parece irregular nas capturas (a conferir no navegador real).

## 3. Conferido no repositório (GitHub, branch main, 14 commits, `main` em dia com `origin`)

Verificado em 15/11/2026 lendo os commits e o código.

### Já implementados (commits de 14/11 e 15/11)
| Commit | O que entrou |
|---|---|
| d94d7ba | **Custo contra armazém** (opção C): teto cresce no mesmo fator do custo (1,5 para 1,55), Muralha com fator 1,50, contratação de 1,6 para 1,58. Teste novo `capacidade.test.ts` falha se qualquer custo passar da capacidade |
| a52c099 | **Bug do Mercador** corrigido: o popup mostra o que se recebe, o que se paga e o prazo; termos vão no estado (`estado.mercador`, esquema 5). Novos `make evento-mercador` e `make conferir-mercador` |
| 18d0696 | Dockerfile de produção para o Render |
| 2826774 | **Logo e ícone** (Selo do relógio), **Início e Login no celular** e **cena animada** (`quadros_cena.json`). `make conferir-inicio` |
| 628b5ae | Login: botões Google e Discord mostram "Conectando…" enquanto o Render acorda (até 90 s) |
| 4b7d974 | Cartão **Aldeões** no painel da Vila, Crônica registra chegadas, Mercado nível 1 sem ouro |
| 3fc3b7e | Zoom por pinça no celular |
| a2cbf3e | Fome não trava a vila, botão Pesquisa no HUD, motivos de recusa nas expedições |
| b47b032 | Catálogo com resumo do próximo nível, Vila/Reino compacto no celular |
| f7daa5c | Toque longo sem seleção de texto, sem zoom e refresh acidentais. Também subiu a especificação de combate (rev 4) e a Visão para `docs/` |
| 1e019fb | Portão 17 |
| 2e7b028 | Portão 18a |
| f964816 | Portão 18b (Falha) |

### Árvores com vento
Resolvido no Portão 14c (entrega de árvores como sprites separados). `PLANO_VENTO_ARVORES.md` está marcado como substituído.

### Ajustes rápidos (FEITO, commit dfc5238)
Aldeões visíveis em qualquer zoom e largura, Ociosos na praça junto da fogueira, texto de ajuda sobre aldeões e aventureiros. O dono avaliou o tamanho dos aldeões (32 px, cerca de 68% da altura de uma casa) e **manteve a arte atual**. A opção de redesenhar em 24 px foi testada e descartada: a redução automática estraga rostos e ferramentas.

### Ainda NÃO implementado
- **Erro de redirect OAuth.** Nada no código resolve isso, então deve ser configuração dos consoles do Google e do Discord. Segue com você.

### Documentos do repositório desatualizados
- `docs/CRONARCA_COMBATE_E_MAPA.md` está na **revisão 4**. A atual é a **revisão 7** (a que está em `/home/claude`).
- `docs/CRONARCA_VISAO_E_DECISOES.md` está sem a nota de revisão posterior.
- Os dois precisam ser substituídos. Este registro pode entrar em `docs/` também.

---

## 4. Decisões de design fechadas (resumo)

Detalhes completos na especificação de combate, revisão 7.

**Combate**
- Automático, determinístico, calculado no servidor. Semente gerada no servidor, log de eventos, o cliente reproduz num Canvas 2D.
- Simulador no game-core.
- Ecos: vilas fictícias geradas por função pura `gerarEco(fase)`, iguais para todos.
- Dificuldade pela fase, não pelo jogador. Ciclo de 5: fácil 0,75, média 1,0, fácil 0,8, difícil 1,2, muito difícil 1,45. Chefe a cada 10 fases (1,70). +0,05 nas difíceis e chefe a cada 30 fases (teto +0,25). E(n) = 100 x 1,05^(n-1), a calibrar por simulação.
- **Poder mínimo** = 80% do poder do Eco, contado só sobre a **tropa enviada**. Também serve como "recomendado".
- Fases em sequência. Repetir uma fase rende menos.
- Derrota nunca mata: soldado fica ferido com recuperação mais longa. Enfermaria depois.

**Quartel General (QG)**
- Uma construção só, com aba Tropa e Mesa de Guerra. Descoberta cedo, por um destino novo de expedição (Ruínas do QG).
- Contratação continua na Taverna.
- Alojamento do QG fica fora da população da vila. Manutenção de comida pequena e simbólica, crescendo com o número de soldados.
- QG, aventureiros, relíquias, Crônica e campanha persistem entre ciclos e eras.

**Aventureiros**
- Aventureiro e guerreiro são a mesma unidade.
- 4 classes: Lanceiro, Arqueiro, Cavaleiro, Mago do Tempo. Mapeamento: guerreiro vira Lanceiro, arqueiro e ladino viram Arqueiro, clérigo vira Cavaleiro, mago vira Mago do Tempo.
- Contratação com escolha de classe. A arte dos 3 novos sprites (6 quadros, 32 px) fica a meu cargo.
- Fórmulas atuais: poder = 5 + 4 x nível + 3 x arma + 2 x armadura. Contratação: 40 x 1,58^n de ouro + 20 de comida. Taverna: 4 vagas + 1 por nível.

**Reset em dois destinos**
- **Ascensão ("Recomeçar com Bônus")**: mesma era, Falha +1, ganha relíquias.
- **Avançar de era**: Falha volta a 0, conteúdo novo. Exige objetivos da era e chefe da fase 30.
- Relíquias fazem o papel de bônus permanente (sem Memória do Tempo por enquanto).

**Exploração**
- Névoa por região, relíquias, Diário, temas de Eco por região.

**Ranking**
- Mantém era, ciclo e relíquias. Insere "fase mais alta" antes do desempate por quem chegou primeiro.

---

## 5. Roteiro de portões à frente

| Portão | Conteúdo |
|---|---|
| 0 | Ajustes rápidos: **FEITO** (dfc5238) |
| 16 | **FEITO** (82a7407). Lore e objetivo: Marco da era como meta visível, Sábio guiando, Diário, tela de objetivo. Usa os objetivos da Era I, a Falha e o Selo do relógio. Prompt escrito: `PROMPT_PORTAO_16_LORE_E_OBJETIVO.md` (prólogo, Diário, `proximoPasso`, chip Objetivo). Usa a próxima versão de esquema livre; migração de classes passa a ser a seguinte |
| 19 | Construção com consequência (lotes, vizinhança). **Ainda sem desenho fechado: precisa de conversa de design antes do prompt** |
| 20 | Núcleo de combate. Prompt escrito: `PROMPT_PORTAO_20_NUCLEO_DE_COMBATE.md`, em 3 sub-portões com pausa: **20a** migração de classes 5 para 4 (esquema v9, arte antiga reaproveitada); **20b** simulador puro, Poder de combate, `gerarEco(fase)` mínimo; **20c** script de calibragem e relatório (números só aplicados depois da minha aprovação) |
| 21 | Descoberta do QG (destino novo, `pontosDeInteresse` em `mapa_meta.json`) |
| 22 | QG e aventureiros unificados, Alojamento, contratação com classe, arte das 3 classes novas |
| 23 | Mesa de Guerra e Ecos |
| 24 | Enfermaria e derrota |
| 25 | Ascensão com Bônus e avançar de era; ligar perigo da Cripta; novas relíquias |
| 26 | Exploração completa |
| 27 | Eventos ampliados |
| Backlog | Simulador de ciclo inteiro com jogador automático (após o 25); timeout dos testes pesados; possível escala do Mercador |

Atenção: ajustes rápidos e qualquer acabamento do Portão 17 mexem em `lib/mapa/objetos.ts` e `data/mapa.ts`. Não rodar os dois ao mesmo tempo.

---

## 5b. Design pendente
Levantamento completo em `CRONARCA_DESIGN_PENDENTE.md` (o que falta no Figma por portão, quem faz, decisões de design em aberto). Dívida: portões 16, 17 e 18 foram implementados sem desenho no Figma.
**Desenhado em 15/11:** Tropa, Mesa de Guerra, Cartão do Eco e Contratar com escolha de classe (desktop e celular), nos IDs listados na seção 6 do arquivo de design. Decisões: Heróis vira Tropa dentro da aba Heróis; Fragmento de Tempo é recurso novo no HUD; formação no celular por toque; QG perto do tile 65, 28.

## 6. Mecânicas atuais de referência (do código)

- Aldeões: `{oficio, ativoEm?}`. Ofícios: fazendeiro, lenhador, mineiro, sábio, ferreiro, ocioso. Chegam 1 a cada 20 s até 4 x soma dos níveis das Casas (máximo 40). Fazendeiro +0,35 comida/s; demais ofícios +5% por aldeão. Consumo: 0,05 comida/s por aldeão, 0,08 por aventureiro.
- Aventureiros: nível 1 a 20, XP (vitória +2, recuo +1, nível pede 4 x nível), arma e armadura 0 a 6, estados na_vila / em_expedicao / ferido (25% por 60 s). 5 destinos fixos de expedição (30 a 300 s), grupo de até 3.
- Relíquias (6): Mãos Calejadas, Bênção da Colheita, Legado, Caminhos Eternos, Sabedoria Ancestral, Linhagem Heroica. Ganho por ascensão: 3 + 2 x (ciclo - 1). Custo total de tudo no máximo: 938 (cerca de 30 ascensões).
- Eventos a cada 10 a 20 min, entre 6: Bandidos (15% de ouro/comida, Muralha 1 anula), Incêndio, Tempestade (+30 madeira), Festival (+40 comida), Cometa (+20 saber), Mercador (100 madeira por 15 ouro, 120 s).
- Objetivos da Era I: Carta Real (Cartografia, Estradas Reais, Carta Real: 510 saber, 120 ouro, 6,5 min, exige Scriptorium), Cripta (perigo 70), 40 aldeões.
- Ranking: era, ciclo, relíquias, depois quem chegou primeiro.

---

## 7. Como manter este registro

Regra daqui em diante: a cada portão, antes de encerrar a conversa, atualizo as seções 2, 3 e 5 e entrego só este arquivo (e a especificação, se mudou). Ao fim de cada relatório do Claude Code, o status do portão passa de PENDENTE para FEITO.

**Decisões de 15/11 (Enfermaria e Fragmento):** Enfermaria dentro do Quartel como terceira subaba; 2 vagas de cura, 3ª vaga no nível 5; meta de 10 Fragmentos por era mantida por ora e deve crescer com a ampliação das eras; origem das ervas ligada ao pântano, ainda em aberto (ver CRONARCA_DESIGN_PENDENTE.md). Corrigido o texto da Derrota: parte do butim em disputa se perde, ninguém morre.
**Ervas (15/11):** decidido que vêm de nós de coleta renováveis no mapa, nas áreas de pântano (opção D). Horta de Ervas fica como ideia tardia. Define a origem antes do Portão 24; o desenho do nó entra na rodada de exploração.

**Design de 16/11:** arte em pixel das classes novas (Lanceiro, Cavaleiro, Mago do Tempo; 6 quadros de 32 px cada) entregue; telas de Ascensão (Recomeçar com Bônus) e Avançar de era desenhadas, desktop e celular, com a Falha. IDs em CRONARCA_DESIGN_PENDENTE.md.


### 16/11 - Exploração e arte restante
- Arte do QG (reerguido 4 quadros, ruínas 2 quadros) aprovada pelo Gabriel: "tá bom assim por hora".
- Entregues ícones Fragmento e Erva, ícones de classe, pins Ruínas do QG e Brejo (disponível e esgotado) e variantes Eco das classes novas.
- Telas de exploração desenhadas no Figma: destinos especiais (Ruínas do QG, Brejo de Ervas), mapa com pins e card do nó, resultado de coleta de Ervas, bottom sheet mobile. Valores (Perigo 30, chance, rendimento 3-6 Ervas, renovação) são provisórios.
- Pendências de design restantes: Falha nível 10, tela de novo ciclo/nova era após confirmação, Portão 19 (construção com consequência), HUD de 7 recursos nos frames novos, troca dos placeholders por PNGs.

- 16/11: desenhadas Falha nível 10, Novo ciclo e Nova era (desktop, valores provisórios). Pendente: mobile e Portão 19.

## Decisão: Opção 1 — sprites existentes na tela inicial
- Início/Login usam SOMENTE os sprites que já existem no projeto (pinho0/pinho1, cavaleiro, fogueira, flores, placa, cerca) + castelo novo (96px, 8 quadros) + fundo_inicio.png.
- Sprites redesenhados por mim (exceto castelo e fundo) descartados; frame "ALTERNATIVA descartada" no Figma (183:47341).
- Figma (Telas v2): frames reconstruídos nos mesmos IDs: Início Desktop 184:47341, Login Desktop 184:47406, Início Mobile 184:47468, Login Mobile 184:47498 (Login Mobile só tem castelo no cabeçalho).
- Fonte dos sprites existentes no Figma: 185:47341 (y=11900). Catálogos por pasta (aldeao, aventureiro, cena, cenario, construcao, evento, expedicao, futuro, recurso): frames "Catálogo - <pasta>" a partir de y=12340 (185:47355 a 185:47363).
- Prompt reescrito: PROMPT_TELA_INICIAL_V2.md.
- Correção de organização: staging e catálogos saíram de "Telas v2" e foram para a página "Sprites" (a partir de y=9300), com títulos de seção: sprites existentes (185:47341), catálogo por pasta (185:47355 a 185:47363) e, ao final, a alternativa descartada (183:47341). IDs não mudaram. "Telas v2" ficou só com telas.
- Novos sprites criados no design agora na página "Sprites", coluna x=2600 (y=9300): Novo - Castelo (188:3362), QG (188:3363), Recursos (188:3364), Expedições (188:3365), Ícones de classe (188:3366), Ecos (188:3367). Folhas em escala inteira; fonte: sprites_qg.zip, sprites_extra.zip, castelo_1-8.png. Ainda fora do repositório.
- Correção: faltavam na página Sprites os aventureiros novos (Lanceiro, Cavaleiro, Mago do Tempo, 6 quadros de 32 px, sprites_classes_novas.zip / gen.py). Adicionados em "Novo - Aventureiros" (189:3360), coluna x=2600. Pendente: trocar os placeholders de classe nas telas pelos PNGs.
- Placeholders de classe trocados no Figma (Telas v2) pelos PNGs novos: Modal Contratar (Desktop 154:38103, Mobile 156:38313) e Replay (Desktop 159:41705, Mobile 159:42423). Lanceiro, Cavaleiro e Mago do Tempo usam o quadro 1 em escala inteira (3x, 2x ou 1x); Eco Lanceiro usa eco_lanceiro_1. Mantidos com a arte antiga: Arqueiro (sem sprite novo), Inimigos e as telas antigas da página "Telas" (Selo classe), Mapa e Construir (instâncias Guerreiro). Fonte: frame "Fonte - Aventureiros novos" na página Sprites (191:50242).

## 16/11/2026: suspensões e decisões do Portão 20
- **Suspenso:** Portão 0 das árvores (animação unificada). As 5 decisões abertas da auditoria não serão implementadas; substituído pela Tela inicial v2 (Opção 1). Pode ser retomado depois, com nova auditoria.
- **Portão 20 (20a a 20c): aceito** (03ec0ae, 50ddcd9). Multiplicadores 0,95 / 1,05 / 1,10, chefe 1,30; poder mínimo 0,88, recomendado 1,02.
- **Decididos:** endurecimento cai de +0,05 para +0,02 (limite +0,10); peso por classe no Poder adiado, entra só um aviso de composição; `poderMinimo` e `poderRecomendado` ganham função utilizável (20d-2); migração 8 para 9 verificada offline antes do deploy (20d-3).
- Especificação de combate passa para a revisão 8 (seções 1.5, 1.5b e 1.6).
- 16/11 tarde: resultado do Portão 3 da Tela inicial ficou feio (escalas misturadas, pinheiros duplicados, castelo e cavaleiro desproporcionais). Correção: escala única 4x (3x no mobile), poucos pinheiros. Figma refeito nos mesmos IDs (Início D 184:47341, Login D 184:47406, Início M 184:47468). Fontes 4x e 3x na página Sprites, frame 185:47341. Prompt: PROMPT_TELA_INICIAL_V2_CORRECAO.md. Efeitos em canvas (estrelas, vaga-lumes, névoa, luz da fogueira) ficam como passo opcional depois.

## 17/11/2026: Tela inicial v2 fechada (portões 0 a 4)
- Commits na main: e6d55e0 (Portão 2), 8581edc (Portão 3), e568b88 (Portão 4). Escala 4x (3x no mobile), fundo largo 420x210 com sangria, sprites só da lista fechada.
- Em aberto: (1) Login mobile do projeto ainda usa cartão com selo; o Figma tem formulário em largura total com "Esqueci a senha" e "Jogar sem conta" (vira portão à parte); (2) castelo em u = 4 (1024x768 e 1280x720): bandeiras encostam no subtítulo, limitação aceita e registrada no handoff; (3) trocar a senha do Neon e atualizar o DATABASE_URL no Render.
- Segue suspensa a unificação de animação das árvores. Pendentes: portões 21 a 27 e importação da arte nova (classes, QG, recursos, expedições, ecos) no Portão 22.
- 17/11: decisões do dono: "Esqueci a senha" removido por ora (sem provedor de e-mail); "Jogar sem conta" vira conta convidado no servidor, vinculável depois (padrão proposto: convidado fora do ranking até vincular). Figma Login Desktop (184:47406) e Mobile (184:47498) atualizados: sem "Esqueci a senha" e com a legenda nova. Regra do castelo em u < 6: bloco de título ancorado acima do topo do castelo, folga mínima 8·s, sem mudar a escala do castelo. Prompt: PROMPT_PORTAO_LOGIN_E_CONVIDADO.md (portões A e B).

## 17/11 (10:41) - Decisão: regra do castelo no mobile REVISTA
- Feedback do Gabriel com prints reais (iPhone, Safari com barras): Início e Login mobile empurram os botões para baixo, abaixo da dobra ("CONTINUAR CRÔNICA" e "ENTRAR" cortados). Ele não gostou.
- Decisão: no mobile, os painéis (CTA do Início, formulário do Login) PODEM cobrir o castelo. Prioridade: todo o conteúdo interativo visível sem rolar. Substitui a regra anterior "castelo nunca coberto" (Portão A) para viewport estreito. Desktop inalterado.
- Prompt: PROMPT_MOBILE_CASTELO_SOBREPOR.md (Gate 1 proposta, aprovação antes de escrever).

## 17/11 (11:45) - Gate 1 mobile (castelo sobreposto): APROVADO
- Logo do Login 32 px abaixo de 640 px de altura (560 e 600); Início mantém 96 px.
- Aviso de provedores indisponíveis (só dev) e contraste 2,8:1 dos botões desabilitados: sem alteração (não existe em produção).
- Paisagem (844x390): fica com layout mobile e rolagem; duas colunas adiadas (DESIGN_PENDENTE).

## 17/11 (14:45) - Pendências pós Portão mobile
- IP do convidado: marcas diferentes entre Wi-Fi e dados móveis, confirmado pelo Gabriel; ligar LIMITE_CONVIDADO_IP=ligado no Render (ação do Gabriel; limite folgado por causa de CGNAT).
- Senha do Neon trocada pelo Gabriel (DATABASE_URL atualizada).
- Portão 21 iniciado: PROMPT_PORTAO_21_DESCOBERTA_DO_QG.md emitido (Gate 1 somente leitura). Telas de Figma do 21 (cartão da expedição, pin, reerguer) ficam comigo em paralelo.

## 17/11 (15:10) - Portão 21, Gate 1 APROVADO
- Tile 65,28 mantido. Estado `qg: { estado: oculto|ruinas|reerguido, desde }`, schema 10 (migração 9 para 10); fixtures de make conferir-migracao.
- Destino ruinas_qg: perigo 6, 40 s, saque pedra 12-20 / madeira 15-25 / ouro 3-6; primeiro na lista; custo de reerguer madeira 80 + pedra 20; dica do Sábio após 8 min com QG oculto. Valores em data/qg.ts.
- Decisões: (1) importar já quartel_1-4 (48 px) para o objeto reerguido; (2) passar `qg` adiante na ascensão já neste portão; (3) valores aprovados; (4) textos propostos aprovados (capítulo "O que o exército deixou", mensagem de recuo incluída); (5) destino primeiro na lista.
- Deploy: schema 10 não é lido pelo código antigo; criar branch/backup no Neon antes do deploy.
- Arte entregue ao Claude Code: sprites_qg.zip (quartel_1-4, ruinas_qg_1-2 48 px) e sprites_extra.zip (expedicao/ruinas_qg_1-4 64 px; o resto fica para o Portão 22).

## 17/11 (15:50) - Portão 21: telas no Figma (Telas v2)
- Modal Reerguer o Quartel General: desktop 208:46936, mobile 208:47641 (derivados do Modal Melhorar). Custo madeira 80 + pedra 20, "Pagamento único", botões Reerguer/Cancelar. Sprite das Ruínas 48 px (3x no desktop, 1x no mobile).
- Cartão da expedição atualizado em Expedições - Ruínas do QG e Brejo (178:42460): nome "Ruínas do Quartel General", perigo 6 · 0:40, saque pedra 12-20 / madeira 15-25 / ouro 3-6, chance 50% (exemplo), "Revela o Quartel General". O bloco Brejo e o painel de nó são de portão posterior (23+); não fazem parte do 21.
- Estados no mapa: QG no mapa - estados (208:52223): oculto, ruínas (48 px no tile 65,28), reerguido (quartel_1, 48 px). A aba do Quartel real vem no Portão 22.
- Não feito: cartão de Expedições mobile para o destino (usar o padrão dos cartões de destino existentes).

## 17/11 - Portão 22 (QG e aventureiros unificados): Gate 2 aplicado, aguardando Gate 3
- Decisões aprovadas: Alojamento [0,3,4,5,6,7] (QG nível 1 = 3); curva de comida C (cada aventureiro come 0,03 + 0,006 x (n - 1) comida/s; mais barata que os 0,08 antigos até 9 heróis); na ascensão atravessam os mais fortes até a capacidade, os demais saem da guilda com linha na Crônica (escolha manual no Portão 25); arma e armadura atravessam; preço de contratar continua contando por ciclo; soldado inicial só se ninguém atravessar; `contratar` exige a classe (cliente antigo vê "Atualize a página"); sem marcha visível até o 23.
- Esquema 11: `aventureiro.alojado` e `qg.nivel`; migração 10 para 11 (alojado false; nível 1 se o QG já estava reerguido). Ver `CHECKLIST_DEPLOY_ESQUEMA_11.md` (branch no Neon antes do deploy).
- Arte: catálogo de aventureiros agora é Lanceiro, Arqueiro, Cavaleiro e Mago do Tempo (6 quadros, 32 px); `EQUIVALENCIA_SPRITES.aventureiro` removida e as PNGs de guerreiro, clérigo, mago e ladino apagadas depois de grep e testes sem referências. Ícones de classe entregues em 32x32 (não 16x16); `sprites_extra.zip` já tinha sido apagado, usada a cópia extraída.
- Interface: aba Heróis com subabas Tropa, Mesa de Guerra e Enfermaria (as duas últimas "em breve"); painel Alojamento com a prévia "Atravessam o reset"; etiqueta Alojado; modal Contratar com as 4 classes, custo, vagas e efeito na comida.
- Não feito: botão do QG no HUD (a tropa é acessada pela aba Heróis).
- Verificação: `make test` verde (744 testes), `make typecheck` limpo, `make conferir-migracao` OK 7/0, `make calibrar-combate` sem mudança em `CALIBRACAO_COMBATE.md`. Testes de regressão antigos (conta nova, eventos de 120 min) passam a ignorar a comida, que sobe pela curva C. O projeto não tem script de lint. Verificação no navegador (convidado, contratar Cavaleiro e Mago do Tempo, sprites, Alojamento); a persistência da ascensão foi conferida pelos testes do backend. Um teste de concorrência do backend (chave repetida em paralelo) falhou uma vez e passou nas rodadas seguintes, sem relação com o portão.
- 17/11 (Gate 2 aprovado): botão do QG no HUD (Lucide Castle, sempre visível; some abaixo de 1024 px como os demais, onde vale o toque no QG do mapa). Oculto: mostra a dica das Ruínas; em ruínas: abre o modal de reerguer; reerguido: leva a Heróis (subaba Tropa). O toque no QG do mapa usa o mesmo caminho. Ícones de classe em 32x32 mantidos. Testes de comida reescritos (19,44 / 71,88 / 115,32) aprovados.
- Teste instável "a mesma chave enviada em paralelo": reproduzido em 8 de 25 rodadas isoladas; causa em investigação (corrida na idempotência do `executarAcao`), correção só com aprovação.

## 17/11 - Portão 22: corrida de idempotência corrigida (fix separado)
- Causa: no READ COMMITTED, uma requisição com a mesma chave consultava o ActionLog (chave ainda não usada), a requisição vencedora confirmava, e só então ela lia o estado já com rev novo e devolvia 409 sem reconsultar o log. Efeito: reenvio concorrente da mesma chave recebia conflito em vez da resposta guardada.
- Correção: `executarAcao` e `apagarProgresso` tomam `pg_advisory_xact_lock` por jogador no início da transação; ações e reset da mesma conta passam em fila.
- Resultado: teste isolado "a mesma chave enviada em paralelo" falhava em 8 de 25 rodadas; depois da correção, 0 em 30. Suíte completa: 747 testes verdes, typecheck limpo.
- Limite dos testes novos (rodadas repetidas e reset junto): não reproduzem a corrida quando o arquivo roda quente (15 de 15 passaram sem o lock). Quem pega a regressão é o teste isolado, rodado a frio.

## 18/11 - Portão 22: Mesa de Guerra e Enfermaria conforme o QG (fix separado)
- Bug: as duas subabas mostravam sempre "chega em breve" (`Telas.tsx`), sem olhar `qg.estado`.
- Correção: `textoDaSubaba` em `lib/casca/telas.ts`. Oculto: "Explore as Ruínas do Quartel General, ao norte da vila." e subtítulo "Bloqueada"; ruínas: "Reerga o Quartel General para liberar a Mesa de Guerra." (ou "...a Enfermaria.") e "Bloqueada"; reerguido: "em breve" de cada subaba e subtítulo "Em breve". Textos novos em `data/qg.ts`.
- Teste de front para os três estados nas duas subabas; conferido no navegador com convidado nos três estados.

## 17/11 (16:10) - Portão 22 preparado
- Portão 21 concluído e verificado (Gate 2 e 3 feitos pelo Gabriel). Aguardando commit/deploy conforme checklist do esquema 10.
- Arqueiro: o sprite já existe no repo (arqueiro_1-6, 32 px) e fica; faltava só `eco_arqueiro_1-6` (gerado pelo mesmo filtro dos outros ecos, pacote sprites_eco_arqueiro.zip, para o Portão 23).
- PROMPT_PORTAO_22_QG_E_AVENTUREIROS.md emitido (Gate 1 somente leitura). Regra nova: o registro só recebe acréscimos ao fim.

## 18/11 (10:50) - Feedback de ritmo e backlog de ideias
- Gabriel, perto da Casa nível 10: o jogo é quase só esperar, clique não resolve a lentidão, e sem combate mexer na vila cansa. Ideias novas: vila livre estilo Clash of Clans e Mercado de verdade.
- Criado CRONARCA_BACKLOG_IDEIAS.md. Regra: nada é implementado sem estar no plano e ter aprovação. Portão 19 (lotes e vizinhança) continua sendo a parte planejada da vila.
- Alojamento: decisão mantida, só entra em ação na ascensão; escolha manual de quem atravessa fica para o Portão 25.

## 18/11 (11:40) - Decisões do Gabriel sobre o backlog
- Teto de cliques: opção B (progressão de GPC). Prompt PROGRESSAO_DO_CLIQUE emitido (Gate 1 leitura). Depende da correção da previsão do cliente.
- Vila em grade com mover por toque longo no celular; Mercado com base econômica única (proposta de portão de Economia unificada antes do Mercado). Ambos só em backlog.
- Trilha: PROMPT_AUDIO_TRILHA.md emitido; faixa do plano grátis NÃO vai para o repositório nem produção.

## 18/11 (11:30) - Portão 22: Gate 3 aprovado pelo Gabriel
- Ascensão testada com heróis alojados: os guerreiros ficaram. Demais testes do checklist passaram.
- Próximo: branch de backup no Neon, ordem de push (correção B, Portões 21 e 22) e verificação em produção da migração para o esquema 11.

## 18/11 (12:00) - Gate 1 de GPC e de Áudio: decisões
- GPC: só madeira e pedra; relíquia aditiva (ganho = 1 + melhorias + 0,25 x nível); teto da Era I em GPC 3; esquema 12 com migração vazia (esquema 11 já está em produção); níveis iniciais: coletor_1 (80 saber, 90 s, GPC 2) e coletor_2 (250 saber e 40 ouro, 150 s, GPC 3, requer coletor_1), a calibrar no Gate 2.
- Obras em paralelo/fila: proposta separada (Gate 1 leitura), porque o gargalo do ritmo é a fila de obras.
- Áudio: preferência só no dispositivo; dados em lib/musica/faixas.ts; linha Música some se indisponível, Efeitos continua "em breve"; botão só no modal; Web Audio com GainNode.
- Alerta: o prompt de auditoria dos bugs não estava em docs/ para o Claude Code; conferir se a correção da previsão do cliente foi feita antes do Gate 2 do GPC.

## 18/11 (tarde) - Bugs de produção (clique, HUD, reset): conferência do que foi feito
- O PROMPT_BUGS_PRODUCAO_CLIQUE_HUD_RESET.md (18/11, ainda fora do Git) NÃO foi executado como Gate 1/2/3 por esta sessão. Os três bugs já tinham sido tratados no commit 824a3b2 (17/11, "Bugs de produção: cache entre contas, reset sem congelar, HUD sem recuo e teto de cliques explicado"), sem relatório de Gate 1 no registro. Esta entrada registra a conferência; nada foi alterado em código agora.
- Bug 3 (reset congelava, sem redirecionar): causa tratada no 824a3b2 = cache do SWR do jogo sobrevivia entre contas (sair, entrar, criar convidado) e o reset esperava fila/voo sem prazo, sem retry em 429 e sem liberar o botão. Correção: cache limpo ao sair/entrar/criar convidado; reset descarta a fila, prazo de 10 s, 3 tentativas em 429 (Retry-After) e sempre libera o botão; salvarAgora com prazo; depois de apagar o jogador fica no reino novo. Pendente: causa (c) (/auth/convidado com sessão ativa) não foi reconfirmada como tal; checklist manual em produção (reset com fila de cliques; convidado com sessão aberta) sem registro de resultado.
- Bug 2 (HUD oscilava): relógio do cliente e carimbo do servidor (agora ao sair; meia ida e volta; relógio estimado não recua em ajustes pequenos) e piso por recurso clicado em Sincronizador.exibir() enquanto o jogador clica (5 s). Pendente: o piso é uma máscara; a divergência residual entre previsão e servidor existe e é escondida, não eliminada.
- Bug 1 (clique "mais difícil"): era o teto de 5/s por objeto e 10/s por usuário, não um defeito. Decisão de 17/11 (opção A): manter o teto e explicá-lo ("Máx. N/s" e aviso na primeira vez). Superada em parte pela decisão de 18/11 (progressão do clique, GPC, opção B): os tetos de cliques/s ficam.
- Pergunta "o cliente prevê só os cliques que o servidor aceita?": SIM quanto à regra. preverAcao (game-core/src/previsao.ts) chama o mesmo aplicarAcao do servidor; o caso 'clicar' (acoes.ts:307) usa min(quantidade, balde do usuário, balde do objeto) sobre e.cliques do estado, sem regra duplicada no cliente. Não há função nova compartilhada a extrair. A diferença que resta é de tempo: a previsão usa o instante local do clique (relógio estimado) e o servidor o instante em que recebe, então os baldes recarregam um pouco diferente; o servidor vence ao responder e o piso evita o recuo na tela.
- Evidência: test/sincronia_cliques.test.ts (10 cliques/s por 10 s, latências 60, 250 e 600 ms: 0 quedas do HUD, 0 pendentes, exibido converge ao servidor com diferença < 0,5 de madeira; jitter de 80% em várias sementes: 0 quedas; ~55 de 101 aceitos). make test em 18/11: 67 arquivos, 750 passando, 2 todo.
- Não verificado: nada foi reproduzido em produção nem no navegador nesta conferência; os números acima vêm do código e da suíte.
- Para o GPC (Gate 2): o pré-requisito "previsão com o mesmo balde" está atendido na regra; o GPC novo precisa manter os testes de latência acima e acrescentar o caso com GPC > 1.

## 18/11 (tarde) - Áudio, Gate 2 aplicado (sem commit) e CORREÇÃO do Gate 1 do GPC
- Áudio Gate 2 (decisões de 18/11: preferência só no dispositivo; dados em lib/musica/faixas.ts; a linha "Música" some se indisponível, "Efeitos" continua "em breve"; botão só no modal; Web Audio com GainNode). Novo: apps/frontend/lib/musica/{faixas,estado,motor,useMusica}.ts; ModalConfiguracoes ganha a prop opcional `musica` (interruptor, volume, mudo com Music/Volume2/VolumeX); JogoAoVivo liga o hook; NEXT_PUBLIC_MUSICA (docker-compose.yml e .env.example, padrão 0); .gitignore para apps/frontend/public/musica/*.{mp3,ogg,m4a,wav,flac}; public/musica/README.md sobre a licença; test/musica.test.ts (16 testes, tom de teste WAV gerado no teste, contexto Web Audio falso). Nenhuma faixa do Suno no repositório.
- Comportamento: sem NEXT_PUBLIC_MUSICA=1 ou sem o arquivo (HEAD em /musica/vila.mp3), `disponivel` é false e nenhum controle aparece; nada é baixado até o jogador ligar a música e fazer o primeiro gesto; aba oculta leva o ganho a 0 com fade e suspende o contexto; fade de 1,5 s (entrar, sair, trocar). Faixa padrão em modo 'fluxo' (elemento <audio> no grafo); 'buffer' só para faixas de até ~90 s.
- Não verificado: som real no navegador, iOS Safari (volume, botão de silencioso, gesto) e a emenda do loop (precisa de ouvido e de uma faixa local). Manual para o Gabriel: NEXT_PUBLIC_MUSICA=1, vila.mp3 local em apps/frontend/public/musica/, ligar em Configurações, F5, aba em segundo plano, celular.
- make typecheck limpo. make test: 766 passam, 1 falha por prazo: "com jitter de 80%" em sincronia_cliques.test.ts estoura o testTimeout de 15 s nesta máquina (sem o limite roda e passa, 5/5; a falha também ocorre sem as mudanças de áudio; na primeira rodada do dia passou). É lentidão do teste, não regressão; proposta: subir o prazo só desse teste (pendente de aprovação).
- CORREÇÃO do Gate 1 do GPC (mesma data): o Gate 1 disse que as obras são "uma por vez" e que o gargalo do ritmo é a fila de obras. Está ERRADO. acoes.ts:149 só recusa obra no MESMO slot (slot_ocupado); slots diferentes constroem em paralelo. O "2h16 sem ganho a partir de GPC 2" vinha do meu bot, que esperava todas as obras terminarem. Refeito com obras paralelas (bot guloso, clica 4/s sem falha, GPC fixo emulado pelas Mãos Calejadas; é o jogador ideal): até a Casa 10: sem clicar 2h29; GPC 1 1h43 (-31%); GPC 2 1h27 (-42%); GPC 3 1h17 (-48%). Ou seja, o GPC acelera bastante; os tetos aprovados (GPC 3 na Era I) seguem valendo, e o esperar "puro" é menor do que o relatado. Pesquisa continua uma por vez (pesquisas.atual).
- Obras em paralelo: como já existem entre slots, a proposta pedida muda de natureza. Resta o que não existe: fila (reservar a próxima melhoria do mesmo slot) e pesquisa em paralelo. Pede decisão do Gabriel antes de qualquer proposta.
- GPC Gate 2: NÃO iniciado. Condição do Gabriel: confirmar antes que a correção da previsão do cliente foi aplicada. Conferência feita acima neste registro (regra compartilhada, testes de latência 60/250/600 ms passando); aguarda o aval do Gabriel de que isso basta.

## 18/11 (noite) - GPC (progressão do clique), Gate 2 aplicado (sem commit)
- Pré-requisito confirmado pelo Gabriel (aval após a conferência registrada acima). Decisões aplicadas: GPC só em madeira e pedra; relíquia aditiva (ganho = 1 + melhorias + 0,25 × nível); teto da Era I em GPC 3; esquema 12 com migração vazia, separado do 11 (que já está em produção); valores iniciais coletor_1 (80 saber, 90 s, GPC 2) e coletor_2 (250 saber e 40 ouro, 150 s, GPC 3, requer o I).
- game-core: data/pesquisas.ts (ids coletor_1 e coletor_2, campo gpc); data/formulas.ts (clique.recursosComMelhoria = madeira e pedra; clique.tetoGpcPorEra = {1: 3}); src/formulas.ts (tetoGpc, melhoriasDeGpc, ganhoCliqueMicro(estado, recurso) no lugar de ganhoCliqueMicro(nivel)); src/acoes.ts (caso 'clicar' usa o ganho do recurso); src/estado.ts (VERSAO_ESQUEMA = 12; migração 11 → 12 só muda a versão).
- Front: a previsão não mudou (já usa aplicarAcao); sincronia.ts e MapaDePreview passam o recurso a ganhoCliqueMicro (o "+N" flutuante e o rótulo "+N/s" do objeto já usam o ganho real por recurso); a tela de Pesquisa mostra "+N por clique em madeira e pedra (pesquisas até 3)" (lib/casca/modais.ts textoPorClique); as duas pesquisas entram na lista pelos ids.
- Ferro e ouro: ficam em 1, SEM Mãos Calejadas (leitura literal de "ferro e ouro ficam em 1"). Hoje a relíquia também rende em ferro e ouro; a mudança tira esse efeito. Confirmar com o Gabriel.
- Relíquias acima do teto: o teto GPC 3 vale para 1 + melhorias de pesquisa, antes das relíquias. Mãos Calejadas 10 soma +2,5, então madeira e pedra chegam a 5,5 com tudo. Confirmar se o teto deve incluir as relíquias.
- Testes: game-core/test/gpc.test.ts (ganho por recurso, aditivo, teto, custo e tempo aprovados, requisito do nível II, clicar no servidor, Forja em 1, ascensão reinicia, migração 11 → 12 idempotente); formulas, qg, taxa_cliques e modais ajustados; sincronia_cliques.test.ts ganhou GPC 3 + Mãos Calejadas 4 com latências de 60, 250 e 600 ms (0 quedas, converge ao servidor, ganho 4 por clique aceito); scripts/lib/conferir-migracao.ts confere o save do esquema 11 (só a versão muda; pesquisas e QG iguais), com teste que pega migrador defeituoso. make conferir-migracao: 7 saves sintéticos OK, "para o esquema 12". Não rodei contra o dump real.
- make typecheck limpo. make test: 783 passam, 1 falha por prazo (jitter de 80% em sincronia_cliques.test.ts, 15 s; já registrado; roda e passa sem o limite).
- Não verificado: navegador (comprar cada nível, ver o "+N por clique" subir, clicar 15 s sem queda, F5, convidado) e balanceamento real; os custos são os valores iniciais. Falta ainda o checklist de deploy do esquema 12 (Neon branch antes, como no 11).

## 18/11 (noite) - GPC, Gate 2 APROVADO: decisões e fechamento
- Ferro e ouro ficam em 1 por clique, sem relíquia. Mãos Calejadas rende só em madeira e pedra. Texto da relíquia ajustado nos dados (data/reliquias.ts: "+0,25 por clique em madeira e pedra"), no teste da tela de Relíquias e na tabela do handoff (CRONARCA_HANDOFF.md, linha das relíquias).
- O teto de GPC 3 da Era I vale só para as pesquisas, antes das relíquias. A relíquia soma por cima: máximo 5,5 em madeira e pedra (3 + 2,5). Mantido como está.
- Teste de jitter ("com jitter de 80%", sincronia_cliques.test.ts): limite subido para 30 s só nele. Causa de passar de 15 s, medida: 8 simulações de 15 s com ~8 mil `await micro()` (setTimeout real do próprio teste, ~1,2 ms cada, cerca de 10 s do total), mais ~2 s de exibir() (~0,25 ms por chamada) e ~1,4 s de clicar() (0,6 a 1,8 ms por clique, mais com latência alta por reaplicar a fila). Não é lentidão do código do jogo: o custo é do relógio falso do teste. Com o limite de 30 s, make test: 784 passam, 0 falhas.
- Commit local do GPC (Gate 2) feito separado de qualquer outra coisa; sem push, sem deploy. Ficam fora do commit: o áudio (lib/musica, .gitignore, docker-compose, .env.example, trechos de Modais.tsx/modais.module.css/JogoAoVivo.tsx), os documentos pendentes e este registro (que mistura áudio, decisões do Gabriel e GPC).
- Escrito docs/CHECKLIST_DEPLOY_ESQUEMA_12.md (Neon branch antes, commit separado do 11 já publicado, migração vazia e idempotente, plano de volta com o SQL de rebaixamento condicionado a nenhum save ter `coletor_*`). Nada dele foi executado.
- Correção no checklist 12: git log origin/main..HEAD mostra 2 commits não publicados (20cb3d5, Mesa/Enfermaria, e o do GPC), não só o do GPC; o texto da seção 3 foi ajustado.
