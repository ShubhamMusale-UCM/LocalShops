#!/usr/bin/env sh
set -eu

echo "Running production migrations..."
npm run prisma:generate --workspace=server
npm run prisma:migrate --workspace=server

echo "Migrations completed successfully."
