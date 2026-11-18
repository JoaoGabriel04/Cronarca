# CRONARCA: backlog de ideias (nada daqui é decidido)

Regra do Gabriel (18/11): nada é implementado sem ter sido planejado. Toda ideia entra aqui primeiro, com status. Ela só vira trabalho quando for promovida a um Portão no plano mestre, com aprovação explícita. Itens deste arquivo NÃO entram em prompt para o Claude Code antes disso.

Status possíveis: ideia | em análise | promovida ao Portão N | descartada.

## 1. Vila em grade (estilo Clash of Clans)  [direção definida, não planejada]
Direção do Gabriel (18/11): organizada em GRADE, não posição livre. No celular, segurar alguns segundos para mover a construção.
Pedido (18/11): o jogador monta a vila como quiser: move construções, coloca mais construções do mesmo tipo (mais pedreiras etc.), melhora a vila para aprimorar a coleta.
- Relação com o plano: o Portão 19 ("Construção com consequência: lotes e vizinhança") já cobre uma parte (posição importa). Esta ideia é maior: layout livre e construções repetíveis.
- A definir antes de qualquer implementação: grade ou posição livre; limite de cada construção por nível de Casa/era; custo para mover; colisão e área jogável; validação no servidor; interação no celular (toque em vez de arrastar); como o layout atravessa a ascensão; impacto no mapa e nas expedições; impacto na economia (mais pedreiras = mais produção, recalibrar).
- Dependência: depende de mexer no mapa e no estado (esquema novo). Merece portão próprio, depois do 23.

## 2. Mercado de verdade  [direção definida, não planejada]
Direção do Gabriel (18/11): comprar e vender ervas, recursos e itens da Forja (itens a definir). Preço e estoque ligados ao quanto o jogador produz em 1 h (a venda por hora vale 50% a 70% do ouro produzido no mesmo tempo, se o mercado ainda gerar ouro). Ideia central: UMA base econômica única (como o valor do dólar) da qual derivam todos os preços do jogo (recursos, construções, melhorias, contratações). Mudar a base reajusta tudo. Pré-requisito proposto: portão de Economia unificada (tabela de valor de referência em data/, custos como fórmulas dessa base) antes do Mercado.
Pedido (18/11): o Mercado deixa de só gerar ouro. O jogador compra e vende itens por ouro, e com o ouro compra outros itens na loja.
- Hoje não existe sistema de itens. Primeiro é preciso definir o que são "itens" (recursos, ervas, equipamento da Forja, consumíveis).
- A definir: preços, estoque e renovação, sumidouros de ouro (evitar inflação), se é só NPC (recomendado no início) ou entre jogadores, relação com Forja, Enfermaria (ervas) e relíquias, regras anti-abuso no servidor.
- Dependência: sistema de itens e equipamento (Forja) vêm antes.

## 3. Ritmo: mais o que fazer enquanto espera  [em análise]
Feedback (18/11, jogando perto da Casa nível 10): o jogo é quase só esperar; clicar não resolve a lentidão da coleta; sem o modo combate, mexer na vila fica cansativo.
Alavancas possíveis (nenhuma decidida):
- Progressão do clique: melhorias que aumentam o ganho por clique e o teto de cliques por segundo (hoje 5/s por objeto, 10/s por usuário).
- Obras em paralelo (mais de uma construção ao mesmo tempo) ou fila.
- Objetivos e missões curtas com recompensa; eventos ativos (mercador, tempestade) que pedem decisão.
- Combate e Mesa de Guerra (Portão 23) e expedições: dão uma atividade além de esperar.
- Revisar os tempos de obra e o ritmo até a Casa nível 10 / Era II (simular tempo total).
- Ligação com os bugs de produção (clique lento, HUD oscilando): ver PROMPT_BUGS_PRODUCAO_CLIQUE_HUD_RESET.md.

## 4. Teto de cliques  [DECIDIDO: opção B]
Progressão de clique (GPC): melhorias aumentam o ganho por clique, sem valores absurdos. Tetos de cliques/s ficam como estão. Prompt: PROMPT_PROGRESSAO_DO_CLIQUE.md (depende da correção da previsão do cliente).

## 5. Trilha sonora  [em andamento]
Ambiente de áudio a preparar sem publicar a faixa (plano grátis do Suno, sem direito comercial): PROMPT_AUDIO_TRILHA.md.
Instrumental medieval calmo (violão de aço, alaúde, flauta, harpa, bordão, modo dórico). Prompt do Suno entregue em 18/11. Faixas do plano grátis são só protótipo (sem direito comercial). Futuro: tabela de músicas por tela e prompt para o Claude Code ligar o áudio.

## 6. Achado do Gate 1 do GPC (18/11)  [dado medido]
- Simulação com bot guloso até a Casa 10: sem clicar 2h38; GPC 1: 2h27 (-7%); GPC 2: 2h16 (-14%); GPC 3 e 4: 2h16 (sem ganho). A partir de GPC 2 o gargalo é a FILA DE OBRAS (uma por vez).
- Conclusão: a progressão do clique resolve "clicar não faz nada", mas NÃO resolve "o jogo é só esperar". Obras em paralelo ou fila (item 3) é o que ataca o segundo problema. Proposta separada a pedir ao Claude Code (Gate 1, leitura).
- Cliques em ferro (Forja) e ouro (Mercado) já rendem 190% e 3.333% da passiva na Casa 3 a 10: desequilíbrio atual. O Mercado de verdade (item 2) deve redesenhar o clique de ouro. Por ora GPC só vale para madeira e pedra.
