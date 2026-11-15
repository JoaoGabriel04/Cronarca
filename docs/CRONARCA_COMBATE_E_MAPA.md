# Cronarca: Combate e Mapa (especificação para aprovação)

Status: **revisão 4, rascunho de design, nada implementado.** Complementa `CRONARCA_VISAO_E_DECISOES.md`. Tudo aqui precisa ser conferido contra o código real pelo Claude Code (auditoria) antes de virar portão. Onde digo "DECISÃO MINHA" ou "A CONFIRMAR", é um palpite seu a validar.

## Decisões já fechadas (revisão 4)
1. **Combate e exploração são sistemas separados.** O combate acontece no **Quartel General** (QG), uma construção. A exploração do mapa serve para descobrir o QG e, depois, para economia, relíquias e lore.
2. **Quartel e QG viram uma construção só**, com duas funções: **Treino** (contratar e treinar guerreiros) e **Mesa de Guerra** (batalhas contra Ecos). Até o QG ser descoberto e reerguido, **treinar e contratar guerreiros ficam bloqueados**.
3. **O QG é descoberto cedo**, nas primeiras expedições (primeira sessão de jogo).
4. **Mudar de era reseta a vila** (construções, descobertas do mapa, recursos). **O QG permanece**, já construído na vila nova, e **os guerreiros e seus níveis também permanecem**. Como a vila nova não tem moradia nem comida para eles, o QG tem **Alojamento próprio**, fora da população da vila.
5. **Para lutar uma fase, a tropa enviada precisa de um Poder mínimo** (soma do poder dos guerreiros que vão à batalha, e não de todos os que o jogador tem).
6. Dificuldade dos Ecos acompanha a **fase**, não o jogador (Ecos iguais para todos).
7. Batalha automática com replay, calculada no servidor.
8. A campanha é **contínua** entre eras, já que os guerreiros também são.
9. **Nunca se perde guerreiro.** Não existe morte permanente. A consequência da derrota é **ferimento com cooldown maior**, curado na Enfermaria.
10. **Quatro classes desde a Era I:** Lanceiro, Arqueiro, Cavaleiro e Mago do Tempo.
11. O **soldado que a conta já recebe** entra como primeiro guerreiro quando o QG for reerguido.
12. A exploração libera **temas de Eco** por região (o laço entra).
13. **Memória do Tempo fica de fora por enquanto.** Se voltar, depende de qual bônus se trata.
14. **Ranking:** ordem por era, depois fase mais alta, com poder total como desempate.
15. **Manutenção de comida do Alojamento:** valor pequeno e simbólico desde o começo, que cresce conforme aumenta o número de guerreiros.

---

## PARTE 1. O SISTEMA DE COMBATE

### 1.1 Modelo geral
Combate **automático, determinístico e calculado no servidor**. O jogador decide **antes** (quem leva, formação, tática). O cliente só **assiste um replay** do que o servidor já calculou.

Por que assim:
- O ranking exige que o servidor seja a autoridade. Combate em tempo real no cliente é fácil de burlar.
- Funciona com o jogo fechado (a tropa marcha, luta e volta).
- Reaproveita o pipeline de sprites que já existe (SpriteAnimado, quadros, fase por id).
- A decisão do jogador fica no planejamento, que é o que você quer reforçar.

### 1.2 Como construir (stack)
Nada novo na stack, só módulos novos.

| Parte | Escolha | Motivo |
|---|---|---|
| Simulação | Módulo TS puro no backend (`combate/simular.ts`), sem Express nem Prisma dentro | Testável sozinho, rodável em lote para balancear |
| Tempo | Ticks fixos (por exemplo 100 ms de jogo por tick), sem `Date.now()` | Mesmo resultado sempre |
| Números | Inteiros (ou ponto fixo). Nada de float em dano e vida | Evita divergência |
| Aleatório | PRNG com semente (xorshift32 ou mulberry32), semente gerada **no servidor** ao despachar a marcha | Reprodutível e não manipulável |
| Saída | **Log de eventos** compacto (quem atacou quem, dano, morte, habilidade, tick) | O cliente só toca o log, não precisa resimular |
| Replay | Canvas 2D com pixel art, GSAP só para transições da tela, relógio global de sprites do Portão 14b | Sem biblioteca nova |
| Dados | Prisma: `Guerreiro`, `Batalha`, `CampanhaProgresso` (ver 1.9) | Persistir só o necessário |

