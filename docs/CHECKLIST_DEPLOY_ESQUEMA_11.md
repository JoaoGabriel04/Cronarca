# Checklist: deploy do esquema 11 do save, QG e aventureiros unificados (Portão 22)

Objetivo: publicar o Portão 22 sem perder nenhum save. O esquema 11 acrescenta ao estado do jogo (JSON em `game_states.estado`; **nenhuma tabela nem coluna muda**) o campo `alojado` em cada aventureiro e o campo `nivel` em `qg`. A migração roda ao carregar o save (`carregarEstado`) e **o código antigo não lê o esquema 11** (`z.literal(10)`): reverter só o código, depois que existem saves em v11, não basta (ver Reversão). Por isso, **antes do deploy, crie um branch ou backup no Neon**.

## O que já se sabe do código
- **Leitura não grava.** `GET /game/state` migra em memória; a linha do banco só vira `versao_esquema = 11` quando o jogador faz uma ação. Logo depois do deploy o banco tem saves nos dois esquemas, e isso é normal.
- **Idempotente.** Migrar o já migrado não muda nada (script e testes).
- **Quem já jogava:** todo aventureiro entra com `alojado: false`; `qg.nivel` vira 1 se o QG já estava reerguido, senão 0. Nada é gasto nem perdido.
- **Comida muda para todos (curva C).** Cada aventureiro come 0,03 + 0,006 × (n − 1) comida/s (antes, 0,08 fixo). Até 9 aventureiros a tropa come menos que antes; de 10 em diante, mais. O saldo de comida das contas existentes melhora logo no primeiro minuto; não há perda.
- **Contratar exige a classe.** O cliente antigo (aba aberta antes do deploy) recebe 400 `acao_invalida` e vê "O jogo foi atualizado. Atualize a página e tente de novo." Nada é cobrado.
- **Artes:** as classes antigas (guerreiro, clérigo, mago, ladino) saíram do catálogo de sprites; só o catálogo novo (Lanceiro, Arqueiro, Cavaleiro, Mago do Tempo) existe. A conversão de classe do esquema 9 continua valendo.
- **Ascensão (novo):** os mais fortes (até a capacidade do Alojamento, 3 no nível 1) atravessam; os outros saem da guilda com uma linha na Crônica. O soldado inicial só nasce se ninguém atravessar.

## 1. Verificação offline (sem tocar na produção)
- `make conferir-migracao` (saves sintéticos do esquema 6 a 8, migrados até o 11): esperado `OK: 7 | Falhas: 0`.
- Com o dump real, se quiser (mesmos cuidados do `CHECKLIST_DEPLOY_MIGRACAO_9.md`, seção 1): `make conferir-migracao ARQ=dumps/saves_producao.json`. Para cada save de esquema 10 o script confere: cada aventureiro só ganha `alojado: false`, o `qg` só ganha `nivel` e nada mais muda.

## 2. Branch ou backup no Neon (antes do deploy)
Faça **um** dos dois (o branch é mais rápido de voltar; o dump fica fora do Neon):
1. **Branch no Neon (recomendado):** no painel do Neon, projeto do Cronarca, aba **Branches**, **Create branch** a partir do branch de produção (`main`), nome `antes-do-esquema-11`, "current data". Ele é uma cópia do banco de agora e não é alterado pelo deploy. Anote o horário.
2. **Dump local** (fora do repositório; `backups/` está no `.gitignore`):
   ```bash
   mkdir -p backups
   read -rs -p 'URL de conexão do banco (não aparece na tela): ' URL_DB; echo
   docker run --rm -v "$PWD/backups:/b" postgres:17-alpine pg_dump "$URL_DB" -Fc -f /b/cronarca_antes_do_esquema11.dump
   unset URL_DB
   docker run --rm -v "$PWD/backups:/b" postgres:17-alpine pg_restore --list /b/cronarca_antes_do_esquema11.dump | head
   ```
   (a URL do Neon traz `&`: use `read -rs`, como acima, e nunca cole a URL no chat.)
3. Confira com `make migrar-neon-status` que o banco está com as migrações do Prisma em dia (o esquema 11 **não** tem migração de tabela: deve continuar "up to date").

## 3. Deploy
1. Horário de pouco uso. Publique (push na `main` e deploy do Render).
2. Depois do deploy:
   - `GET /health` responde 200;
   - entre com uma conta existente: os aventureiros aparecem com os sprites novos (Lanceiro, Arqueiro, Cavaleiro, Mago do Tempo), na aba Heróis > Tropa; o painel do Alojamento mostra "Reerga o Quartel General..." (ou "Alojamento 0 / 3" se o QG já estava reerguido);
   - "Contratar aventureiro" abre o modal com as 4 classes; contrate uma e confira que a classe escolhida entra; F5 e confirme que persiste; repita como convidado;
   - com uma aba aberta de antes do deploy, tente contratar: aparece "Atualize a página";
   - ascenda uma conta de teste com o QG reerguido e 4+ aventureiros: os 3 mais fortes ficam "Alojados" no ciclo novo, os outros saem com linha na Crônica; F5 mantém;
   - nos logs do Render, nenhum 5xx nem `ZodError` ao carregar saves;
   - só leitura no banco: `select versao_esquema, count(*) from game_states group by 1;` mostra os saves passando para 11 conforme os jogadores agem.

## 4. Reversão
- **Ainda nenhum save em v11:** o banco segue no esquema 10. Basta voltar o código (Render, Rollback). Sem perda.
- **Já há saves em v11:** o código antigo não os lê. Opções:
  1. **Voltar ao branch do Neon** `antes-do-esquema-11` (aponte o `DATABASE_URL` para ele, ou restaure-o como principal) e voltar o código. Perde o progresso feito depois do branch.
  2. **Restaurar o dump** (seção 2, item 2): `pg_restore --clean --if-exists --no-owner -d "$URL_DB" /b/cronarca_antes_do_esquema11.dump`. Faça antes um novo dump do estado de agora.
  3. **Rebaixar os saves 11 para 10** com um script (não existe hoje; seria remover `alojado` e `qg.nivel`; quem já ascendeu com Alojamento perderia o que atravessou). Peça antes de precisar.
- Depois de qualquer reversão, rode de novo a seção 1 antes de publicar outra vez.

## 5. Limpeza
Apague `backups/*.dump` e o branch `antes-do-esquema-11` quando o esquema 11 estiver estável (nada disso entra no Git).
