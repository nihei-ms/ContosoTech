#!/bin/sh
# Inject BACKEND_URL from container environment into nginx config at startup.
# Default to localhost:8000 for local docker-compose development.
export BACKEND_URL="${BACKEND_URL:-http://localhost:8000}"

# Derive bare host (no scheme, no path) for Host header + SNI.
export BACKEND_HOST="$(echo "$BACKEND_URL" | sed -E 's#^[a-z]+://##; s#/.*$##')"

envsubst '${BACKEND_URL} ${BACKEND_HOST}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

exec nginx -g "daemon off;"