DECISÃO MINHA: o cliente **não** resimula, só toca o log. Resimular no cliente exigiria código idêntico dos dois lados e traria risco de divergência.

### 1.3 Regras da batalha (rascunho)
**Atributos:** Vida, Ataque, Defesa, Alcance, Velocidade de ataque, Movimento.

**Classes e vantagens** (multiplicador de dano 1,5x a favor, 0,75x contra):
- Lanceiro vence Cavaleiro.
- Cavaleiro vence Arqueiro.
- Arqueiro vence Lanceiro.
- Mago do Tempo: suporte e dano em área pequena; atrasa inimigos e acelera aliados; muito frágil; sem relação de vantagem.

**Formação:** três linhas (frente, meio, trás). Corpo a corpo atinge primeiro a linha da frente do outro lado; arqueiros e magos atingem mais fundo. Mudar quem fica na frente muda o resultado.

**Tática** (uma por batalha): agressiva (+ataque, -defesa), defensiva (+defesa, -ataque), equilibrada.

**Habilidades:** uma por guerreiro, liberada por especialização de nível (5, 10, 15...). Nada de dezenas: cada uma precisa ser legível no replay.

**Fim:** vence quem eliminar o outro lado ou, no limite de tempo (por exemplo 60 s de jogo), quem tiver mais vida total restante.

**Tamanho da tropa enviada:** começa pequeno (por exemplo 3 guerreiros) e o limite sobe com o nível do Quartel General. O **Alojamento** do QG limita quantos guerreiros o jogador pode ter no total (a tropa enviada é só uma parte deles). Cresce o Eco, cresce a tropa, o replay continua legível.

### 1.4 Ecos: geração das vilas e das batalhas
Um Eco é **gerado por uma função pura** a partir da fase: `gerarEco(fase)`. Mesma fase, mesmo Eco, para todos os jogadores. Isso mantém o ranking honesto e dispensa guardar Ecos no banco (só se guarda exceção manual, como chefes escritos à mão).

O que a função devolve:
- **Tema** (clareira, ruínas, pântano, cripta, ponte, floresta sombria). Os temas ficam disponíveis conforme o jogador explora as regiões correspondentes na era atual (laço leve entre mapa e combate, ver Parte 2). Sem exploração, só os temas básicos aparecem. O laço está **confirmado**.
- **Poder recomendado**, vindo da curva de dificuldade (1.5).
- **Composição defensiva:** o orçamento de poder é repartido entre classes segundo o tema (pântano favorece arqueiros, cripta favorece lanceiros, e assim por diante).
- **Regra do Eco** (a "estranheza" das vilas esquecidas), da fase 10 em diante, uma por Eco: por exemplo "Névoa densa: alcance reduzido", "Chão instável: movimento lento", "Eco da memória: o primeiro golpe de cada guerreiro é dobrado".
- **Tamanho visual:** pequeno, médio, grande ou enorme, que decide quantas estruturas aparecem no cenário (poucas tendas e uma torre, ou muralha, torres e casas). É só cenário, o poder vem do orçamento.
- **Butim** possível, proporcional ao poder, com chance de Fragmento de Tempo em Ecos difíceis, muito difíceis e chefes.

**Cenário procedural:** o fundo do replay é montado em tempo de execução com os sprites que já existem (casas, muralha, tochas, árvores, pedras), usando a semente do Eco. Nenhuma imagem nova por fase.

DECISÃO MINHA: Ecos iguais para todos (determinísticos por fase), e **não** adaptados à força de cada jogador. Se adaptássemos ao jogador, quem enrolasse para ficar fraco enfrentaria Ecos mais fáceis, e o ranking perderia o sentido. A adaptação vem do **número da fase** (1.5), não do jogador.

### 1.5 Curva de dificuldade
Seu pedido: ordem fácil, média, fácil, difícil, muito difícil, e a escala acompanhar o progresso (um "fácil" na fase 101 não pode ser igual ao da fase 1, e depois da fase 30 os difíceis ficam mais difíceis).

**Ciclo de 5 fases**, repetido:

