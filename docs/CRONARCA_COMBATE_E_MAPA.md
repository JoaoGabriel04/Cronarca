# Cronarca: Combate e Mapa (especificação para aprovação)

Status: **revisão 8 (16/11/2026).** Seções 1.5, 1.5b e 1.6 atualizadas com a calibragem do Portão 20c; o resto segue como na revisão 7. Complementa `CRONARCA_VISAO_E_DECISOES.md` e já incorpora o que a auditoria do código encontrou. Onde digo "DECISÃO MINHA" ou "A CONFIRMAR", é um palpite seu a validar.

## Decisões já fechadas (revisão 7)
1. **Combate e exploração são sistemas separados.** O combate acontece no **Quartel General** (QG), uma construção. A exploração do mapa serve para descobrir o QG e, depois, para economia, relíquias e lore.
2. **Aventureiro e guerreiro são a mesma unidade.** O sistema de aventureiros que já existe (nível, XP, arma, armadura, estados, guilda, expedições) é **evoluído**, e não duplicado. As expedições continuam como exploração e saque, e os Ecos usam os mesmos aventureiros. O nome na interface ("guerreiro" ou "aventureiro") é decidido no portão 22.
3. **A contratação continua aberta** (Taverna, como hoje). O QG, quando descoberto e reerguido, libera a **Mesa de Guerra** (batalhas contra Ecos), o limite da tropa enviada e o Alojamento persistente.
4. **O QG é descoberto cedo**, na primeira ou segunda expedição, por um destino novo no sistema de expedições que já existe.
5. **Um único reset, com dois destinos** (seção 1.10): **Ascensão** ("Recomeçar com Bônus", mesma era, com a **Falha** subindo e deixando o próximo ciclo mais difícil) e **Avançar de era** (conteúdo novo e **Falha zerada**). A vila reseta nos dois casos. **QG, aventureiros com seus níveis, relíquias, Crônica e progresso da campanha permanecem.**
6. **Alojamento do QG:** os aventureiros que atravessam o reset moram no QG, fora da população da vila (a Taverna já funciona assim hoje durante o ciclo).
7. **Para lutar uma fase, a tropa enviada precisa de um Poder mínimo** (soma do poder dos que vão à batalha, e não de todos os que o jogador tem).
8. Dificuldade dos Ecos acompanha a **fase**, não o jogador (Ecos iguais para todos). A Falha **não** afeta a campanha de Ecos.
9. Batalha automática com replay, calculada no servidor, com o simulador no **game-core** (onde já vivem as regras puras, o PRNG e os testes).
10. **Nunca se perde aventureiro.** A derrota gera ferimento com cooldown maior, curado na Enfermaria.
11. **Quatro classes:** Lanceiro, Arqueiro, Cavaleiro e Mago do Tempo. As cinco atuais (guerreiro, arqueiro, mago, ladino, clérigo) não têm efeito mecânico hoje, só nome e arte, então a migração de saves (versão 6 do esquema) é só de nome. A arte de Lanceiro, Cavaleiro e Mago do Tempo (6 quadros de 32 px cada) é gerada por mim com o pipeline de sprites. Mapeamento na seção 1.3.
12. O soldado inicial (aventureiro da classe guerreiro) já é o primeiro guerreiro, não precisa de regra especial.
13. A exploração libera **temas de Eco** por região.
14. **As relíquias já cumprem o papel de bônus permanente.** Não criamos Memória do Tempo.
15. **Ranking:** mantém era, ciclo e relíquias, e **fase mais alta** entra antes do desempate por quem chegou primeiro.
16. **Manutenção de comida:** pequena e simbólica desde o começo, crescendo conforme o número de aventureiros (hoje é 0,08/s cada; ajustar no portão do QG).
17. Aldeões visíveis em qualquer zoom e largura: tratado no portão pequeno de ajustes (`PROMPT_PORTAO_AJUSTES_RAPIDOS.md`).

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
| Simulação | Módulo TS puro no **game-core** (`packages/game-core`), onde já vivem regras puras, PRNG com semente e testes | Testável sozinho, rodável em lote para balancear, mesma base das regras que o servidor já usa |
| Tempo | Ticks fixos (por exemplo 100 ms de jogo por tick), sem `Date.now()` | Mesmo resultado sempre |
| Números | Inteiros (ou ponto fixo). Nada de float em dano e vida | Evita divergência |
| Aleatório | PRNG com semente (xorshift32 ou mulberry32), semente gerada **no servidor** ao despachar a marcha | Reprodutível e não manipulável |
| Saída | **Log de eventos** compacto (quem atacou quem, dano, morte, habilidade, tick) | O cliente só toca o log, não precisa resimular |
| Replay | Canvas 2D com pixel art, GSAP só para transições da tela, relógio global de sprites do Portão 14b | Sem biblioteca nova |
| Dados | O estado do jogador já é **JSON versionado**, sem tabelas por entidade. Novos blocos entram nele (ver 1.9) | Persistir só o necessário, migração simples |

