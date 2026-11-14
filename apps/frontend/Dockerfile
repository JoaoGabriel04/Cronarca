# syntax=docker/dockerfile:1
# Imagem de desenvolvimento do frontend. Contexto de build: raiz do monorepo.
FROM node:24-bookworm-slim AS dev

WORKDIR /app

# Pontos de montagem dos volumes (node_modules e .next), já com dono "node".
RUN mkdir -p node_modules packages/game-core/node_modules apps/frontend/node_modules apps/frontend/.next \
  && chown -R node:node /app

COPY --chmod=755 docker/deps.sh /usr/local/bin/cronarca-deps

USER node

COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node packages/game-core/package.json packages/game-core/
COPY --chown=node:node apps/backend/package.json apps/backend/
COPY --chown=node:node apps/frontend/package.json apps/frontend/

ENV NODE_ENV=development \
    NEXT_TELEMETRY_DISABLED=1 \
    NPM_CI_ARGS="-w @cronarca/frontend -w @cronarca/game-core --include-workspace-root"

RUN cronarca-deps

EXPOSE 3000
ENTRYPOINT ["cronarca-deps", "--exec"]
CMD ["npm", "run", "dev", "-w", "@cronarca/frontend"]
