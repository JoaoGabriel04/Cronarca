#!/bin/sh
# Instala as dependências dentro do contêiner quando o package-lock.json muda.
# O node_modules mora num volume nomeado (não no bind mount), para não
# misturar binários do host com os do contêiner. A marca guarda o hash do
# lockfile e os workspaces instalados; se algo mudar, roda npm ci de novo.
#
# Uso: cronarca-deps            só instala (usado no build da imagem)
#      cronarca-deps --exec CMD instala se preciso e executa CMD
set -eu

cd /app
MARCA=/app/node_modules/.cronarca-deps
ASSINATURA="$(sha256sum package-lock.json | cut -d' ' -f1) ${NPM_CI_ARGS:-}"

if [ ! -f "$MARCA" ] || [ "$(cat "$MARCA")" != "$ASSINATURA" ]; then
  echo "[deps] instalando dependências: npm ci ${NPM_CI_ARGS:-}"
  # shellcheck disable=SC2086
  npm ci ${NPM_CI_ARGS:-} --no-audit --no-fund
  echo "$ASSINATURA" > "$MARCA"
fi

if [ "${1:-}" = "--exec" ]; then
  shift
  exec "$@"
fi
