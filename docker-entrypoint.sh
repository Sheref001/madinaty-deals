#!/bin/sh
set -eu

echo "Applying Prisma migrations..."
npm run db:migrate

if [ "${RUN_SEED:-false}" = "true" ]; then
  echo "Seeding database..."
  npm run db:seed
fi

exec node server/index.js
