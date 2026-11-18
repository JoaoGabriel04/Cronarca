# PROMPT: bugs de produção (clique lento, HUD oscilando, reset congelando)

Regra geral: NADA é escrito, commitado ou deployado sem aprovação explícita do Gabriel no fim de cada gate. Gate 1 é somente leitura. Registre tudo em CRONARCA_REGISTRO_DE_PORTOES.md (proposta primeiro, aplicado depois da aprovação).

## Contexto (relatado em produção)
1. Clicando rápido em recursos (Pedra, Madeira...), a coleta "fica mais difícil": cliques rápidos não rendem mais.
2. O HUD oscila: o número sobe, volta e sobe de novo durante a coleta.
3. Após o Jogar como Convidado havia progresso antigo; ao apagar o progresso (confirmação feita), a tela congelou, sem redirecionar; só o F5 resolveu e voltou um jogo novo, sem passar pelo Login.

## Achados da análise (simulação feita pelo designer, a confirmar por você)
- `packages/game-core/data/formulas.ts:76`: clique = 10/s por usuário, 5/s por objeto, lote até 100. O servidor (`acoes.ts`, caso 'clicar') aceita `min(quantidade, balde usuário, balde objeto)`.
- O cliente (`lib/jogo/sincronia.ts`, `clicar()` com lote de 250 ms) prevê TODOS os cliques. A resposta traz `cliquesAceitos` menor, o estado do servidor vence e o número recua. Simulação com 10 cliques/s: 119 enviados, 51 a 70 aceitos; quedas de exibição com latência >= 250 ms.
- Bug 3 sem causa confirmada. Hipóteses: (a) `salvarAgora()` esperando fila/voo que não termina; (b) 429 do limite de 20 req/s por usuário (`rotas.ts` dentroDoLimite) sem tratamento visível; (c) `/auth/convidado` reaproveitando sessão existente em vez de criar conta nova; (d) falta de redirecionamento após o reset.

## Gate 1: auditoria e reprodução (somente leitura)
1. Reproduza os bugs 1 e 2 com um teste automatizado no game-core/frontend (Sincronizador com transporte falso e latência), sem tocar em produção nem em dados reais.
2. Bug 3: leia `/auth/convidado` e todo o fluxo de criação de sessão convidada. Responda: com sessão ativa, o botão cria conta nova ou reaproveita a existente? Leia `salvarAgora`, o tratamento de 429/timeout em `mandar()` e o fim de `apagarProgresso` (o `finally`, o `setApagando`, o redirecionamento). Aponte a causa mais provável com evidência (arquivo:linha), ou diga que não achou e proponha instrumentação (logs de cliente/servidor).
3. Não use credenciais de produção nem dumps. Não peça o banco.
4. Entregue relatório com: causa de cada bug, nível de confiança, e as opções de correção do Gate 2. Pare e aguarde aprovação.

## Gate 2 (proposta, só após aprovação do Gate 1)
Bug 1 (decisão de design a confirmar com o Gabriel, não decida sozinho):
- (A) Manter os limites e deixar claro ao jogador (teto 5/s por objeto).
- (B) Subir os limites ou criar progressão (relíquia/melhoria que aumenta o teto).
- Em ambos os casos, mantenha o anti-abuso do servidor.

Bug 2 (independe da decisão acima):
- O cliente deve aplicar na previsão o MESMO balde de fichas do servidor, reutilizando a função do game-core (`recarregar`/regra de aceitação), para prever só o que o servidor aceitará.
- O número exibido nunca deve recuar por causa de cliques já mostrados. Se houver divergência residual, reconcilie sem queda visível.
- Teste automatizado: com latências de 60, 250 e 600 ms, a madeira exibida não pode diminuir e deve convergir ao valor do servidor.

Bug 3 (conforme o diagnóstico):
- O reset deve ter tempo limite, tratar 429 com nova tentativa, sempre liberar `apagando` e mostrar erro claro em vez de congelar.
- Decidir com o Gabriel o destino após apagar: ficar no jogo novo ou ir ao Login/convidado.
- Se a causa for (c), o botão deve criar conta convidada nova (ou avisar que já há sessão).

## Gate 3: verificação
- Rodar testes e `make calibrar-combate` se algo do game-core mudou.
- Checklist manual para o Gabriel: clique rápido 15 s sem queda no HUD, reset com fila de cliques pendente, convidado com sessão aberta.
- Atualizar o registro. Sem push/deploy sem aprovação explícita.