DECISÃO MINHA: o cliente **não** resimula, só toca o log. Resimular no cliente exigiria código idêntico dos dois lados e traria risco de divergência.

### 1.3 Regras da batalha (rascunho)
**Atributos:** Vida, Ataque, Defesa, Alcance, Velocidade de ataque, Movimento.

**Classes e vantagens** (multiplicador de dano 1,5x a favor, 0,75x contra):
- Lanceiro vence Cavaleiro.
- Cavaleiro vence Arqueiro.
- Arqueiro vence Lanceiro.
- Mago do Tempo: suporte e dano em área pequena; atrasa inimigos e acelera aliados; muito frágil; sem relação de vantagem.

**Migração das cinco classes atuais para as quatro** (rascunho, o plano do Claude Code confirma). Como a classe não tem nenhum efeito mecânico hoje (o poder ignora a classe, arma e armadura são iguais para todas), o mapeamento é só de nome e arte:

| Hoje | Passa a ser | Motivo |
|---|---|---|
| guerreiro | Lanceiro | linha de frente, corpo a corpo (e é a classe inicial) |
| arqueiro | Arqueiro | igual |
| ladino | Arqueiro | leve e ágil, sem duplicar o Mago |
| clérigo | Cavaleiro | armado e pesado, sem duplicar o Mago |
| mago | Mago do Tempo | igual |

Nível (1 a 20), XP, arma e armadura (0 a 6) são mantidos. O que muda no código: lista de classes e classe inicial no game-core, esquema do estado (`z.enum`) com migração de versão, quadros e sprites, telas e marcadores, e testes. Sem a migração, todo save antigo seria recusado.

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
| 2 | Média | 0,95 |
| 3 | Fácil | 0,80 |
| 4 | Difícil | 1,05 |
| 5 | Muito difícil | 1,10 |

**Chefe** a cada 10 fases (substitui o "muito difícil" dessas): multiplicador 1,30.

**Poder esperado do jogador na fase n**: `E(n) = 100 × 1,05^(n-1)`. Multiplicadores calibrados no Portão 20c (antes: 1,00 / 1,20 / 1,45 e chefe 1,70, que tornavam difícil, muito difícil e chefe impossíveis para o jogador tipo: 0% de vitória).

**Poder do Eco** = `E(n) × multiplicador`.

**Endurecimento:** a cada 30 fases, os níveis difícil, muito difícil e chefe ganham +0,02 no multiplicador (limite de +0,10; era +0,05 até +0,25, decidido em 16/11 por deixar o difícil abaixo da meta). Os fáceis e médias **não** endurecem, para o jogador sempre ter fases em que se sente forte.

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

**Estrutura da campanha** (fechada):
- A campanha é **contínua e sem fim**, com chefe a cada 10 fases. Como os aventureiros e seus níveis atravessam o reset, a numeração das fases também.
- A fórmula continua `E(n) = 100 × 1,05^(n-1)`, mas o crescimento do poder do jogador pode dar saltos grandes a cada era (equipamentos de nível maior, classe nova). Isso é esperado e deve ser **calibrado por simulação**, e não adivinhado.
- **Avançar de era** exige o chefe da fase 30 da era, além dos objetivos do ciclo (seção 1.10). O jogador pode passar disso e continuar subindo de fase antes de avançar.
- Ranking: **era, ciclo, relíquias, fase mais alta**, e por fim quem chegou primeiro.