| Posição | Nível | Multiplicador do poder esperado |
|---|---|---|
| 1 | Fácil | 0,75 |
| 2 | Média | 1,00 |
| 3 | Fácil | 0,80 |
| 4 | Difícil | 1,20 |
| 5 | Muito difícil | 1,45 |

**Chefe** a cada 10 fases (substitui o "muito difícil" dessas): multiplicador 1,70.

**Poder esperado do jogador na fase n**: `E(n) = 100 × 1,05^(n-1)` (rascunho, será calibrado).

**Poder do Eco** = `E(n) × multiplicador`.

**Endurecimento:** a cada 30 fases, os níveis difícil, muito difícil e chefe ganham +0,05 no multiplicador (limite de +0,25). Os fáceis e médias **não** endurecem, para o jogador sempre ter fases em que se sente forte.

Exemplo calculado:

| Fase | Nível | Poder esperado | Poder do Eco |
|---|---|---|---|
| 1 | Fácil | 100 | 75 |
| 2 | Média | 105 | 105 |
| 3 | Fácil | 110 | 88 |
| 4 | Difícil | 116 | 139 |
| 5 | Muito difícil | 122 | 176 |
| 10 | Chefe | 155 | 264 |
| 30 | Chefe | 412 | 700 |
| 31 | Fácil | 432 | 324 |
| 34 | Difícil | 500 | 625 |
| 35 | Muito difícil | 525 | 788 |
| 40 | Chefe | 670 | 1173 |
| 100 | Chefe | 12 524 | 23 169 |
| 101 | Fácil | 13 150 | 9 863 |

A fase 101 "fácil" tem 9 863 de poder, mais de 130 vezes a fase 1 "fácil". Os números são só ilustração: o certo é **calibrar por simulação** (1.6).

**Estrutura da campanha** (fechada com a revisão 3):
- A campanha é **contínua e sem fim**, com chefe a cada 10 fases. Como os guerreiros e seus níveis atravessam as eras, a numeração das fases também não recomeça.
- A fórmula continua `E(n) = 100 × 1,05^(n-1)`, mas o crescimento do poder do jogador pode dar saltos grandes a cada era (equipamentos de nível maior, classe nova). Isso é esperado e deve ser **calibrado por simulação**, e não adivinhado.
- **Avançar de era é uma escolha do jogador.** Para liberar, ele precisa acender o Marco da era e vencer o chefe da fase 30. Pode passar disso e continuar subindo de fase antes de avançar. Cada era traz temas de Ecos novos, Névoa nova e equipamentos novos.
- Ranking: **fase mais alta**, **era** e **poder total**. A forma exata de combinar os três é decisão em aberto (Parte 4).

### 1.5b Poder mínimo para lutar uma fase
Para **tentar** uma fase, a tropa enviada precisa de Poder mínimo. Isso impede o jogador de ir a uma fase impossível com tropa fraca e liga o treino à campanha.

**Regras:**
- Conta o **Poder da tropa enviada** (soma do poder de cada guerreiro que vai), e não o total de guerreiros que o jogador tem.
- Dois valores por fase: **mínimo** (abaixo dele o botão "Enviar tropa" fica bloqueado) e **recomendado** (o poder do Eco, que dá boa chance de vitória).
- Rascunho: `mínimo = 80% do poder do Eco`. Esse fator é ajustado por simulação, de forma que o mínimo corresponda a uma chance de vitória ainda real (algo como 20% a 25%), e não impossível.
- O mínimo só **pesa** nas fases difíceis, muito difíceis e chefes. Nas fáceis, o jogador típico já passa.
- Para tentar a fase n, é preciso ter vencido a n-1. Fases já vencidas podem ser refeitas (butim reduzido, ver Repetição).

| Fase | Nível | Poder do Eco (recomendado) | Mínimo (80%) | Poder esperado do jogador |
|---|---|---|---|---|
| 1 | Fácil | 75 | 60 | 100 |
| 4 | Difícil | 139 | 111 | 116 |
| 5 | Muito difícil | 176 | 141 | 122 |
| 10 | Chefe | 264 | 211 | 155 |
| 30 | Chefe | 700 | 560 | 412 |

