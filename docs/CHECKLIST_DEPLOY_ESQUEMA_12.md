# Checklist: deploy do esquema 12 do save, progressão do clique (GPC)

**Este documento só descreve. Nada dele foi executado.** Push e deploy só com a aprovação explícita do Gabriel.

Objetivo: publicar a progressão do clique sem perder nenhum save. O esquema 12 é a migração mais leve até agora: **nenhuma tabela, coluna nem campo do estado muda**. A única diferença é que `pesquisas.concluidas` passa a aceitar os ids `coletor_1` e `coletor_2`, e `estado.versao` vira 12. A migração (`carregarEstado`, 11 para 12) só troca a versão e é **vazia e idempotente**. O esquema 11 **já está em produção** e este deploy vem **depois e separado** dele.

Mesmo assim, **o código antigo não lê o esquema 12** (`z.literal(11)`), e um save que já tenha um id `coletor_*` também seria recusado pelo enum antigo. Por isso, **antes do deploy, crie um branch ou backup no Neon**.

## O que já se sabe do código
- **Leitura não grava.** `GET /game/state` migra em memória; a linha do banco só vira `versao_esquema = 12` quando o jogador faz uma ação. Logo depois do deploy o banco tem saves em 11 e em 12, e isso é normal.
- **Idempotente e sem efeito colateral.** Migrar o já migrado não muda nada; um save do 11 carrega igual, só com `versao: 12` (testes e `make conferir-migracao`).
- **Quem já jogava:** nada é gasto, perdido ou desbloqueado. O ganho por clique continua 1 até o jogador pesquisar "Ofício do coletor I" (80 de saber, 90 s) e "II" (250 de saber e 40 de ouro, 150 s; requer o I). As pesquisas somem na ascensão, como as outras.
- **Regra nova do clique, vale para todos já no deploy:** madeira e pedra rendem 1 + pesquisas + 0,25 × nível de Mãos Calejadas (soma, não produto); **ferro e ouro rendem sempre 1, sem relíquia**. Quem tem Mãos Calejadas deixa de ganhar o bônus ao clicar na Forja e no Mercado, e em troca ganha mais em madeira e pedra do que antes quando tem pesquisas. Teto das pesquisas na Era I: GPC 3; com Mãos Calejadas 10 o máximo é 5,5.
- **Cliente antigo (aba aberta antes do deploy):** a previsão usa a regra antiga (relíquia também em ferro e ouro) e o servidor responde com a nova; o servidor vence, e o piso do HUD evita recuo. Se uma ação receber esquema novo que o cliente antigo não conheça, o jogador pode precisar atualizar a página.
- **Música:** `NEXT_PUBLIC_MUSICA` fica **desligada (0)** na Vercel. Nenhuma faixa de áudio vai para produção.

## 1. Verificação offline (sem tocar na produção)
- `make test` e `make typecheck` sem falhas.
- `make conferir-migracao` (saves sintéticos): esperado `OK: 7 | Falhas: 0` e a linha "Migração para o esquema 12".
- Com o dump real, se quiser (mesmos cuidados do `CHECKLIST_DEPLOY_MIGRACAO_9.md`, seção 1): `make conferir-migracao ARQ=dumps/saves_producao.json`. Para cada save de esquema 11 o script confere que só `versao` muda e que `pesquisas` e `qg` ficam iguais.

## 2. Branch ou backup no Neon (antes do deploy)
Faça **um** dos dois:
1. **Branch no Neon (recomendado):** no painel do Neon, projeto do Cronarca, aba **Branches**, **Create branch** a partir do branch de produção (`main`), nome `antes-do-esquema-12`, "current data". Anote o horário.
2. **Dump local** (fora do repositório; `backups/` está no `.gitignore`):
   ```bash
   mkdir -p backups
   read -rs -p 'URL de conexão do banco (não aparece na tela): ' URL_DB; echo
   docker run --rm -v "$PWD/backups:/b" postgres:17-alpine pg_dump "$URL_DB" -Fc -f /b/cronarca_antes_do_esquema12.dump
   unset URL_DB
   docker run --rm -v "$PWD/backups:/b" postgres:17-alpine pg_restore --list /b/cronarca_antes_do_esquema12.dump | head
   ```
   (nunca cole a URL no chat.)
3. `make migrar-neon-status`: o esquema 12 **não** tem migração de tabela; deve continuar "up to date".

