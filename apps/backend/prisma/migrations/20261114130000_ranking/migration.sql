-- Portão 15 (Ranking): tempo jogado no estado do jogo.
ALTER TABLE "game_states" ADD COLUMN     "tempo_jogado" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "ultima_atividade_em" TIMESTAMPTZ(3);

-- Todo jogador com reino entra no ranking (decisão do Portão 15). Reinos que
-- já existiam ganham a entrada com a posição atual; o marco é o último instante
-- liquidado (não há como saber quando chegaram a ela).
INSERT INTO "ranking_entries" ("user_id", "era", "ciclo", "reliquias", "tempo_jogado", "marco_em", "atualizado_em")
SELECT "user_id",
       ("estado"->>'era')::int,
       ("estado"->>'ciclo')::int,
       ("estado"->'reliquias'->>'total')::int,
       0,
       "atualizado_em",
       CURRENT_TIMESTAMP
FROM "game_states"
ON CONFLICT ("user_id") DO NOTHING;
