#!/bin/sh
set -e

echo "Waiting for postgres..."
until pg_isready -h postgres -U econ; do sleep 2; done
echo "Postgres ready."

echo "Running Medusa migrations..."
npx medusa db:migrate

echo "Creating admin user..."
npx medusa user -e "$MEDUSA_ADMIN_EMAIL" -p "$MEDUSA_ADMIN_PASSWORD" 2>/dev/null || echo "User may already exist, continuing."

echo "Starting Medusa..."
npx medusa start &
MEDUSA_PID=$!

echo "Waiting for Medusa API to be ready..."
until wget -q -O- http://localhost:9000/health > /dev/null 2>&1; do sleep 3; done
echo "Medusa ready. Running seed..."

npx tsx /seed/medusa-seed.ts

wait $MEDUSA_PID
