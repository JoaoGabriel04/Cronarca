# Checklist: deploy da migração do save, esquema 8 para 9 (Portão 20d-3)

**Status (16/11):** a migração **já está em produção** (o backend com o esquema 9 foi publicado). A verificação com o **dump real não foi feita**: decisão do dono em 16/11, de pular essa etapa; o risco foi aceito. Ficam prontos, para quando for útil: o script (`make conferir-migracao ARQ=...`), o backup e a reversão descritos abaixo. A verificação com saves **sintéticos** (gerados pelo código antigo) passou: 7 de 7, sem perda, idempotente. Os cuidados da seção 1 valem para qualquer dump futuro.

Objetivo: ter certeza antes de publicar, sem tocar no banco de produção. A migração troca só o id da classe de cada aventureiro (guerreiro para Lanceiro, arqueiro e ladino para Arqueiro, clérigo para Cavaleiro, mago para Mago do Tempo) e acrescenta nada mais. Roda ao carregar o save (`carregarEstado` em `apps/backend/src/jogo/repositorio.ts`).

## O que já se sabe do código
- **Leitura não grava.** `GET /game/state` migra em memória; a linha do banco só passa a `versao_esquema = 9` quando o jogador faz uma ação (cada ação grava `versaoEsquema: VERSAO_ESQUEMA`). Por isso, logo depois do deploy, o banco tem saves nos dois esquemas ao mesmo tempo, e isso é normal.
- **Só `carregarEstado` lê o JSON.** O ranking não lê o estado direto.
- **Idempotente.** A migração é uma função pura da versão: carregar duas vezes, migrar o já migrado e ir e voltar por JSON dão o mesmo estado (conferido para cada save pelo script).
- **O código antigo não lê o esquema 9** (`z.literal(8)`): reverter só o código, depois que existem saves em v9, não basta (ver Reversão).

## 0. Confirme se a migração já está publicada
O commit `03ec0ae` (que traz o esquema 9) foi para o GitHub em 16/11. Se o Render publica sozinho a cada push na `main`, a migração **já pode estar no ar**. No painel do Render, serviço do backend, aba Events: veja o commit do último deploy. Se já for `03ec0ae` ou posterior, pule para a seção 3 (conferir o dump e, se houver problema, a Reversão) e não faça a seção 2 como "antes do deploy": o backup vale como ponto de restauração do estado de agora.

## 1. Verificação offline (sem tocar na produção)

**Cuidados com a URL de conexão:** ela tem a senha do banco. Nunca cole no chat nem em arquivo do projeto; use sempre `read -rs` como abaixo (não aparece na tela nem fica no histórico) e a URL **do jeito que o provedor entrega**, entre aspas, sem acrescentar parâmetros (o Neon já traz `?sslmode=require&channel_binding=require`; sem aspas, o `&` roda o comando em segundo plano e corta a URL). Se a senha vazar, troque-a no provedor e atualize o `DATABASE_URL` do backend no Render na mesma hora.
1. Gere o dump somente leitura, só da tabela de saves (comando no cabeçalho de `scripts/conferir-migracao.ts`):
   ```bash
   mkdir -p dumps
   read -rs -p 'URL de conexão do banco (não aparece na tela): ' URL_DB; echo
   docker run --rm -e PGOPTIONS='-c default_transaction_read_only=on' postgres:17-alpine \
     psql "$URL_DB" -At \
     -c "select coalesce(json_agg(t), '[]'::json) from (select left(md5(user_id::text), 10) as id, rev, versao_esquema, estado from game_states order by user_id) t" \
     > dumps/saves_producao.json
   unset URL_DB
   wc -c dumps/saves_producao.json   # tem de ter conteúdo (um dump vazio faz o script recusar)
   ```
2. Confira: `make conferir-migracao ARQ=dumps/saves_producao.json`.
   - Esperado: `Falhas: 0`, e o total de saves igual ao de linhas do banco.
   - O script confere, por save: mesmos ids, nome, nível, XP, arma, armadura, estado e ferimento por aventureiro; recursos, construções, pesquisas, relíquias, ciclo, Falha, expedições e relatórios idênticos; nenhuma classe antiga restante; esquema final 9; expedições em andamento com o mesmo relatório na volta; idempotência.
   - Qualquer falha lista o id anônimo do save e o motivo. **Não faça o deploy com falhas.**
3. Apague o dump depois de conferir: `rm dumps/saves_producao.json`. `dumps/` está no `.gitignore`; nunca commitar.

O comando sem `ARQ` roda a verificação com saves **sintéticos** (gerados pelo código antigo); serve para validar o script e **não substitui** o dump real.

## 2. Backup antes do deploy
1. Backup completo, no seu computador, fora do repositório (`backups/` está no `.gitignore`):
   ```bash
   mkdir -p backups
   read -rs -p 'URL de conexão do banco (não aparece na tela): ' URL_DB; echo
   docker run --rm -v "$PWD/backups:/b" postgres:17-alpine \
     pg_dump "$URL_DB" -Fc -f /b/cronarca_antes_do_esquema9.dump
   unset URL_DB
   ```
2. Confira que o arquivo existe e lê: `docker run --rm -v "$PWD/backups:/b" postgres:17-alpine pg_restore --list /b/cronarca_antes_do_esquema9.dump | head`.
3. Confira no painel do provedor do banco (o de produção é o Neon) o plano e se ele guarda backups ou pontos de restauração (não assumo) e se ele guarda backups automáticos O arquivo local acima vale de qualquer jeito.
4. O backup tem dados de usuários: guarde só pelo tempo necessário e apague depois (`rm backups/*.dump`).

## 3. Deploy
1. Escolha um horário de pouco uso (a janela de risco é entre o deploy e a primeira ação de cada jogador).
2. Publique (push na `main`, ou deploy manual no Render).
3. Verificações depois do deploy:
   - `GET /health` do backend responde 200;
   - entre com uma conta de teste: o herói aparece com a classe nova (Lanceiro, Arqueiro, Cavaleiro ou Mago do Tempo), com a mesma arte de antes;
   - nos logs do Render, nenhum erro 5xx nem `ZodError` ao carregar saves;
   - só leitura no banco: `select versao_esquema, count(*) from game_states group by 1;` mostra os saves migrando para 9 conforme os jogadores agem.

## 4. Reversão
- **Ainda nenhum save em v9** (ninguém agiu depois do deploy): o banco continua no esquema 8. Basta voltar o código (Render, Rollback para o deploy anterior). Sem perda.
- **Já há saves em v9:** o código antigo não os lê. Opções, da mais simples à mais cara:
  1. **Restaurar o backup** da seção 2 (perde o progresso de todos feito depois do backup):
     ```bash
     docker run --rm -v "$PWD/backups:/b" postgres:17-alpine \
       pg_restore --clean --if-exists --no-owner -d "$URL_DB" /b/cronarca_antes_do_esquema9.dump
     ```
     Antes de restaurar, faça um novo backup do estado de agora (como na seção 2) para não perder nada de vez, e depois volte o código.
  2. **Rebaixar os saves 9 para 8** com um script (não existe hoje): o mapeamento inverso é guarda-chuva (Lanceiro volta a Guerreiro, Cavaleiro a Clérigo, Mago do Tempo a Mago) e **perde a distinção Arqueiro / Ladino**. Só vale a pena se a restauração for inaceitável; peça antes de precisar.
- Depois de qualquer reversão, rode de novo a seção 1 antes de tentar publicar outra vez.

## 5. Limpeza
Apague `dumps/saves_producao.json` e `backups/*.dump` quando não precisar mais. Nenhum dos dois entra no Git.