### 1.5b Poder mínimo para lutar uma fase
Para **tentar** uma fase, a tropa enviada precisa de Poder mínimo. Isso impede o jogador de ir a uma fase impossível com tropa fraca e liga o treino à campanha.

**Regras:**
- Conta o **Poder da tropa enviada** (soma do poder de cada guerreiro que vai), e não o total de guerreiros que o jogador tem.
- Dois valores por fase: **mínimo** (abaixo dele o botão "Enviar tropa" fica bloqueado) e **recomendado** (o poder do Eco, que dá boa chance de vitória).
- Calibrado (20c): **mínimo = 0,88 do poder do Eco** (o limiar da melhor contra-escalação: abaixo dele nenhuma tropa plausível vence) e **recomendado = 1,02 do poder do Eco** (o limiar da composição razoável). O Poder engana conforme a composição: só corpo a corpo precisa de ~1,31 do Eco, só Arqueiros de ~0,93.
- O mínimo só **pesa** nas fases difíceis, muito difíceis e chefes. Nas fáceis, o jogador típico já passa.
- Para tentar a fase n, é preciso ter vencido a n-1. Fases já vencidas podem ser refeitas (butim reduzido, ver Repetição).

| Fase | Nível | Poder do Eco | Mínimo (0,88) | Recomendado (1,02) | Poder esperado do jogador |
|---|---|---|---|---|---|
| 1 | Fácil | 75 | 66 | 77 | 100 |
| 4 | Difícil | 122 | 107 | 124 | 116 |
| 5 | Muito difícil | 134 | 118 | 136 | 122 |
| 10 | Chefe | 202 | 177 | 206 | 155 |
| 30 | Chefe | 536 | 471 | 546 | 412 |

(Valores aproximados, calculados de E(n) e dos multiplicadores atuais; o código é a fonte.)

**Como o Poder é calculado:** uma única função, no servidor, que resume vida, ataque, defesa, nível e equipamento de cada guerreiro num número. A **mesma função** serve ao mínimo, ao recomendado e à calibragem, e é definida no portão do simulador (20). Se ela não refletir bem a chance real de vitória, o requisito engana, por isso precisa ser validada por simulação.

**Tela:** na Preparação aparece "Poder da tropa 118 / mínimo 141". Faltando poder, o botão fica bloqueado e a tela mostra **quanto falta** e sugere o caminho (quem treinar, o que equipar). Quem trava num difícil precisa saber o que fazer.

**Risco a vigiar:** o ritmo de crescimento do poder esperado precisa ser calibrado para quem investe com regularidade passar o muro sem sofrimento. Se parecer parede, o jogador desiste.

**Ajuda quando trava** (sem facilitar o Eco): após 3 derrotas seguidas na mesma fase, o Sábio mostra uma dica (classes favorecidas, regra do Eco) e sugere uma composição. O Eco continua igual.

**Repetição:** refazer uma fase já vencida dá butim reduzido e sem XP extra de primeira vitória, para não virar farm infinito e não furar a economia.

### 1.6 Calibragem por simulação
Como a simulação é pura e determinística, dá para rodar milhares de batalhas em lote no servidor e **ajustar o poder recomendado até a taxa de vitória ficar onde queremos**, com um jogador "tipo" (poder igual a E(n), composição razoável):

| Nível | Meta | Medido (20c, endurecimento +0,02) |
|---|---|---|
| Fácil | ~90% | 92% |
| Média | ~60% | 60% |
| Difícil | ~30% | 27% |
| Muito difícil | 10% a 20% | 11% |
| Chefe | 0% com o jogador tipo (pede poder acima do esperado) | 0% |

Medido sobre tropas plausíveis com poder igual a E(n). Quem investe acima do esperado e monta a formação certa passa dos difíceis e dos chefes.

Isso vira um script de balanceamento no repositório, não só um número no código.