**Como o Poder é calculado:** uma única função, no servidor, que resume vida, ataque, defesa, nível e equipamento de cada guerreiro num número. A **mesma função** serve ao mínimo, ao recomendado e à calibragem, e é definida no portão do simulador (20). Se ela não refletir bem a chance real de vitória, o requisito engana, por isso precisa ser validada por simulação.

**Tela:** na Preparação aparece "Poder da tropa 118 / mínimo 141". Faltando poder, o botão fica bloqueado e a tela mostra **quanto falta** e sugere o caminho (quem treinar, o que equipar). Quem trava num difícil precisa saber o que fazer.

**Risco a vigiar:** o ritmo de crescimento do poder esperado precisa ser calibrado para quem investe com regularidade passar o muro sem sofrimento. Se parecer parede, o jogador desiste.

**Ajuda quando trava** (sem facilitar o Eco): após 3 derrotas seguidas na mesma fase, o Sábio mostra uma dica (classes favorecidas, regra do Eco) e sugere uma composição. O Eco continua igual.

**Repetição:** refazer uma fase já vencida dá butim reduzido e sem XP extra de primeira vitória, para não virar farm infinito e não furar a economia.

### 1.6 Calibragem por simulação
Como a simulação é pura e determinística, dá para rodar milhares de batalhas em lote no servidor e **ajustar o poder recomendado até a taxa de vitória ficar onde queremos**, com um jogador "tipo" (poder igual a E(n), composição razoável):

| Nível | Meta de vitória (rascunho) |
|---|---|
| Fácil | cerca de 85% a 90% |
| Média | cerca de 65% |
| Difícil | cerca de 45% |
| Muito difícil | cerca de 25% a 30% |
| Chefe | cerca de 15% a 25% (com preparo, sobe) |

Isso vira um script de balanceamento no repositório, não só um número no código.

### 1.7 Guerreiros: progressão, consequências e eras
- **Treino** no Quartel General, aba Treino: comida, ferro e tempo. Bloqueado até o QG ser descoberto e reerguido.
- **Alojamento do QG:** os guerreiros moram no QG, não na população da vila. A capacidade sobe com o nível do QG. Cada guerreiro tem uma manutenção de comida **pequena e simbólica desde o começo**, que cresce conforme aumenta o número de guerreiros (a curva exata é calibrada no portão do QG). Se o Alojamento estiver cheio, é preciso subir o QG ou dispensar alguém.
- **XP** por batalha vencida (e um pouco menos por derrota). Nível sobe atributos e libera especialização.
- **Equipamento** da Forja: liga economia e combate.
- **Estados:** disponível, em marcha, ferido (com data de cura). Não existe estado de perda permanente.
- **Derrota:** os guerreiros que lutaram ficam **feridos, com cooldown maior que o de uma vitória apertada**, e só voltam a ser enviados depois de curados. Cura na Enfermaria, com custo e tempo. Parte do butim em disputa se perde. O guerreiro nunca morre.
- **Poder de cura:** o tempo de cura depende da Enfermaria (nível) e de recursos como ervas, que vêm da exploração do pântano. Os valores exatos são trabalhados no portão da Enfermaria.
- **Ponto para discutir depois:** como não há perda permanente, a pressão da derrota vem do cooldown e do custo da cura. Se isso ficar leve demais, a **contratação** de guerreiros (custo e tempo de treino) pode ser calibrada como o principal custo de manter um exército grande.
- **Nunca** se perde construção, vila ou progresso de fase por causa de batalha.

**O que acontece ao avançar de era:**
- **Reseta:** construções, descobertas do mapa, recursos e população da vila.
- **Permanece:** o QG (com seu nível), os guerreiros com seus níveis e equipamentos, o progresso da campanha.
- **Novas eras** trazem uma classe nova e equipamentos de nível maior. O poder total pode crescer muito a cada era, e os Ecos acompanham pela curva de dificuldade (1.5). Isso dá novo gás ao jogo sem apagar o que o jogador construiu nos guerreiros.
- **Memória do Tempo** (pontos por era concluída, gastos em bônus permanentes) fica **de fora por enquanto**. Só voltamos a ela se o reset parecer só perda, e depende de qual bônus seria.
- **Efeito colateral aceito:** como guerreiros não competem mais pela população da vila, o dilema "aldeões ou guerreiros" perde força. Ele continua existindo nos recursos de treino e na manutenção de comida.

