#!/bin/sh
set -e

echo "Waiting for postgres..."
until pg_isready -h postgres -U econ; do sleep 2; done
echo "Postgres ready."

echo "Starting Next.js dev server (Payload will push schema + seed via onInit)..."
exec npm run dev
