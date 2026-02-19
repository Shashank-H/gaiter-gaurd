#!/bin/sh
set -e

# Run migrations
echo "Running migrations..."
bun run db:migrate

# Start the application
echo "Starting application..."
exec bun src/server.ts
