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

## 17/11/2026: Portão A (Login mobile, convidado desabilitado, folga do castelo)
- Auditoria (A0): "Esqueci a senha" e o texto antigo do convidado já não existiam no código; "Jogar sem conta" também não. Só havia o comentário em `login/page.tsx` e o handoff.
- Feito: Login mobile do Figma (sem pergaminho nem selo, 350 de largura); "Jogar sem conta" desabilitado com a legenda, nos dois layouts; bloco de título acima do topo do castelo com folga mínima de 8·z (leitura de "8·s": s = z = u/6, ou seja, 8 px do frame; confirmar); `conferir-inicio` com a folga, o convidado e o cartão dentro da tela.
- Medidas: folga 6,0 px de tela em u = 4 (mínimo 5,3), 24,0 em u = 6, 10,0 em u = 7 (mínimo 9,3). Testes: 607 no `make test`, typecheck limpo.
- Pendente: Portão B (conta convidado no servidor); ranking sem convidado segue como padrão proposto.

## 17/11/2026: Portão B (conta convidado) implementado, aguardando aprovação
- B0 e B1 aprovados; plano e decisões em `docs/CRONARCA_PORTAO_B_CONVIDADO.md`. Migração `20261117120000_convidado` (e-mail opcional, `convidado`, índice), verificada offline.
- Backend: criação com teto total no banco, vínculo por e-mail e por Google/Discord (duas etapas), limpeza agendada, ranking sem convidado. Front: botão habilitado, aviso no jogo (uma vez por sessão), modal de vínculo (reaproveita `Modal`), Configurações e Ranking com o convite a vincular.
- Pendente de deploy: aplicar a migração em produção (`prisma migrate deploy`) antes de subir o código; conferir os registros de proxy do Render antes de ligar `LIMITE_CONVIDADO_IP`. Portão A segue aguardando o aceite do dono.
- 17/11: **Portões A e B aceitos pelo dono.** Sem commit ainda. Falta: aplicar a migração `20261117120000_convidado` em produção antes do deploy do código e conferir os registros de proxy do Render antes de ligar `LIMITE_CONVIDADO_IP`.