### 1.7 Guerreiros (aventureiros): progressão e consequências
- **Contratação** na Taverna, como hoje (ouro 40 × 1,58^n mais 20 de comida). O QG não a substitui. **Hoje a classe do contratado é sorteada** entre as cinco. Com classes que têm vantagem entre si, sorteio atrapalha o planejamento de tropa. **DECIDIDO (Portão 22):** o jogador **escolhe a classe** ao contratar, sem custo extra.
- **Já existem:** nível 1 a 20, XP (vitória +2, recuo +1, subir pede 4 × nível), arma e armadura de 0 a 6, estados (na vila, em expedição, ferido), poder `5 + 4×nível + 3×arma + 2×armadura`, vagas da guilda `4 + 1 por nível de Taverna`. A função de Poder do combate parte dessa, com os atributos de combate acrescentados (portão 20).
- **O que o QG acrescenta:** Mesa de Guerra, limite da tropa enviada, Alojamento persistente e, depois, treino de especialização.
- **Alojamento:** durante o ciclo, as vagas da Taverna continuam valendo. Quem atravessa o reset passa a morar no QG (capacidade sobe com o nível dele), fora da população. **DECIDIDO (Portão 22):** o Alojamento só entra em ação na ascensão: os mais fortes, até a capacidade do QG ([0,3,4,5,6,7] por nível), atravessam com arma e armadura; o resto sai da guilda. Escolha manual de quem atravessa é do Portão 25. Manutenção de comida: 0,03 + 0,006 por herói extra, por segundo.
- **Manutenção de comida:** pequena e simbólica desde o começo e crescente com o número de aventureiros (hoje 0,08/s cada).
- **XP** por batalha vencida (e um pouco menos por derrota). Nível sobe atributos e libera especialização.
- **Equipamento** da Forja liga economia e combate.
- **Estados:** disponível, em marcha (para expedição ou batalha), ferido (com data de cura). Não existe perda permanente.
- **Derrota:** os que lutaram ficam **feridos com cooldown maior** que o de hoje (25% de chance e 60 s nas expedições) e só voltam depois de curados. Cura na Enfermaria, com custo e tempo. Parte do butim em disputa se perde. Ninguém morre.
- **Poder de cura:** o tempo de cura depende da Enfermaria (nível) e de recursos como ervas, que vêm da exploração do pântano. Valores no portão da Enfermaria.
- **Ponto para discutir depois:** sem perda permanente, a pressão da derrota vem do cooldown e do custo da cura. Se ficar leve demais, o custo de contratar e manter um exército grande pode ser calibrado como o principal peso.
- **Tempo:** o servidor calcula sob demanda até o próximo acontecimento com data. Marcha, cura e treino com data de fim encaixam nesse padrão, sem tick nem servidor de tempo real.

### 1.8 Telas (todas pensadas para celular de 390 px também)
1. **Quartel General (botão no HUD ou toque na construção):** abre duas abas, **Tropa** (aventureiros, nível, especialização, equipamento, Alojamento) e **Mesa de Guerra**. A Mesa de Guerra lista as fases (a próxima destacada, as já vencidas com seu melhor resultado). Nada de arrastar o mapa para lutar.
2. **Cartão do Eco:** tema, nível (fácil/média/difícil/muito difícil/chefe), poder recomendado, classes favorecidas, regra do Eco, butim possível, melhor resultado seu.
3. **Preparação:** escolher guerreiros (com estado e nível), arrastar para a formação, escolher tática, ver "Poder da tropa X / mínimo Y" (1.5b), e um aviso se algum estiver ferido. Botão "Enviar tropa" mostra o tempo de marcha.
4. **Marcha:** contador no QG (e um indicador discreto no HUD) com o tempo restante, opção de ver o replay quando a tropa chegar. O tempo de marcha depende da fase (curto nas fáceis, maior nas difíceis), não de distância no mapa.
5. **Replay:** canvas com o cenário procedural, os dois lados, barras de vida, números de dano discretos. Controles: velocidade 1x/2x, pular, pausar. Duração alvo de 20 a 40 s.
6. **Resultado:** vitória ou derrota, butim, XP por guerreiro, feridos, o que a derrota custou, botão "tentar de novo" e "voltar ao mapa".
7. **Tropa (no QG):** lista de aventureiros, subir de nível, escolher especialização, equipamento. A contratação continua na Taverna.
8. **Enfermaria:** feridos, tempo de cura, custo, acelerar com recurso.

Sem emojis, só Lucide. Pixel art com `image-rendering: pixelated` e escala inteira.

