#!/bin/sh
set -e

echo "Waiting for postgres..."
until pg_isready -h postgres -U econ; do sleep 2; done
echo "Postgres ready."

echo "Starting Next.js dev server (Payload will push schema + seed via onInit)..."
# Invoke Next.js directly, NOT via `npm run dev`. npm-as-PID-1 fails to spawn the
# next child in this Alpine container. Direct invocation works. See CLAUDE.md gotcha.
exec node_modules/.bin/next dev
