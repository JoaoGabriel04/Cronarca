# Cronarca: comandos de desenvolvimento. `make help` lista tudo.
SHELL := /bin/bash
COMPOSE := docker compose
.DEFAULT_GOAL := help

# Pontos de montagem dos volumes. Criados antes pelo seu usuário, senão o
# Docker os cria no host com dono root.
MOUNT_DIRS := packages/game-core/node_modules apps/backend/node_modules \
	apps/frontend/node_modules apps/frontend/.next

.PHONY: help up down logs ps migrate seed reset-db test typecheck conferir-mapa conferir-mobile gerar-frente shell-backend shell-db env-check

help: ## Lista os comandos
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[33m%-14s\033[0m %s\n", $$1, $$2}'

env-check:
	@test -f .env || { echo "Arquivo .env não encontrado. Rode: cp .env.example .env"; exit 1; }
	@mkdir -p $(MOUNT_DIRS)

up: env-check ## Sobe db, backend, frontend e mailpit e espera todos ficarem saudáveis
	$(COMPOSE) up -d --build --wait --wait-timeout 240
	@source .env; \
	echo ""; \
	echo "Frontend:  http://localhost:$${FRONTEND_PORT:-3000}"; \
	echo "Backend:   http://localhost:$${BACKEND_PORT:-4000}/health"; \
	echo "Mailpit:   http://localhost:$${MAILPIT_UI_PORT:-8026}"

down: ## Derruba os serviços (mantém os volumes e os dados do banco)
	$(COMPOSE) down

logs: ## Acompanha os logs (filtre com s=backend)
	$(COMPOSE) logs -f --tail=100 $(s)

ps: ## Mostra o estado e o healthcheck dos serviços
	$(COMPOSE) ps

migrate: env-check ## Aplica as migrações; se o schema mudou, cria uma nova (pede o nome)
	$(COMPOSE) run --rm backend npm run db:migrate -w @cronarca/backend

seed: env-check ## Popula o banco com dados de desenvolvimento (dev@cronarca.local / cronarca)
	$(COMPOSE) run --rm backend npm run db:seed -w @cronarca/backend

reset-db: env-check ## Apaga o volume do banco, recria, aplica as migrações e o seed
	$(COMPOSE) rm -s -f db
	-docker volume rm cronarca_pgdata
	$(COMPOSE) up -d --wait db
	$(COMPOSE) run --rm backend sh -c 'npm run db:deploy -w @cronarca/backend && npm run db:seed -w @cronarca/backend'

test: env-check ## Roda o Vitest (game-core e backend) contra o banco de teste
	$(COMPOSE) up -d --wait db
	$(COMPOSE) run --rm backend sh -c 'npm run db:generate -w @cronarca/backend >/dev/null && npm test'

typecheck: env-check ## Checa tipos do game-core, backend e frontend dentro dos contêineres
	$(COMPOSE) run --rm --no-deps backend sh -c 'npm run db:generate -w @cronarca/backend >/dev/null && npm run typecheck -w @cronarca/game-core -w @cronarca/backend'
	$(COMPOSE) run --rm --no-deps frontend npm run typecheck -w @cronarca/frontend

PLAYWRIGHT_IMG := mcr.microsoft.com/playwright:v1.61.1-noble

conferir-mapa: ## Preview do mapa no Chromium: pixels sem suavização em 1x a 4x, fps do arraste em 2x e capturas; precisa de make up e make seed
	docker run --rm --network host --user $$(id -u):$$(id -g) -e HOME=/tmp \
		-e PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 -v $(CURDIR):/w -w /w $(PLAYWRIGHT_IMG) \
		sh -c 'npm install --silent --no-save --no-package-lock --prefix /tmp/pw playwright@1.61.1 pngjs@7.0.0 >/dev/null && NODE_PATH=/tmp/pw/node_modules node scripts/conferir-mapa.cjs'

conferir-mobile: ## Celular no Chromium em 360, 390, 600 e 601 px (rolagem, alvos de 44 px, touch-action) e capturas ao lado do Figma; precisa de make up e make seed
	docker run --rm --network host --user $$(id -u):$$(id -g) -e HOME=/tmp \
		-e PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 -v $(CURDIR):/w -w /w $(PLAYWRIGHT_IMG) \
		sh -c 'npm install --silent --no-save --no-package-lock --prefix /tmp/pw playwright@1.61.1 pngjs@7.0.0 >/dev/null && NODE_PATH=/tmp/pw/node_modules node scripts/conferir-mobile.cjs'

gerar-frente: ## Gera public/mapa/mapa_frente.png (pedras e arbustos na frente das árvores) a partir da arte original; rodar só se o mapa, o meta ou as árvores mudarem
	docker run --rm --user $$(id -u):$$(id -g) -e HOME=/tmp -v $(CURDIR):/w -w /w $(PLAYWRIGHT_IMG) \
		sh -c 'npm install --silent --no-save --no-package-lock --prefix /tmp/pw pngjs@7.0.0 >/dev/null && NODE_PATH=/tmp/pw/node_modules node scripts/gerar-frente.cjs'

shell-backend: ## Abre um shell no contêiner do backend
	$(COMPOSE) exec backend bash

shell-db: ## Abre o psql no banco
	$(COMPOSE) exec db sh -c 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'
