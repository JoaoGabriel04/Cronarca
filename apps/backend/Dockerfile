# syntax=docker/dockerfile:1
# Imagem de desenvolvimento do backend. Contexto de build: raiz do monorepo.
FROM node:24-bookworm-slim AS dev

WORKDIR /app

# O motor de migração do Prisma precisa do OpenSSL, que a imagem slim não traz.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# Pontos de montagem dos volumes de node_modules, já com dono "node",
# para os volumes nomeados nascerem com a permissão certa.
RUN mkdir -p node_modules packages/game-core/node_modules apps/backend/node_modules \
  && chown -R node:node /app

COPY --chmod=755 docker/deps.sh /usr/local/bin/cronarca-deps

USER node

COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node packages/game-core/package.json packages/game-core/
COPY --chown=node:node apps/backend/package.json apps/backend/
COPY --chown=node:node apps/frontend/package.json apps/frontend/

ENV NODE_ENV=development \
    NPM_CI_ARGS="-w @cronarca/backend -w @cronarca/game-core --include-workspace-root"

RUN cronarca-deps

EXPOSE 4000
ENTRYPOINT ["cronarca-deps", "--exec"]
CMD ["npm", "run", "dev", "-w", "@cronarca/backend"]
