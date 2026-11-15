# Cronarca: Visão e Decisões (rascunho para aprovação)

Status: **rascunho, nada aqui está implementado.**
> **Revisão posterior:** combate e exploração foram separados e o QG foi definido. Ao avançar de era a vila reseta, e o Quartel General e os guerreiros (com seus níveis) permanecem, com o QG tendo Alojamento próprio. Os detalhes e a nova ordem de portões estão em `CRONARCA_COMBATE_E_MAPA.md`, que vale mais que este documento onde houver diferença (seções 4.2, 4.3, 4.4 e 8).
 Este documento define o que o jogo quer ser antes de virar portões para o Claude Code. Itens marcados como DECISÃO MINHA são palpites que você precisa confirmar ou trocar.

## 1. O problema que isto resolve

Feedback do primeiro contato com o jogo em produção:
- Pouca lore e nenhum objetivo claro.
- O ciclo é "clicar, esperar, comprar", sem escolha com custo.
- Construir é só comprar.
- Quem tem muito recurso para de precisar planejar e o jogo perde a graça.

A causa comum é a ausência de **decisões com consequência** e de **pressão contínua**. Tudo abaixo existe para criar as duas.

## 2. Pilares

1. **Cada escolha custa outra.** Gente, comida, espaço e tempo são limitados e disputados.
2. **O mundo empurra de volta.** O reino nunca fica "pronto": há manutenção, ameaça e custos que crescem mais rápido que a produção.
3. **Combate é parte da economia.** Lutar rende o que a vila não produz, mas gasta o que a vila produz.
4. **O servidor decide tudo.** Batalhas e ranking são calculados no servidor, determinísticos e auditáveis.
5. **Tom misterioso e sombrio**, com clima medieval no começo.

## 3. Lore e tom

**Premissa:** o Cronarca é o guardião do Relógio do reino. O Relógio está falhando. Cada era é um fragmento do tempo que precisa ser reerguido antes que a Falha o apague.

- **Ecos:** vilas que o tempo esqueceu. São as "vilas fictícias" das batalhas. Existem fora da linha do tempo, por isso são iguais para todos (ranking honesto) e podem ter regras estranhas.
- **Fragmentos de Tempo:** o butim raro dos Ecos. É o que avança de era.
- **A Névoa:** a ameaça que consome o reino quando o Relógio falha. Dá o motivo da pressão contínua (seção 5).
- **Tom:** poucas palavras, texto curto, ambiente de crepúsculo, nada de humor pastelão. O Selo do relógio da logo já é o símbolo.

Objetivo por era: **reerguer o Marco da era e vencer o Eco-chefe que o guarda.** O Marco é a meta visível na tela. Só avança de era quem cumprir os dois.

Era I (rascunho): "A Aldeia". Marco: acender o Marco da Aldeia. Chefe: o Eco da Primeira Muralha.

## 4. Os sistemas

### 4.1 Aldeões e ofícios (a alavanca principal)
- Cada aldeão ocupa uma vaga de **população**, limitada por moradia e por comida.
- Você **aloca** aldeões em ofícios (lenhador, mineiro, fazendeiro, ferreiro, sábio). Alocar um é tirar de outro.
- Aldeões ociosos não produzem, mas consomem comida.
- Guerreiros (4.3) **também ocupam população**. Esse é o dilema central: mais braços na produção ou mais espadas no Quartel.

### 4.2 Construção com consequência
- O catálogo de construções continua sendo aberto pelo HUD. O que muda é o **onde**: terrenos têm vantagens (Serraria junto à floresta, Mineração junto à pedra) e vizinhança dá bônus ou penalidade.
- Algumas construções têm **ramificação irreversível** no meio da evolução (exemplo: Forja foca em armas ou em ferramentas).
- Construções têm **manutenção** (seção 5). Construir muito sem sustentar sai caro.
- DECISÃO MINHA: manter o catálogo por botão e dar profundidade com o lote no mapa, e não voltar a "achar o terreno vazio".

### 4.3 Guerreiros
- Treinados no **Quartel**, custam população, comida, ferro e tempo.
- Quatro classes com relação de vantagem entre si (rascunho): Lanceiro, Arqueiro, Cavaleiro, Mago do Tempo. Cada Eco favorece uma ou duas.
- **Experiência:** cada vitória dá XP ao guerreiro que participou. Subir de nível melhora atributos e libera uma escolha de especialização.
- **Equipamento** sai da Forja, o que liga o combate à economia.

