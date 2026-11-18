# PROMPT: progressão do clique (GPC, ganho por clique)

Regra geral: NADA é escrito, commitado ou deployado sem aprovação explícita do Gabriel no fim de cada gate. Gate 1 é somente leitura. Registre no CRONARCA_REGISTRO_DE_PORTOES.md SÓ ACRESCENTANDO ao fim. Leia antes: CRONARCA_BACKLOG_IDEIAS.md (itens 3 e 4) e o PROMPT_BUGS_PRODUCAO_CLIQUE_HUD_RESET.md.

## Pré-requisito
Esta mudança altera o que o cliente prevê e o que o servidor aceita. Só implemente depois da correção do bug de previsão (cliente aplicando o mesmo balde de fichas do servidor). Se esse gate ainda não foi feito, o Gate 1 daqui pode ser feito, mas o Gate 2 espera.

## Contexto
Hoje o ganho por clique é ganhoBase 1 × (1 + 0,25 × nível de Mãos Calejadas), onde Mãos Calejadas é relíquia (persiste na ascensão, nível máximo 10). Tetos: 5 cliques/s por objeto e 10/s por usuário (data/formulas.ts:76), lotes até 100. Gabriel jogando perto da Casa 10: clicar não faz diferença, o jogo vira só esperar.

## Decisão do Gabriel (18/11)
Opção B: criar progressão de clique. O ganho por clique (GPC) sobe com melhorias, por exemplo 2 de recurso por clique. Sem valores absurdos (não existe GPC 100): o custo das coisas e a produção das construções não podem quebrar.

## Proposta inicial (a confirmar ou ajustar no Gate 1)
1. Fórmula: ganho por clique = (1 + soma das melhorias de GPC do ciclo) × (1 + bônus de Mãos Calejadas). A relíquia continua multiplicando por cima.
2. Fonte das melhorias dentro do ciclo: nova linha de Pesquisa ("Ofício do coletor"), níveis curtos (+1 de GPC por nível), com custo e tempo crescentes. Alternativa a avaliar: construção/ferramenta na Forja. Recomenda-se Pesquisa porque a UI e a regra já existem.
3. Teto de GPC por era (valor a calibrar; ponto de partida: Era I até 4 a 5). Eras seguintes sobem o teto de forma modesta.
4. Tetos de cliques por segundo permanecem como estão (anti-abuso). Não mexer neles neste portão.
5. Meta de calibração: clicando em ritmo humano sustentado (cerca de 4 cliques/s), o ganho de clique deve valer entre 25% e 50% da produção passiva do mesmo estágio. Clicar ajuda, mas nunca substitui construções.
6. UI: mostrar "+N por clique" no painel de recursos ou na tela de Pesquisa; o número flutuante do clique mostra o ganho real; um indicador discreto quando o teto de cliques/s do objeto for atingido.

## Gate 1: auditoria e proposta (somente leitura)
1. Leia ganhoCliqueMicro, o caso 'clicar' em acoes.ts, a previsão no cliente (sincronia.ts, preverEstado), o sistema de Pesquisa (dados, custos, tempos, UI) e o estado/esquema atual (11 ainda pode não estar em produção; proponha esquema 12 se for o caso, com migração e fixtures).
2. Meça por simulação a produção passiva por estágio (por exemplo Casa nível 3, 6 e 10, e fim da Era I) e a renda máxima de clique com os tetos atuais. Mostre uma tabela: GPC possível x renda de clique x % da produção passiva.
3. Proponha: níveis da linha de pesquisa, GPC por nível, custo e tempo de cada um, teto por era, e o impacto no ritmo até a Casa nível 10 (simule quanto tempo a progressão economiza).
4. Proponha a mudança no cliente (previsão usa o mesmo cálculo do game-core) e a UI.
5. Plano de testes, incluindo simulação com o Sincronizador (latência 60, 250 e 600 ms): o número exibido nunca recua e converge ao do servidor.
6. Liste decisões em aberto para o Gabriel com recomendação. Pare e aguarde.

## Gate 2 e Gate 3
Implementar conforme aprovado; rodar make test, typecheck, conferir-migracao (se houver esquema) e calibrar-combate (se tocar combate). Checklist manual: comprar cada nível, ver o GPC subir, clicar 15 s sem queda no HUD, F5, convidado. Sem push/deploy sem aprovação.