### 1.8 Telas (todas pensadas para celular de 390 px também)
1. **Quartel General (botão no HUD ou toque na construção):** abre duas abas, **Treino** e **Mesa de Guerra**. A Mesa de Guerra lista as fases (a próxima destacada, as já vencidas com seu melhor resultado). Nada de arrastar o mapa para lutar.
2. **Cartão do Eco:** tema, nível (fácil/média/difícil/muito difícil/chefe), poder recomendado, classes favorecidas, regra do Eco, butim possível, melhor resultado seu.
3. **Preparação:** escolher guerreiros (com estado e nível), arrastar para a formação, escolher tática, ver "Poder da tropa X / mínimo Y" (1.5b), e um aviso se algum estiver ferido. Botão "Enviar tropa" mostra o tempo de marcha.
4. **Marcha:** contador no QG (e um indicador discreto no HUD) com o tempo restante, opção de ver o replay quando a tropa chegar. O tempo de marcha depende da fase (curto nas fáceis, maior nas difíceis), não de distância no mapa.
5. **Replay:** canvas com o cenário procedural, os dois lados, barras de vida, números de dano discretos. Controles: velocidade 1x/2x, pular, pausar. Duração alvo de 20 a 40 s.
6. **Resultado:** vitória ou derrota, butim, XP por guerreiro, feridos, o que a derrota custou, botão "tentar de novo" e "voltar ao mapa".
7. **Quartel:** lista de guerreiros, treinar, subir de nível, escolher especialização, equipamento.
8. **Enfermaria:** feridos, tempo de cura, custo, acelerar com recurso.

Sem emojis, só Lucide. Pixel art com `image-rendering: pixelated` e escala inteira.

### 1.9 Dados (rascunho de modelos)
- `Guerreiro`: id, userId, classe, nivel, xp, estado, feridoAte, equipamento (JSON), especializacao. Pertence ao jogador e **atravessa as eras**.
- `Batalha`: id, userId, fase, semente, formacao (JSON), tatica, resultado, logEventos (JSON compacto), marchaTerminaEm, resolvida.
- `CampanhaProgresso`: userId, melhorFase, faseAtual, derrotasSeguidas, eraAtual.
- `QuartelGeneral`: userId, nivel, capacidadeAlojamento, tamanhoMaxTropa (ou derivados do nível).
- O Eco **não** é guardado: sai de `gerarEco(fase)`.

Nota: a auditoria precisa verificar o que já existe de "expedição" e "aventureiro" no código, porque podem se sobrepor à marcha de tropas. Se já houver uma mecânica de expedição com tempo, reaproveitar em vez de duplicar.

---

## PARTE 2. EXPLORAÇÃO DO MAPA (independente do combate)

O mapa continua sendo o espaço de descoberta e economia. O combate saiu dele e mora no QG. Isso resolve o problema do mapa finito: a exploração tem fim por era, e a campanha de combate não depende dela.

### 2.1 Ideia central
**A Névoa cobre o mapa no começo de cada era.** Explorar é recuar a Névoa. Cada região revelada oferece recursos, lotes de construção, relíquias e lore. A primeira grande descoberta é o **Quartel General**.

### 2.2 O Quartel General como marco de exploração
- Fica numa região **próxima da vila**, alcançável na **primeira ou segunda expedição**, para o jogador liberar o combate já na primeira sessão.
- O Sábio dá a dica ("as pedras do norte guardam algo") se o jogador demorar.
- Ao revelar o local, aparecem as **Ruínas do Quartel General**. O jogador paga um custo inicial baixo para **reerguer**, e a partir daí treino e Mesa de Guerra funcionam.
- Nas eras seguintes, o QG já aparece construído, sem precisar redescobrir.

### 2.3 Como a exploração funciona
- No começo da era só a área da vila está revelada. O resto é Névoa (o Portão 9 já previa pins e névoa).
- **Expedições** (aventureiros ou batedores) revelam regiões, com tempo proporcional à distância e algum risco. A auditoria precisa ver o que já existe de expedição no código.
- Cada expedição tem **custo de oportunidade**: quem sai deixa de produzir.

