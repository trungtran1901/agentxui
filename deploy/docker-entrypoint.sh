#!/bin/sh
# =============================================================================
# Runs automatically at container start (nginx:alpine executes every
# /docker-entrypoint.d/*.sh before launching nginx).
#
# Does two things:
#   1. Writes window.__ENV__ to /usr/share/nginx/html/env-config.js so the
#      SPA can read runtime config without rebuilding.
#   2. Rewrites nginx upstream URLs in /etc/nginx/conf.d/default.conf with
#      the actual backend addresses from env vars (envsubst).
# =============================================================================

set -eu

HTML_DIR="/usr/share/nginx/html"
NGINX_CONF="/etc/nginx/conf.d/default.conf"

# ---------- 1. Runtime env for the SPA ----------
cat > "${HTML_DIR}/env-config.js" <<JS
window.__ENV__ = {
  VITE_URL_AUTH:           "${VITE_URL_AUTH:-}",
  VITE_REALM:              "${VITE_REALM:-}",
  VITE_CLIENT_ID:          "${VITE_CLIENT_ID:-}",
  VITE_KEYCLOAK_ENABLED:   "${VITE_KEYCLOAK_ENABLED:-true}",
  VITE_AGNO_API_URL:       "${VITE_AGNO_API_URL:-/agno}",
  VITE_MCP_API_URL:        "${VITE_MCP_API_URL:-/mcp}",
  VITE_KNOWLEDGE_API_URL:  "${VITE_KNOWLEDGE_API_URL:-/knowledge}",
  VITE_KEYCLOAK_ENFORCE_ROLES: "${VITE_KEYCLOAK_ENFORCE_ROLES:-false}",
  VITE_REQUIRED_ROLES: "${VITE_REQUIRED_ROLES:-}",
  VITE_MODULE_ROLE_MAP: "${VITE_MODULE_ROLE_MAP:-}"
};
JS
echo "[entrypoint] wrote env-config.js"

# ---------- 2. Inject backend upstream URLs into nginx config ----------
# The nginx.conf template uses placeholder tokens (AGNO_UPSTREAM_URL etc.)
# instead of variables (which nginx doesn't support in proxy_pass without
# a resolver). We replace them here with sed before nginx starts.

AGNO_UPSTREAM="${VITE_AGNO_API_URL:-http://localhost:8000}"
MCP_UPSTREAM="${VITE_MCP_API_URL:-http://localhost:8001}"
KNOWLEDGE_UPSTREAM="${VITE_KNOWLEDGE_API_URL:-http://localhost:8002}"

# Strip trailing slash if present (nginx proxy_pass adds its own)
AGNO_UPSTREAM="${AGNO_UPSTREAM%/}"
MCP_UPSTREAM="${MCP_UPSTREAM%/}"
KNOWLEDGE_UPSTREAM="${KNOWLEDGE_UPSTREAM%/}"

sed -i \
  -e "s|AGNO_UPSTREAM_URL|${AGNO_UPSTREAM}|g" \
  -e "s|MCP_UPSTREAM_URL|${MCP_UPSTREAM}|g" \
  -e "s|KNOWLEDGE_UPSTREAM_URL|${KNOWLEDGE_UPSTREAM}|g" \
  "${NGINX_CONF}"

echo "[entrypoint] nginx upstreams set:"
echo "  /agno/      -> ${AGNO_UPSTREAM}"
echo "  /mcp/       -> ${MCP_UPSTREAM}"
echo "  /knowledge/ -> ${KNOWLEDGE_UPSTREAM}"