### 4.4 Ecos (modo combate)
- Uma **campanha de Ecos** em sequência por era, com dificuldade crescente e um chefe no fim.
- Antes da batalha você escolhe: quais guerreiros levar, **formação** (frente, meio, trás) e uma tática simples (agressiva, defensiva, equilibrada).
- **Resolução automática no servidor**, com semente guardada, e o cliente mostra um **replay curto** animado em pixel art. Isso mantém o ranking honesto, funciona com o jogo aberto ou fechado e é bem mais barato de construir que combate em tempo real.
- DECISÃO MINHA: batalha automática com decisões antes, e não luta em tempo real estilo Clash Royale. Se você quiser o tempo real, vira um projeto bem maior e o ranking fica difícil de proteger.
- Cada Eco mostra o **poder recomendado**, as classes que ele favorece e o butim possível.
- Enviar tropas leva **tempo de marcha**, durante o qual elas ficam indisponíveis.

**Vitória:** recursos (inclusive os que a vila não produz), XP, e com sorte Fragmentos de Tempo.
**Derrota** (consequências reais, mas sem destruir o jogador):
- Guerreiros **feridos**: indisponíveis até curar na **Enfermaria**, que custa recurso e tempo.
- Parte do butim em disputa se perde, e a vitória futura naquele Eco fica mais difícil por um tempo (o Eco "se lembra").
- Não existe perda permanente de guerreiro. A derrota gera ferimento com cooldown maior (ver `CRONARCA_COMBATE_E_MAPA.md`).
- Nunca se perde a vila nem o progresso de construções por causa de uma batalha.

### 4.5 Eventos com escolha
O Mercador já é o embrião. Ampliar: eventos com duas ou três respostas, cada uma com ganho e risco, em sintonia com o tom sombrio. Aparecem mesmo com o jogo fechado e esperam resposta, com prazo.

## 5. Pressão contínua (contra o "já tenho tudo")

Quem acumula demais precisa continuar tendo motivo para planejar. Mecanismos:
- **Manutenção:** construções e tropas consomem recursos por hora. O excesso vira fardo.
- **Custos que crescem mais rápido que a produção** nos níveis altos.
- **A Névoa avança** em intervalos e exige reserva de comida e defesa. Se ignorar, o reino perde produção (nunca o progresso).
- **Tetos que só sobem por escolha:** armazém e moradia não crescem de graça, e o excedente se perde.
- **Recursos que só os Ecos dão**, para que ficar só na vila não seja suficiente.
- **Fim de ciclo (ideia para depois):** reinício com bônus permanentes e ranking por ciclo, que já era uma ideia anterior do projeto.

## 6. Ritmo
Sessões **mais longas e de planejamento**, com tempos de marcha, treino e cura que fazem sentido voltar depois, sem punir quem fica fora. Offline: as **políticas** que você deixou (prioridade de produção, reserva de comida) rodam; as decisões grandes esperam você.

## 7. O que isso muda no que já existe
- **Portão 8 (aldeões e aventureiros no mapa):** aldeões deixam de ser enfeite e viram a base do sistema. Depende do resultado da auditoria dos aldeões.
- **Portão 12 (catálogo):** continua, mas ganha regras de terreno, vizinhança e ramificação.
- **Soldado inicial:** vira o primeiro guerreiro do Quartel, em vez de uma unidade solta.
- **Portão 4 (custo x armazém):** o aviso pendente passa a ser parte do balanceamento de tetos.
- **Ranking:** precisa incluir o desempenho nos Ecos, sempre calculado no servidor.

## 8. Ordem sugerida de portões (só depois de aprovar este documento)
1. **Auditoria de aldeões e soldado** (prompt já entregue).
2. **16. Lore e objetivo:** Marco da era, texto, tela de objetivo.
3. **17. Aldeões e ofícios:** população, alocação, comida.
4. **18. Pressão:** manutenção, tetos, a Névoa.
5. **19. Construção com consequência:** terreno, vizinhança, ramificação.
6. **20. Quartel e guerreiros:** treino, XP, classes.
7. **21. Ecos:** campanha, resolução no servidor, replay.
8. **22. Enfermaria e derrota:** feridos, perdas.
9. **23. Eventos com escolha** ampliados.

Cada portão segue o padrão de sempre: auditoria e plano do Claude Code, aprovação, só então implementação.

## 9. Pontos em aberto (preciso da sua resposta)
1. Batalha automática com replay (minha escolha) ou algo mais ativo?
2. A morte permanente de guerreiro ferido reincidente é aceitável, ou prefere só ferimento?
3. Os nomes (Ecos, Fragmentos de Tempo, a Névoa, a Falha) agradam, ou quer outros?
4. Quatro classes são suficientes para a Era I, ou começamos com duas?
5. Quer o fim de ciclo (reinício com bônus) já planejado ou deixamos para depois?