### 1.9 Dados (rascunho)
O estado do jogador é um JSON versionado salvo por jogador. Mudanças entram nele com migração de versão:
- **Bloco persistente (novo):** o que atravessa a ascensão: QG (nível, Alojamento), aventureiros, progresso da campanha (melhor fase, derrotas seguidas), nível da Falha por era, relíquias e Crônica (já persistem).
- **Aventureiro (evolução do atual):** classe (agora 4), atributos de combate, especialização, estado ampliado com "em marcha de batalha".
- **Batalha:** semente (do segredo.rng já usado nas expedições), formação, tática, resultado, log de eventos compacto, fim da marcha. Pode ficar no estado ou em tabela própria, o plano do portão 23 decide pelo tamanho.
- O Eco **não** é guardado: sai de `gerarEco(fase)`.
- Mapa: `mapa_meta.json` ganha o campo `pontosDeInteresse` (Ruínas do QG, relíquias, lotes), o que exige mudar o esquema Zod estrito. A imagem do mapa não muda.

### 1.10 Ascensão, era e dificuldade crescente (rascunho, A CONFIRMAR)

**Um único evento de reset, com dois destinos.** Em ambos a vila reseta (construções, recursos, população, descobertas do mapa) e **ficam** QG, aventureiros, relíquias, Crônica e campanha.

| | **Ascensão (Recomeçar com Bônus)** | **Avançar de era** |
|---|---|---|
| Quando | Objetivos do ciclo cumpridos (hoje: Carta Real, Cripta vencida, 40 aldeões) | Objetivos cumpridos **e** chefe da fase 30 vencido |
| Ganho | Relíquias (bônus permanentes) | Conteúdo novo: construções, recursos, classe, equipamentos, temas de Eco, lore |
| Dificuldade | **A Falha sobe um nível** | **A Falha zera** |
| Para quem | Quem quer otimizar e subir no ranking | Quem quer ver o jogo crescer |

**A Falha** é a ideia de que "a cada recomeço o Relógio falha mais". É um nível por era, que começa em zero e sobe a cada Ascensão. A auditoria do código mostrou o que se pode escalar com segurança e o que não.

**Escala bem (candidatos, valores de rascunho a calibrar):**
- **Tempo de obras e pesquisas:** +3% por nível. Não mexe em custo, não toca a capacidade do armazém e não pune quem fica fora.
- **Custo de pesquisa:** +5% por nível, **só em Estradas Reais e Carta Real** (a Cartografia abre também a Mina e o Pântano, então não encarece). **Implementado no Portão 18b.** Na Falha 10 a Carta Real passa a pedir o Armazém 2.
- **Perigo da Cripta:** a função existe (`perigoDestino`) com acréscimo **0** e será **ligada no Portão 25**. Motivo: hoje o grupo volta ao nível 1 ao ascender, e com +10 por nível o grupo típico cairia a 5% de vitória já na Falha 4. Só faz sentido quando os aventureiros atravessarem a ascensão. O valor será calibrado então (por exemplo +3 por nível até um teto menor que o rascunho de 170). Até lá, o texto da Ascensão não menciona a Cripta.
- **Objetivo de campanha** (depois que o combate existir): ter vencido a fase `5 × nível de Falha`. Liga a Ascensão à campanha sem mexer na dificuldade dos Ecos.
- **Bandidos (opcional):** o nível de Muralha necessário para anulá-los sobe com a Falha (por exemplo, nível 1 mais 1 a cada 3 níveis). É decisão de preparo, e não punição, porque quem tem a Muralha certa não perde nada.

**Não escala (descartado):**
- **Custo de construção:** a Taverna 10 já custa exatamente a capacidade máxima, então qualquer fator acima de 1 recria o problema do armazém.
- **Objetivo de 40 aldeões:** é um teto físico (um terreno de Casa, nível 10), então não pode crescer.
- **Perdas percentuais dos eventos:** eles acontecem também offline, então aumentá-las puniria quem ficou fora, contra o princípio do jogo.
- A **campanha de Ecos não é afetada** pela Falha.

**Relíquias hoje (da auditoria):** seis tipos (Mãos Calejadas, Bênção da Colheita, Legado, Caminhos Eternos, Sabedoria Ancestral, Linhagem Heroica). Ganho por ascensão: `3 + 2 × (ciclo − 1)`, acumulado cresce como k² + 2k. Comprar todas no máximo custa 938, o que leva cerca de 30 ascensões. Depois disso, as relíquias acumulam sem ter onde gastar.

