-- Portão B (conta convidado): usuário sem e-mail e a marca de convidado.
-- O índice único de e-mail continua; o Postgres aceita vários nulos nele.
-- Nenhuma linha existente é reescrita: todas ficam com convidado = false.
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "users" ADD COLUMN     "convidado" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "users_convidado_criado_em_idx" ON "users"("convidado", "criado_em");
