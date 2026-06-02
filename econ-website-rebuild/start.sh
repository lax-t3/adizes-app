#!/bin/sh
set -e

echo "Waiting for postgres..."
until pg_isready -h postgres -U econ; do sleep 2; done
echo "Postgres ready."

echo "Running Payload migrations..."
npx payload migrate

echo "Seeding Payload..."
npx tsx seed/payload-seed.ts

echo "Starting Next.js dev server..."
exec npm run dev