**Princípios:**
- As relíquias crescem rápido e esgotam, então as duas curvas (relíquias e Falha) precisam ser **calibradas juntas**. Com a Falha parada no teto (rascunho: nível 10) e as relíquias ainda subindo, os ciclos 11 a 30 ficariam fáceis. Respostas: **(a)** novas relíquias de combate e do QG, para as relíquias terem onde gastar (ideias: cura mais rápida, +1 vaga de Alojamento, aventureiros novos com equipamento melhor, bônus pequeno de poder); **(b)** avançar de era zera a Falha e traz conteúdo, mas a **Era II precisa existir** antes de muitos jogadores chegarem a 10 ascensões; **(c)** calibrar os valores com o ritmo real.
- Meta de calibragem: ciclos com duração parecida (variação de uns 10%), e não cada vez mais curtos ou longos.
- **Aplicar a Falha só a partir da próxima ascensão.** Mudar custos no meio do ciclo de quem já está jogando seria injusto.
- Tudo em **contas inteiras no game-core**, para o cliente prever igual ao servidor, com os testes "um passo = muitos passos" e de capacidade cobrindo o fator.
- **Avançar de era dá a vantagem real de zerar a Falha**, além do conteúdo, o que torna a escolha entre as duas significativa.
- Como só a Era I é jogável hoje, **só a Ascensão vale agora**.
- **Ranking:** mantém era, ciclo, relíquias e fase. Com a Falha, cada ciclo vale mais que o anterior, o que combina com o critério atual.

**Achados da auditoria para o portão de tetos (18):** o **Legado** (relíquia que dá recursos iniciais) é cortado pelo teto inicial do armazém (300), então acima do nível 3 o bônus de madeira se perde e cerca de metade dos 8 níveis rende pouco ou nada. Além disso, os eventos de ganho fixo (+30 madeira, +40 comida, +20 saber) ficam irrelevantes nos níveis altos. Os dois pedem ajuste (por exemplo, ganhos proporcionais à capacidade).

**Marcas do Relógio (opcional, A CONFIRMAR):** antes de recomeçar, o jogador pode aceitar modificadores voluntários ("Colheita escassa", "Chuva constante", "Bandidos ousados") em troca de relíquias extras. Dá escolha e competição de ranking, e fica de fora da primeira versão.

---

## PARTE 2. EXPLORAÇÃO DO MAPA (independente do combate)

O mapa continua sendo o espaço de descoberta e economia. O combate saiu dele e mora no QG. Isso resolve o problema do mapa finito: a exploração tem fim por era, e a campanha de combate não depende dela.

### 2.1 Ideia central
**A Névoa cobre o mapa no começo de cada era.** Explorar é recuar a Névoa. Cada região revelada oferece recursos, lotes de construção, relíquias e lore. A primeira grande descoberta é o **Quartel General**.

### 2.2 O Quartel General como marco de exploração
- Vira um **destino novo** no sistema de expedições que já existe (hoje são 5 destinos fixos, com pin, rótulo, trilha, perigo, duração de 30 a 300 s, saque e pesquisa exigida). Fica **perto da vila**, alcançável na primeira ou segunda expedição, para o jogador liberar o combate já na primeira sessão.
- O soldado inicial já basta para a primeira expedição (o grupo é de até 3).
- O Sábio dá a dica ("as pedras do norte guardam algo") se o jogador demorar.
- Ao concluir a expedição, aparecem as **Ruínas do Quartel General**. O jogador paga um custo inicial baixo para **reerguer**, e a partir daí a Mesa de Guerra funciona.
- Depois do primeiro reset, o QG já aparece construído, sem precisar redescobrir.