### 2.4 Regiões e o que cada uma dá
O mapa atual tem material para isso (rios, lago, pântano, cripta, florestas, minas, pontes, estradas, montanhas e Easter eggs).

| Região | Recurso ou vantagem | Tema de Eco liberado |
|---|---|---|
| Campos perto da vila | Comida, o QG | Clareira |
| Florestas | Madeira rara | Floresta sombria |
| Montanhas e minas | Ferro e pedra | Ruínas |
| Pântano | Ervas (cura mais barata) | Pântano |
| Lago e rios | Pesca, rotas | Ponte |
| Cripta | Fragmentos de Tempo | Cripta |

### 2.5 Razões para explorar fora do combate
- **Ruínas e relíquias:** lore em texto curto e sombrio, recursos únicos ou Fragmentos de Tempo, uma vez por era.
- **Easter eggs** existentes viram descobertas premiadas.
- **Lotes de construção:** regiões reveladas liberam lotes com vantagem (mineração perto de pedra, Serraria junto à floresta).
- **Diário do Cronarca:** a lore em fragmentos achados no mapa.
- **Marcos de revelação** (25%, 50%, 75%, 100%) com recompensas.
- **A Névoa volta a cada era**, cobrindo de novo e com mudanças (a cripta se transforma, o pântano avança), então explorar de novo continua valendo.

### 2.6 O que isso exige do mapa atual
- Camada de **névoa** por região.
- Lista de **pontos de interesse** (QG, relíquias, lotes, regiões) num JSON ao lado do `mapa_meta.json`.
- Culling e desempenho com as mesmas regras das árvores.
- Nada disso exige refazer a imagem do mapa.

---

## PARTE 3. COMO ISSO ENTRA NOS PORTÕES

Cada um com auditoria, plano e aprovação antes de implementar:

1. **Auditoria geral** (aldeões e soldado, já entregue) **mais** o que existe de expedição, aventureiro, névoa, pins, transição de era e do que fica ou reseta hoje.
2. **16. Lore e objetivo** (Marco da era, Diário).
3. **17. Aldeões e ofícios.**
4. **18. Pressão** (manutenção, tetos, a Névoa como ameaça).
5. **19. Construção com consequência** (lotes, vizinhança).
6. **20. Núcleo de combate** (simulador puro com testes, sem tela), **função de Poder** e **script de calibragem** (inclui o fator do mínimo). Não depende de mapa nem de QG.
7. **21. Exploração mínima e descoberta do QG:** Névoa, expedição, Ruínas do QG, reerguer. É o que libera o combate para o jogador.
8. **22. Quartel General: Treino, Alojamento e guerreiros** (classes, XP, estados, capacidade).
9. **23. Mesa de Guerra e Ecos:** gerarEco, cartão, **Poder mínimo e recomendado**, preparação, marcha por fase, replay, resultado.
10. **24. Derrota e consequências** (feridos, perdas).
11. **25. Avançar de era:** reset da vila, QG e guerreiros que permanecem, novos equipamentos e classe da era, Marco.
12. **26. Exploração completa:** relíquias, Diário, lotes, marcos, Névoa de volta a cada era.
13. **27. Eventos com escolha ampliados.**

O 20 vem antes das telas porque o simulador testado e calibrado é a parte mais arriscada.

---

## PARTE 4. ESTADO DAS DECISÕES

**Todas as perguntas abertas foram respondidas** (ver "Decisões já fechadas" no topo, itens 1 a 15).

Ficam para trabalhar **dentro dos portões**, não antes:
1. Fórmula do Poder e fator do mínimo (portão 20, por simulação).
2. Curva da manutenção do Alojamento e capacidade por nível do QG (portão 22).
3. Valores de cura, cooldown e custo de contratação (portão da Enfermaria e do Treino). Atenção especial ao equilíbrio sem perda permanente.
4. Tempos de marcha por fase (portão 23).
5. Atributos e habilidades das quatro classes (portão 22).
6. Eventual retorno da Memória do Tempo, caso o reset pareça só perda.

**Antes do primeiro portão de implementação:** rodar a **auditoria geral** (`PROMPT_AUDITORIA_ALDEOES.md`, ampliada), para confirmar no código o que o documento supõe.
