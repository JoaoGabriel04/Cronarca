# PROMPT: Portão 20d, fechamento do núcleo de combate

Contexto: os portões 20a a 20c estão no GitHub (03ec0ae e 50ddcd9). Este portão fecha os pontos em aberto do relatório. **Nada é escrito sem aprovação explícita ao fim de cada sub-portão.** Entregar só os arquivos alterados. Documentar cada decisão em `docs/`.

Antes de tudo: o Portão 0 das árvores e a Tela inicial v2 são outros trabalhos; não mexer em sprites nem em `dados.ts` neste portão.

## 20d-1: endurecimento (decidido pelo dono em 16/11)
- Em `packages/game-core/data/combate.ts`, `CURVA_ECO.endurecimento.passo` passa de 5 para **2** (limite de +0,10, `passosMaximos` 5 mantido).
- Rodar `make calibrar-combate` e regenerar `docs/CALIBRACAO_COMBATE.md`.
- Resultado esperado (medido em simulação prévia, jogador tipo em E(n), fases 1 a 120): Fácil 92%, Média 60%, Difícil ~27%, Muito difícil ~11%, Chefe 0%. Por faixa, o Difícil deve ficar entre ~21% e ~34% (sem despencar após a fase 60).
- Atualizar testes que dependam do valor antigo e o comentário em `data/combate.ts`.
- Relatar a tabela medida. Se divergir mais de 3 pontos do esperado, parar e perguntar.

## 20d-2: tornar poderMinimo e poderRecomendado utilizáveis
Hoje ninguém usa `PODER_FASE_BP`. Sem criar tela (a Mesa de Guerra é o Portão 23), deixar pronto no game-core:
- Função pura `prontidaoDaTropa(tropa, fase)` que devolve `{ poder, poderDoEco, minimo, recomendado, falta, estado }`, com `estado` em `bloqueada` (abaixo do mínimo), `arriscada` (entre mínimo e recomendado) ou `recomendada`. `falta` é quanto resta para o mínimo (0 se já atinge).
- Poder da tropa = soma do Poder de cada unidade enviada (mesma função do simulador). Inteiros apenas.
- Aviso de composição, também puro: `avisoDeComposicao(tropa)` devolve `corpo_a_corpo`, `so_arqueiros` ou `equilibrada`, porque o relatório mostrou que o Poder engana (só corpo a corpo precisa de ~1,31 do Eco, só Arqueiros ~0,93). Só informa, não muda o número.
- Endpoint de leitura no backend (GET, com SWR no front depois) que devolve a prontidão para uma tropa e fase, validando que a fase está desbloqueada (vencida a anterior). Sem escrita de estado.
- Testes: limites exatos (mínimo e recomendado em fases de cada nível), tropa vazia, fase bloqueada, determinismo.
- Sem UI. Tipos exportados para o Portão 23.

## 20d-3: migração do save em produção (8 para 9)
Objetivo: ter certeza antes do deploy, sem tocar no banco de produção.
1. **Verificação offline:** script `scripts/conferir-migracao.ts` que lê um dump (`pg_dump` somente dos saves) ou um JSON exportado e, em memória, migra cada save do esquema 8 para o 9 e confere invariantes: mesmos ids, nome, nível, XP, arma, armadura, estado e ferimento por aventureiro; recursos, construções, pesquisas, relíquias, ciclo e Falha idênticos; expedições em andamento com o mesmo relatório; contagem de aventureiros igual; nenhuma classe antiga restante; esquema final 9. Relatório com contagem de saves, OK e falhas (com id do save). Não grava nada.
2. Se não houver dump, explicar como gerar um (a partir do Render, só leitura) e esperar eu fornecer. Não inventar saves.
3. **Plano de deploy:** backup do banco antes, checagem de que a migração roda ao carregar e é idempotente (carregar duas vezes dá o mesmo resultado), e um passo de reversão (restaurar o backup). Documentar em `docs/` como checklist.
4. Só depois da minha aprovação do relatório: seguir para o deploy.

## Entrega final do 20d
Relatório curto com: tabela do 20d-1, API do 20d-2, resultado do 20d-3 (ou o que falta para rodar). Atualizar `docs/CRONARCA_HANDOFF.md`.

## Não fazer neste portão
- Peso por classe no Poder (decisão adiada: ver relatório de 16/11).
- Qualquer tela ou sprite.
- Mudar multiplicadores, poder mínimo (0,88) ou recomendado (1,02).
