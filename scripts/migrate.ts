// Standalone migration runner script

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('Error: DATABASE_URL environment variable is not set');
  process.exit(1);
}

async function runMigrations() {
  // Create a dedicated postgres client for migrations with max 1 connection
  const migrationClient = postgres(DATABASE_URL, { max: 1 });
  const db = drizzle({ client: migrationClient });

  try {
    console.log('Running migrations...');
    await migrate(db, { migrationsFolder: './src/db/migrations' });
    console.log('Migrations completed successfully');
    await migrationClient.end();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    await migrationClient.end();
    process.exit(1);
  }
}

runMigrations();