### 2.3 Como a exploração funciona
- **Já existe e é reaproveitado:** destinos fixos com pin, grupo de até 3 aventureiros, resultado sorteado no servidor na partida, feridos, XP e relatórios. A Névoa hoje existe só na Cripta (um círculo fixo que sai com Estradas Reais).
- **Novo, em etapas:** primeiro só o destino das Ruínas do QG (pequeno). A **Névoa por região** e a revelação por expedição ficam para o portão de exploração completa (26).
- Cada expedição tem **custo de oportunidade**: quem sai fica fora da vila e fora de outras expedições.

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
- Campo `pontosDeInteresse` no `mapa_meta.json` (Ruínas do QG, relíquias, lotes) e a alteração do esquema Zod estrito.
- Camada de **névoa** por região, reaproveitando o desenho da névoa da Cripta (textura, borda, culling).
- Culling e desempenho com as mesmas regras das árvores.
- Nada disso exige refazer a imagem do mapa.

---

## PARTE 3. COMO ISSO ENTRA NOS PORTÕES

Cada um com auditoria, plano e aprovação antes de implementar. Os números 16 a 27 seguem a tabela já combinada.

0. **Ajustes rápidos** (prompt entregue, aldeões visíveis e Ocioso no mapa): aldeões visíveis em qualquer zoom e largura, texto de ajuda sobre a guilda.
0b. **Auditoria complementar:** concluída. Os achados estão incorporados na seção 1.10 e nos portões abaixo.
16. **Lore e objetivo** (Marco da era, Diário).
17. **Aldeões e ofícios:** **alocação** no lugar do rodízio automático de hoje, população e comida.
18. **Pressão, tetos e Falha: concluído.** 18a (Legado com piso de teto, eventos de ganho proporcionais ao teto, regra do Fazendeiro pelo saldo de comida) commitada; 18b (campo `falha`, esquema 7, tempo +3% e pesquisa +5% por nível, tela de Eras e Ascensão) implementada e conferida, aguardando commit. A Cripta fica para o 25.
19. **Construção com consequência** (lotes, vizinhança).
20. **Núcleo de combate no game-core** (simulador puro com testes, sem tela), **função de Poder**, **script de calibragem** (inclui o fator do mínimo) e **migração das cinco classes para as quatro**.
21. **Descoberta do QG:** destino novo no sistema de expedições, `pontosDeInteresse` no meta, reerguer.
22. **QG e aventureiros unificados:** bloco persistente no estado, Alojamento no QG, estados e capacidade, manutenção de comida, **contratação com escolha de classe** e arte das três classes novas.
23. **Mesa de Guerra e Ecos:** gerarEco, cartão, **Poder mínimo e recomendado**, preparação, marcha por fase, replay, resultado.
24. **Enfermaria e derrota:** feridos com cooldown maior, custos de cura.
25. **Ascensão com Bônus e avançar de era:** a ascensão passa a manter QG e aventureiros, **liga o perigo da Cripta na Falha** (valor calibrado), **novas relíquias de combate e do QG**; depois o avançar de era com Falha zerada e conteúdo novo (a Era II precisa existir).
26. **Exploração completa:** Névoa por região, relíquias do mapa, Diário, lotes, marcos, temas de Eco por região.
27. **Eventos com escolha ampliados.**

O 20 vem antes das telas porque o simulador testado e calibrado é a parte mais arriscada.

---

## PARTE 4. ESTADO DAS DECISÕES

**Fechadas:** as listadas no topo (itens 1 a 17).

**Para você confirmar:**
1. Seção **1.10**: os efeitos da Falha revistos depois da auditoria (tempo, pesquisa, Cripta, meta de campanha, bandidos opcionais) e o que foi descartado.
2. **Contratação com escolha de classe** no lugar do sorteio de hoje (seção 1.7).
3. Mapeamento das classes na seção 1.3 (ladino para Arqueiro, clérigo para Cavaleiro).
4. Novas relíquias de combate e do QG, para as relíquias não esgotarem (portão 25).

Ficam para trabalhar **dentro dos portões**, não antes:
1. Fórmula do Poder e fator do mínimo (portão 20, por simulação).
2. Curva da manutenção de comida e capacidade do Alojamento por nível do QG (portão 22).
3. Valores de cura, cooldown e custo (portão 24). Atenção ao equilíbrio sem perda permanente.
4. Tempos de marcha por fase (portão 23).
5. Atributos e habilidades das quatro classes (portão 20).
6. Valores da Falha, teto e calibragem do tempo de cada ciclo (portões 18 e 25).
7. Se a interface chama a unidade de "guerreiro" ou "aventureiro" (portão 22).
