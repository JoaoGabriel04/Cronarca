# Checklist: deploy do esquema 10 do save, Quartel General (Portão 21)

Objetivo: publicar o Portão 21 sem perder nenhum save. O esquema 10 acrescenta só o campo `qg: { estado, desde }` ao estado do jogo (JSON em `game_states.estado`; **nenhuma tabela nem coluna muda**). A migração roda ao carregar o save (`carregarEstado`) e **o código antigo não lê o esquema 10** (`z.literal(9)`): reverter só o código, depois que existem saves em v10, não basta (ver Reversão). Por isso, **antes do deploy, crie um branch ou backup no Neon**.

## O que já se sabe do código
- **Leitura não grava.** `GET /game/state` migra em memória; a linha do banco só vira `versao_esquema = 10` quando o jogador faz uma ação. Logo depois do deploy o banco tem saves nos dois esquemas, e isso é normal.
- **Idempotente.** Migrar o já migrado não muda nada (conferido pelo script e pelos testes).
- **Quem já jogava:** o QG entra `oculto`, com `desde` = instante do save; a dica do Sábio conta 8 minutos a partir dele. O destino "Ruínas do Quartel General" aparece na lista de Expedições (primeiro). Quem já ascendeu também o descobre; o QG atravessa as ascensões seguintes.
- **Mapa:** `mapa_meta.json` ganha `pontosDeInteresse` e o destino `ruinas_qg` (versão do mapa continua 2; saves antigos abrem o mesmo mapa).

## 1. Verificação offline (sem tocar na produção)
- `make conferir-migracao` (saves sintéticos do esquema 6 a 8, migrados até o 10): esperado `OK: 7 | Falhas: 0`.
- Com o dump real, se quiser (mesmos cuidados do `CHECKLIST_DEPLOY_MIGRACAO_9.md`, seção 1): `make conferir-migracao ARQ=dumps/saves_producao.json`. Para cada save de esquema 9 o script confere: nenhum campo muda, só entra `qg: { estado: 'oculto', desde: t }`.

## 2. Branch ou backup no Neon (antes do deploy)
Faça **um** dos dois (o branch é mais rápido de voltar; o dump fica fora do Neon):
1. **Branch no Neon (recomendado):** no painel do Neon, projeto do Cronarca, aba **Branches**, **Create branch** a partir do branch de produção (`main`), nome `antes-do-esquema-10`, "current data". Ele é uma cópia do banco de agora; não consome nada do banco de produção e não é alterado pelo deploy. Anote o horário.
2. **Dump local** (fora do repositório; `backups/` está no `.gitignore`):
   ```bash
   mkdir -p backups
   read -rs -p 'URL de conexão do banco (não aparece na tela): ' URL_DB; echo
   docker run --rm -v "$PWD/backups:/b" postgres:17-alpine pg_dump "$URL_DB" -Fc -f /b/cronarca_antes_do_esquema10.dump
   unset URL_DB
   docker run --rm -v "$PWD/backups:/b" postgres:17-alpine pg_restore --list /b/cronarca_antes_do_esquema10.dump | head
   ```
   (a URL do Neon traz `&`: use `read -rs`, como acima, e nunca cole a URL no chat.)
3. Confira com `make migrar-neon-status` que o banco está com as migrações do Prisma em dia (o esquema 10 **não** tem migração de tabela: o status deve continuar "up to date").

## 3. Deploy
1. Horário de pouco uso. Publique (push na `main` e deploy do Render).
2. Depois do deploy:
   - `GET /health` responde 200;
   - entre com uma conta de teste: a lista de Expedições mostra "Ruínas do Quartel General" em primeiro, perigo baixo, 0:40;
   - mande o grupo, espere a volta: as Ruínas aparecem no mapa (tile 65,28), o capítulo "O que o exército deixou" abre no Diário e o botão "Reerguer o Quartel General" funciona; recarregue (F5) e confira que persiste; repita como convidado;
   - nos logs do Render, nenhum 5xx nem `ZodError` ao carregar saves;
   - só leitura no banco: `select versao_esquema, count(*) from game_states group by 1;` mostra os saves passando para 10 conforme os jogadores agem.

## 4. Reversão
- **Ainda nenhum save em v10** (ninguém agiu depois do deploy): o banco segue no esquema 9. Basta voltar o código (Render, Rollback para o deploy anterior). Sem perda.
- **Já há saves em v10:** o código antigo não os lê. Opções:
  1. **Voltar ao branch do Neon** `antes-do-esquema-10` (aponte o `DATABASE_URL` do backend para ele, ou restaure-o como principal pelo painel) e voltar o código. Perde o progresso feito depois do branch.
  2. **Restaurar o dump** (seção 2, item 2): `pg_restore --clean --if-exists --no-owner -d "$URL_DB" /b/cronarca_antes_do_esquema10.dump`. Faça antes um novo dump do estado de agora.
  3. **Rebaixar os saves 10 para 9** com um script (não existe hoje; seria só remover o campo `qg` e ajustar a versão, mas se alguém reergueu o QG isso se perde). Peça antes de precisar.
- Depois de qualquer reversão, rode de novo a seção 1 antes de publicar outra vez.

## 5. Limpeza
Apague `backups/*.dump` e o branch `antes-do-esquema-10` quando o esquema 10 estiver estável (nada disso entra no Git).