## 3. Commits e deploy
1. **Commits separados:** o esquema 11 (Portão 22 e as duas correções) já está publicado. O commit do GPC (esquema 12) vai **sozinho**, depois dele; o áudio e qualquer outra coisa ficam em commits próprios e **não entram neste deploy**. Confira `git log origin/main..HEAD` antes do push. Em 18/11 aparecem dois commits: `20cb3d5` (correção dos textos da Mesa de Guerra e da Enfermaria, só front e dados de texto, sem esquema) e o do GPC; qualquer outro commit na lista deve ser entendido antes de publicar.
2. Horário de pouco uso. Push na `main` e deploy do Render (back) e da Vercel (front).
3. Depois do deploy:
   - `GET /health` responde 200;
   - entre com uma conta existente: o jogo abre, F5 mantém o estado;
   - **Scriptorium > Pesquisa:** aparecem "Ofício do coletor I" e "II" (a II bloqueada) e a linha "+1 por clique em madeira e pedra (pesquisas até 3)";
   - pesquise o I: o "+N" ao clicar em árvore e pedra passa a 2, na Forja continua 1; a II exige o I; F5 mantém; repita como convidado;
   - Configurações > Relíquias: Mãos Calejadas diz "+0,25 por clique em madeira e pedra";
   - clique rápido por 15 s: o HUD não recua;
   - nos logs do Render, nenhum 5xx nem `ZodError` ao carregar saves;
   - só leitura no banco: `select versao_esquema, count(*) from game_states group by 1;` mostra os saves passando para 12 conforme os jogadores agem.

## 4. Plano de volta
- **Ainda nenhum save em v12:** o banco segue no esquema 11. Basta voltar o código (Render e Vercel, Rollback). Sem perda.
- **Já há saves em v12:** o código antigo não os lê. Opções, da mais simples:
  1. **Rebaixar 12 para 11 com SQL** (a migração é vazia, então o inverso também é). **Só funciona se nenhum save tiver `coletor_*` em `pesquisas.concluidas`** (o enum antigo recusaria). Antes de rodar, conte: `select count(*) from game_states where estado->'pesquisas'->'concluidas' ?| array['coletor_1','coletor_2'];`. Se der 0, o rebaixamento é `update game_states set versao_esquema = 11, estado = jsonb_set(estado, '{versao}', '11') where versao_esquema = 12;` (rode dentro de uma transação, confira a contagem de linhas e só então `commit`). Se der mais que 0, quem pesquisou perderia a pesquisa ao tirar o id (e o saber gasto não volta): use a opção 2 ou peça um script que devolva o custo.
  2. **Voltar ao branch do Neon** `antes-do-esquema-12` (aponte o `DATABASE_URL` para ele, ou restaure-o como principal) e voltar o código. Perde o progresso feito depois do branch.
  3. **Restaurar o dump** (seção 2, item 2): `pg_restore --clean --if-exists --no-owner -d "$URL_DB" /b/cronarca_antes_do_esquema12.dump`. Faça antes um novo dump do estado de agora.
- Depois de qualquer reversão, rode de novo a seção 1 antes de publicar outra vez.

## 5. Limpeza
Apague `backups/*.dump` e o branch `antes-do-esquema-12` quando o esquema 12 estiver estável (nada disso entra no Git).

## 6. Acréscimos de 19/11 (ordem do deploy, foto do banco e commits esperados)
**Este bloco também só descreve. Nada dele foi executado.**

### 6.1 Ordem do deploy
1. **Render (back) primeiro, Vercel (front) depois.** O servidor novo precisa estar no ar antes do cliente novo: o servidor lê saves em 11 e em 12, e o cliente antigo continua funcionando contra ele (o servidor vence na previsão). O inverso deixaria o cliente novo falando com um servidor que ainda não lê o esquema 12.
2. Espere o Render responder `GET /health` 200 antes de iniciar o deploy da Vercel.

### 6.2 Foto do banco, ANTES do deploy (só leitura)
1. Rode e **anote o resultado e o horário** (para comparar depois):
   ```sql
   select versao_esquema, count(*) from game_states group by 1;
   ```
   Antes do deploy o esperado é todos os saves em 11 (e nenhuma linha em 12).
2. Rode a mesma consulta depois do deploy e compare: o total de saves (soma da coluna `count`) tem de ser o mesmo; só o número de linhas em 11 cai e o de 12 sobe, conforme os jogadores agem. Se o total mudou, pare e investigue antes de seguir.

### 6.3 Commits esperados no push
O push da `main` leva TODOS os commits locais ainda não publicados, em ordem. Antes do `git push`, rode `git log origin/main..HEAD --oneline` e confira. A lista esperada (do mais antigo ao mais novo) é:

| # | Commit | O que é |
|---|---|---|
| 1 | `20cb3d5` | fix: Mesa de Guerra e Enfermaria respeitam o estado do QG |
| 2 | `2e2dd0e` | GPC: progressão do clique (esquema 12), o código deste deploy |
| 3 | `20446a6` | docs: registro, handoff, checklist do esquema 12, backlog e `.gitignore` |
| 4 | `ba1c5bc` | docs: prompts de áudio, bugs de produção e progressão do clique; arte do Portão 23 |
| 5 | `d40aa7e` | chore: integra o Graphify (`CLAUDE.md`, `.claude/settings.json`, `.graphifyignore`, `.gitattributes`) |
| 6 | (hash do commit dos testes) | test: balde do usuário, trava do reset e convidado com sessão |
| 7 | (hash do commit de docs) | docs: registro e este checklist |

**Se aparecer qualquer outro commit além destes sete, PARE e não faça o push.** Os commits 3, 4, 5 e 7 só mexem em documentos e configuração do Claude Code (nenhum muda o código do jogo); o código que vai para produção são os commits 1, 2 e 6 (este só testes). O áudio não tem commit e não deve aparecer.
